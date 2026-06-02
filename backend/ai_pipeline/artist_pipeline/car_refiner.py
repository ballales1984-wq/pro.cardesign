"""car_refiner - Car-specific mesh refinement for Artist 3D Pipeline."""

from __future__ import annotations
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Tuple

import numpy as np

from .config import PipelineConfig, CarRefinerConfig
from .utils import setup_logging, compute_bounds

logger = setup_logging()


@dataclass
class RefinedMesh:
    vertices: np.ndarray
    faces: np.ndarray
    normals: Optional[np.ndarray]
    metadata: dict = field(default_factory=dict)
    vertex_count: int = 0
    face_count: int = 0

    def __post_init__(self):
        self.vertex_count = int(self.vertices.shape[0])
        self.face_count = int(self.faces.shape[0])


class CarRefiner:
    def __init__(self, config: Optional[CarRefinerConfig] = None):
        self.config = config or CarRefinerConfig()

    def refine(self, point_cloud) -> RefinedMesh:
        pts = np.asarray(point_cloud.points, dtype=np.float32)
        if pts.size == 0 or pts.shape[0] < 3:
            return self._empty_mesh()
        try:
            vertices, faces = self._point_cloud_to_mesh(pts)
        except Exception as exc:
            logger.warning(f"Mesh reconstruction failed: {exc}")
            return self._empty_mesh()
        vertices, faces = self._enforce_symmetry(vertices, faces)
        vertices = self._prune_outliers_z(vertices)
        vertices, faces = self._place_wheels(vertices, faces)
        return RefinedMesh(
            vertices=vertices,
            faces=faces,
            normals=None,
            metadata={"wheels_placed": 4 if faces.shape[0] > 0 else 0},
        )

    def _empty_mesh(self) -> RefinedMesh:
        return RefinedMesh(
            vertices=np.zeros((1, 3), dtype=np.float32),
            faces=np.zeros((1, 3), dtype=np.int32),
            normals=None,
        )

    def _point_cloud_to_mesh(self, pts: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        try:
            from open3d import geometry
            from open3d.geometry import TriangleMesh
            pcd = geometry.PointCloud(points=geometry.Vector3dVector(pts))
            pcd.estimate_normals()
            pcd.orient_normals_consistent_tangent_plane(100)
            mesh = TriangleMesh.create_from_point_cloud_alpha_shape(pcd, 0.1)
            if len(mesh.triangles) == 0:
                mesh = TriangleMesh.create_from_point_cloud_ball_pivoting(
                    pcd, geometry.KDTreeSearchParamHybrid(radius=0.05, max_nn=30)
                )
            verts = np.asarray(mesh.vertices, dtype=np.float32)
            faces = np.asarray(mesh.triangles, dtype=np.int32)
            if faces.size == 0:
                raise RuntimeError("Empty mesh")
            return verts, faces
        except Exception as exc:
            logger.warning(f"Open3D mesh failed: {exc}")
        verts = pts
        faces = np.zeros((0, 3), dtype=np.int32)
        return verts, faces

    def _enforce_symmetry(self, verts: np.ndarray, faces: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        if verts.shape[0] < 10:
            return verts, faces
        center_x = float(np.mean(verts[:, 0]))
        shift = self._axis_shift(verts, axis=0)
        verts[:, 0] += shift
        return verts, faces

    def _axis_shift(self, verts: np.ndarray, axis: int) -> float:
        pos = verts[:, axis]
        neg = -pos
        from scipy.spatial import cKDTree
        tree_neg = cKDTree(neg.reshape(-1, 1))
        dists, _ = tree_neg.query(pos.reshape(-1, 1), k=1)
        return float(np.median(dists) * 0.5)

    def _prune_outliers_z(self, verts: np.ndarray):
        if verts.shape[0] == 0:
            return verts
        z_vals = verts[:, 2]
        z_median = float(np.median(z_vals))
        z_std = float(np.std(z_vals)) if np.std(z_vals) > 0 else 1.0
        return verts[np.abs(z_vals - z_median) < 3.0 * z_std]

    def _place_wheels(self, verts: np.ndarray, faces: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        if verts.shape[0] < 10:
            return verts, faces
        try:
            from open3d import geometry
            pcd = geometry.PointCloud(points=geometry.Vector3dVector(verts))
            min_c, max_c = pcd.get_axis_aligned_bounding_box().min_bound, pcd.get_axis_aligned_bounding_box().max_bound
            cx = ((min_c + max_c) / 2.0)[0]
            wheel_r = min(self.config.wheel_radius_mm, float(max_c[2] - min_c[2]) * 0.6)
            ww = self.config.wheel_width_mm * 0.5
            positions = [
                [cx - ww * 2.0, min_c[1], min_c[2]],
                [cx + ww * 2.0, min_c[1], min_c[2]],
                [cx - ww * 2.0, max_c[1], min_c[2]],
                [cx + ww * 2.0, max_c[1], min_c[2]],
            ]
            c_verts, c_faces = self._cylinder(wheel_r, self.config.wheel_width_mm)
            all_v, all_f, offset = [verts], [faces], verts.shape[0]
            for pos in positions:
                off = np.array(pos, dtype=np.float32)
                all_v.append(c_verts + off)
                all_f.append(c_faces + offset)
                offset += c_verts.shape[0]
            return np.vstack(all_v), np.vstack(all_f)
        except Exception as exc:
            logger.warning(f"Wheel placement skipped: {exc}")
            return verts, faces

    def _cylinder(self, radius: float, width: float, resolution: int = 24) -> Tuple[np.ndarray, np.ndarray]:
        theta = np.linspace(0, 2 * np.pi, resolution, endpoint=False)
        hw = width * 0.5
        top = np.column_stack([np.full(resolution, hw), radius * np.cos(theta), radius * np.sin(theta)])
        bottom = np.column_stack([np.full(resolution, -hw), radius * np.cos(theta), radius * np.sin(theta)])
        verts = np.vstack([top, bottom]).astype(np.float32)
        f = []
        for i in range(resolution):
            j = (i + 1) % resolution
            f.append([i, j, j + resolution])
            f.append([i, j + resolution, i + resolution])
        return verts, np.array(f, dtype=np.int32)
