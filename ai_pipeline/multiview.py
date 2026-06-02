"""
multiview — Multi-View 3D Reconstruction (Livello 4)
Input: 4 immagini (frontale, posteriore, laterale, 3/4)
Output: Mesh completa combinata
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class MultiViewResult:
    combined_vertices: np.ndarray
    combined_faces: np.ndarray
    view_results: dict = field(default_factory=dict)
    method: str = "multiview_poisson"
    metadata: dict = field(default_factory=dict)

    @property
    def vertex_count(self) -> int:
        return int(self.combined_vertices.shape[0])

    @property
    def face_count(self) -> int:
        return int(self.combined_faces.shape[0])

    def save_obj(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        lines = ["o multiview_car_mesh\n"]
        for v in self.combined_vertices:
            lines.append(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
        for f in self.combined_faces + 1:
            lines.append(f"f {f[0]} {f[1]} {f[2]}\n")
        path.write_text("".join(lines))
        return path


class MultiViewReconstructor:
    def __init__(self, voxel_size_mm: float = 1.0):
        self.voxel_size_mm = voxel_size_mm
        self._depth_est = None
        self._segmenter = None
        self._point_cloud = None
        self._mesh_builder = None

    def _get_modules(self):
        if self._depth_est is None:
            from ai_pipeline.depth_estimator import DepthEstimator
            from ai_pipeline.segmenter import CarSegmenter
            from ai_pipeline.point_cloud import DepthToPointCloud
            from ai_pipeline.mesh_builder import PointCloudToMesh
            self._depth_est = DepthEstimator()
            self._segmenter = CarSegmenter()
            self._point_cloud = DepthToPointCloud()
            self._mesh_builder = PointCloudToMesh(method="poisson")

    def reconstruct_from_images(self, images: list) -> MultiViewResult:
        self._get_modules()
        if len(images) == 0:
            return self._empty_result()

        view_results = {}
        all_points = []
        all_colors = []
        camera_matrices = self._estimate_camera_poses(len(images))

        for idx, img in enumerate(images):
            logger.info(f"Elaborazione vista {idx + 1}/{len(images)}")
            depth = self._depth_est.estimate(img)
            seg = self._segmenter.segment_car(img)
            mask = seg.mask_array() / 255.0 if seg.mask is not None else None
            R, t = camera_matrices[idx]

            pts = self._point_cloud.convert(depth, image=img, mask=mask, max_points=30000)
            pts_transformed = pts.points @ R.T + t.reshape(1, 3)
            all_points.append(pts_transformed.astype(np.float32))
            all_colors.append(pts.colors.astype(np.float32))

            view_mesh = self._mesh_builder.reconstruct(
                type('PC', (), {
                    'points': pts_transformed, 'colors': pts.colors,
                    'num_points': pts_transformed.shape[0],
                    'normals': None
                })()
            )
            view_results[f"view_{idx}"] = {
                "vertices": view_mesh.vertices,
                "faces": view_mesh.faces,
                "point_count": pts_transformed.shape[0],
            }

        combined_pc = type('PC', (), {
            'points': np.vstack(all_points) if all_points else np.zeros((1, 3)),
            'colors': np.vstack(all_colors) if all_colors else np.ones((1, 3)) * 0.5,
            'num_points': sum(p.shape[0] for p in all_points),
            'normals': None
        })()

        combined = self._mesh_builder.reconstruct(combined_pc)
        logger.info(f"MultiView combinata: {combined.vertex_count} vertici, "
                     f"{combined.face_count} facce")
        return MultiViewResult(
            combined_vertices=combined.vertices,
            combined_faces=combined.faces,
            view_results=view_results,
            metadata={
                " num_views": len(images),
                "total_points": combined_pc.num_points,
            }
        )

    def _estimate_camera_poses(self, n_views: int) -> List[Tuple[np.ndarray, np.ndarray]]:
        poses = []
        for i in range(n_views):
            angle = 2 * np.pi * i / n_views
            R = np.array([
                [np.cos(angle), 0, np.sin(angle)],
                [0, 1, 0],
                [-np.sin(angle), 0, np.cos(angle)]
            ], dtype=np.float32)
            t = np.array([0, 0, 0], dtype=np.float32)
            poses.append((R, t))
        return poses

    def _empty_result(self) -> MultiViewResult:
        v = np.array([[0, 0, 0], [1, 0, 0], [1, 1, 0]], dtype=np.float32)
        f = np.array([[0, 1, 2]], dtype=np.int32)
        return MultiViewResult(combined_vertices=v, combined_faces=f,
                               method="empty_multi")


class MultiViewTSDF:
    def __init__(self, voxel_size: float = 2.0, trunc_dist: float = 4.0):
        self.voxel_size = voxel_size
        self.trunc_dist = trunc_dist

    def fuse_depth_maps(self, depth_maps: list, poses: list,
                        intrinsic: dict) -> np.ndarray:
        base_shape = (64, 64, 64)
        tsdf = np.ones(base_shape, dtype=np.float32)
        weights = np.zeros(base_shape, dtype=np.int32)
        for dm, pose in zip(depth_maps, poses):
            d = dm.data.reshape(dm.height, dm.width)
            for y in range(0, dm.height, 4):
                for x in range(0, dm.width, 4):
                    depth_val = d[y, x]
                    if depth_val <= 0:
                        continue
                    z = depth_val * 100.0
                    fx = intrinsic.get("fx", dm.width)
                    cx = intrinsic.get("cx", dm.width / 2)
                    fy = intrinsic.get("fy", dm.height)
                    cy = intrinsic.get("cy", dm.height / 2)
                    px = (x - cx) * z / fx
                    py = (y - cy) * z / fy
                    pt = np.array([px, py, z], dtype=np.float32) @ pose[0].T + pose[1]
                    vx = int(np.clip(np.round(pt[0] / self.voxel_size + 32), 0, 63))
                    vy = int(np.clip(np.round(pt[1] / self.voxel_size + 32), 0, 63))
                    vz = int(np.clip(np.round(pt[2] / self.voxel_size + 32), 0, 63))
                    sdf = np.clip(z / self.trunc_dist - 1, -1, 1)
                    tsdf[vx, vy, vz] = min(tsdf[vx, vy, vz], sdf)
                    weights[vx, vy, vz] += 1
        return tsdf
