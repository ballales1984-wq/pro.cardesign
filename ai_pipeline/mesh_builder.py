"""
mesh_builder — Point Cloud → Mesh (Livello 1 & 5)
Reconstructs mesh from point cloud using Poisson or Ball Pivoting.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class MeshResult:
    vertices: np.ndarray   # (V, 3) float32
    faces: np.ndarray      # (F, 3) int32
    normals: Optional[np.ndarray] = None
    colors: Optional[np.ndarray] = None
    method: str = "unknown"
    vertex_count: int = 0
    face_count: int = 0
    bounds_min: np.ndarray = field(default_factory=lambda: np.zeros(3))
    bounds_max: np.ndarray = field(default_factory=lambda: np.zeros(3))

    def __post_init__(self):
        self.vertex_count = int(self.vertices.shape[0])
        self.face_count = int(self.faces.shape[0])
        if self.vertex_count > 0:
            self.bounds_min = self.vertices.min(axis=0)
            self.bounds_max = self.vertices.max(axis=0)

    def save_obj(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        lines = ["o ai_mesh\n"]
        for v in self.vertices:
            lines.append(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
        if self.normals is not None:
            for n in self.normals:
                lines.append(f"vn {n[0]:.6f} {n[1]:.6f} {n[2]:.6f}\n")
        for f in self.faces + 1:
            lines.append(f"f {f[0]} {f[1]} {f[2]}\n")
        path.write_text("".join(lines))
        (path.parent / (path.stem + "_meta.json")).write_text(
            f'{{"vertices": {self.vertex_count}, "faces": {self.face_count}, '
            f'method: "{self.method}"}}\n'
        )
        return path

    def to_voxel_dict(self) -> dict:
        return {
            "vertices": self.vertices.tolist(),
            "faces": self.faces.tolist(),
            "method": self.method,
            "vertex_count": self.vertex_count,
            "face_count": self.face_count,
        }


class PointCloudToMesh:
    def __init__(self, method: str = "poisson"):
        self.method = method

    def reconstruct(self, point_cloud) -> MeshResult:
        if point_cloud.num_points < 10:
            return self._fallback_mesh()
        if self.method == "poisson":
            return self._poisson(point_cloud)
        elif self.method == "convex_hull":
            return self._convex_hull(point_cloud)
        else:
            return self._ball_pivot(point_cloud)

    def _poisson(self, pc) -> MeshResult:
        try:
            import open3d as o3d
            o3d_pc = o3d.geometry.PointCloud()
            o3d_pc.points = o3d.utility.Vector3dVector(pc.points)
            if pc.normals is not None:
                o3d_pc.normals = o3d.utility.Vector3dVector(pc.normals)
            else:
                o3d_pc.estimate_normals(
                    o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30)
                )
            mesh_o3d, densities = o3d.pipelines.integration.create_point_cloud_poisson(
                o3d_pc, depth=8, scale=1.1, linear_fit=False
            )
            vertices = np.asarray(mesh_o3d.vertices, dtype=np.float32)
            faces = np.asarray(mesh_o3d.triangles, dtype=np.int32)
            normals = np.asarray(mesh_o3d.vertex_normals, dtype=np.float32) if mesh_o3d.has_vertex_normals() else None
            logger.info(f"Poisson: {vertices.shape[0]} vertici, {faces.shape[0]} facce")
            return MeshResult(
                vertices=vertices, faces=faces, normals=normals,
                colors=pc.colors, method="poisson"
            )
        except Exception as e:
            logger.warning(f"Poisson reconstruction failed: {e}, falling back...")
            return self._convex_hull(pc)

    def _convex_hull(self, pc) -> MeshResult:
        try:
            from scipy.spatial import ConvexHull
            pts = pc.points
            hull = ConvexHull(pts)
            vertices = pts[hull.vertices].astype(np.float32)
            faces = hull.simplices.astype(np.int32)
            logger.info(f"ConvexHull: {vertices.shape[0]} vertici, {faces.shape[0]} facce")
            return MeshResult(
                vertices=vertices, faces=faces,
                colors=pc.colors[hull.vertices] if pc.colors is not None else None,
                method="convex_hull"
            )
        except Exception as e:
            logger.warning(f"ConvexHull failed: {e}, using fallback")
            return self._fallback_mesh()

    def _ball_pivot(self, pc) -> MeshResult:
        try:
            import open3d as o3d
            o3d_pc = o3d.geometry.PointCloud()
            o3d_pc.points = o3d.utility.Vector3dVector(pc.points)
            o3d_pc.estimate_normals(
                o3d.geometry.KDTreeSearchParamHybrid(radius=0.1, max_nn=30)
            )
            radii = [0.005, 0.01, 0.02, 0.04]
            mesh_o3d = o3d.geometry.TriangleMesh.create_from_point_cloud_ball_pivoting(
                o3d_pc, o3d.utility.DoubleVector(radii)
            )
            vertices = np.asarray(mesh_o3d.vertices, dtype=np.float32)
            faces = np.asarray(mesh_o3d.triangles, dtype=np.int32)
            return MeshResult(
                vertices=vertices, faces=faces,
                normals=np.asarray(mesh_o3d.vertex_normals, dtype=np.float32),
                colors=pc.colors, method="ball_pivot"
            )
        except Exception as e:
            logger.warning(f"Ball Pivot failed: {e}, using ConvexHull")
            return self._convex_hull(pc)

    def _fallback_mesh(self) -> MeshResult:
        v = np.array([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
                       [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], dtype=np.float32)
        f = np.array([[0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
                       [0, 4, 5], [0, 5, 1], [2, 6, 7], [2, 7, 3],
                       [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]], dtype=np.int32)
        return MeshResult(vertices=v, faces=f, method="fallback_cube")
