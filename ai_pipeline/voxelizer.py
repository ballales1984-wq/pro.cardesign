"""
voxelizer — Mesh → Voxel Grid (Livello 6)
Converte mesh triangolare in griglia voxel compatibile con il VoxelEngine
di pro.cardesign.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple, List, Dict
import logging

logger = logging.getLogger(__name__)


@dataclass
class VoxelGrid:
    grid: np.ndarray            # (X, Y, Z) uint8/int
    size_mm: Tuple[float, float, float]
    origin_mm: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    voxel_size_mm: float = 1.0
    metadata: dict = field(default_factory=dict)

    @property
    def shape(self) -> Tuple[int, int, int]:
        return tuple(int(s) for s in self.grid.shape)

    @property
    def voxel_count(self) -> int:
        return int(np.count_nonzero(self.grid))

    def save_npz(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez(path, grid=self.grid, size_mm=np.array(self.size_mm),
                  origin_mm=np.array(self.origin_mm),
                  voxel_size_mm=np.array([self.voxel_size_mm]))
        return path

    def to_voxel_list(self) -> List[Dict]:
        sx, sy, sz = self.grid.shape
        voxels = []
        for x in range(sx):
            for y in range(sy):
                for z in range(sz):
                    if self.grid[x, y, z] > 0:
                        vx = x * self.voxel_size_mm + self.origin_mm[0]
                        vy = y * self.voxel_size_mm + self.origin_mm[1]
                        vz = z * self.voxel_size_mm + self.origin_mm[2]
                        voxels.append({
                            "x": int(x), "y": int(y), "z": int(z),
                            "x_mm": round(vx, 4), "y_mm": round(vy, 4), "z_mm": round(vz, 4),
                            "material": "steel",
                        })
        return voxels

    def save_json(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            str({"voxel_size_mm": self.voxel_size_mm,
                  "grid_shape": list(self.shape),
                  "origin_mm": list(self.origin_mm),
                  "voxels": self.to_voxel_list()})
        )
        return path


class MeshToVoxel:
    def __init__(self, voxel_size_mm: float = 1.0,
                 padding: int = 1,
                 method: str = "raycasting"):
        self.voxel_size_mm = voxel_size_mm
        self.padding = padding
        self.method = method

    def convert(self, mesh_result) -> VoxelGrid:
        if mesh_result.vertex_count < 3:
            return self._empty_grid()
        vertices = mesh_result.vertices.astype(np.float32)
        faces = mesh_result.faces.astype(np.int32)

        min_b = vertices.min(axis=0)
        max_b = vertices.max(axis=0)
        size_mm = tuple((max_b - min_b).tolist())

        dims = np.ceil((max_b - min_b) / self.voxel_size_mm).astype(int) + 2 * self.padding
        dims = np.maximum(dims, 4)

        logger.info(f"Voxel dims: {dims.tolist()}, size_mm: {[f'{s:.1f}' for s in size_mm]}")

        if self.method == "raycasting":
            grid = self._raycast(vertices, faces, dims, min_b)
        else:
            grid = self._grid_walk(vertices, faces, dims, min_b)

        return VoxelGrid(
            grid=grid, size_mm=size_mm,
            origin_mm=tuple((min_b - self.padding * self.voxel_size_mm).tolist()),
            voxel_size_mm=self.voxel_size_mm
        )

    def _raycast(self, vertices, faces, dims, min_b) -> np.ndarray:
        grid = np.zeros(tuple(dims), dtype=np.uint8)
        nx, ny, nz = dims

        triangle_normals = self._compute_normals(vertices, faces)
        face_centers = vertices[faces].mean(axis=1)

        for i in range(nx):
            for j in range(ny):
                for axis in [0, 1, 2]:
                    if axis == 0:
                        x, y, z = i, j, np.arange(nz)
                        p = np.stack([np.full(nz, i), np.full(nz, j), np.arange(nz)], axis=1)
                    elif axis == 1:
                        x, y, z = i, j, np.arange(nz)
                        p = np.stack([np.full(nz, i), np.full(nz, j), np.arange(nz)], axis=1)
                    else:
                        x, y, z = i, np.arange(ny), j
                        p = np.stack([np.full(ny, i), np.arange(ny), np.full(ny, j)], axis=1)
                        continue
                    for fi in range(faces.shape[0]):
                        v0, v1, v2 = vertices[faces[fi]]
                        n = triangle_normals[fi]
                        if n[axis] == 0:
                            continue
                        centroid = face_centers[fi]
                        dist_to_plane = np.abs(np.dot(n, p.T - centroid))
                        inside = self._point_in_triangle_batch(p, v0, v1, v2)
                        for k, point in enumerate(p):
                            if inside[0] if hasattr(inside, '__len__') and len(inside) > 0 else False:
                                grid[x, y, z] = 1

        for fi in range(faces.shape[0]):
            v0, v1, v2 = vertices[faces[fi]]
            xi0, yi0, zi0 = self._world_to_voxel(v0, min_b)
            xi1, yi1, zi1 = self._world_to_voxel(v1, min_b)
            xi2, yi2, zi2 = self._world_to_voxel(v2, min_b)

            x_min = max(0, min(xi0, xi1, xi2) - 1)
            x_max = min(nx - 1, max(xi0, xi1, xi2) + 1)
            y_min = max(0, min(yi0, yi1, yi2) - 1)
            y_max = min(ny - 1, max(yi0, yi1, yi2) + 1)
            z_min = max(0, min(zi0, zi1, zi2) - 1)
            z_max = min(nz - 1, max(zi0, zi1, zi2) + 1)

            for xi in range(x_min, x_max + 1):
                for yi in range(y_min, y_max + 1):
                    for zi in range(z_min, z_max + 1):
                        px = xi * self.voxel_size_mm + min_b[0]
                        py = yi * self.voxel_size_mm + min_b[1]
                        pz = zi * self.voxel_size_mm + min_b[2]
                        p = np.array([px, py, pz], dtype=np.float32)
                        if self._point_in_triangle(p, v0, v1, v2):
                            grid[xi, yi, zi] = 1

        return grid

    def _grid_walk(self, vertices, faces, dims, min_b) -> np.ndarray:
        grid = np.zeros(tuple(dims), dtype=np.uint8)
        nx, ny, nz = dims

        for fi in range(faces.shape[0]):
            v0, v1, v2 = vertices[faces[fi]]
            xi0, yi0, zi0 = self._world_to_voxel(v0, min_b)
            xi1, yi1, zi1 = self._world_to_voxel(v1, min_b)
            xi2, yi2, zi2 = self._world_to_voxel(v2, min_b)

            x_min, x_max = max(0, min(xi0, xi1, xi2)), min(nx - 1, max(xi0, xi1, xi2))
            y_min, y_max = max(0, min(yi0, yi1, yi2)), min(ny - 1, max(yi0, yi1, yi2))
            z_min, z_max = max(0, min(zi0, zi1, zi2)), min(nz - 1, max(zi0, zi1, zi2))

            for xi in range(max(0, x_min), min(nx, x_max + 1)):
                for yi in range(max(0, y_min), min(ny, y_max + 1)):
                    for zi in range(max(0, z_min), min(nz, z_max + 1)):
                        px = xi * self.voxel_size_mm + min_b[0]
                        py = yi * self.voxel_size_mm + min_b[1]
                        pz = zi * self.voxel_size_mm + min_b[2]
                        p = np.array([px, py, pz], dtype=np.float32)
                        if self._point_in_triangle(p, v0, v1, v2):
                            grid[xi, yi, zi] = 1

        return grid

    def _point_in_triangle(self, p, a, b, c) -> bool:
        ab = b - a
        ac = c - a
        ap = p - a
        d00 = np.dot(ab, ab)
        d01 = np.dot(ab, ac)
        d11 = np.dot(ac, ac)
        d20 = np.dot(ap, ab)
        d21 = np.dot(ap, ac)
        denom = d00 * d11 - d01 * d01
        if abs(denom) < 1e-10:
            return False
        u = (d11 * d20 - d01 * d21) / denom
        v = (d00 * d21 - d01 * d20) / denom
        return 0 <= u <= 1 and 0 <= v <= 1 and u + v <= 1

    def _point_in_triangle_batch(self, p, a, b, c) -> bool:
        return self._point_in_triangle(p, a, b, c)

    def _compute_normals(self, vertices, faces) -> np.ndarray:
        v0 = vertices[faces[:, 0]]
        v1 = vertices[faces[:, 1]]
        v2 = vertices[faces[:, 2]]
        edge1 = v1 - v0
        edge2 = v2 - v0
        normals = np.cross(edge1, edge2)
        norms = np.linalg.norm(normals, axis=1, keepdims=True)
        norms = np.maximum(norms, 1e-8)
        return (normals / norms).astype(np.float32)

    def _world_to_voxel(self, p, min_b):
        return tuple(np.round((p - min_b) / self.voxel_size_mm).astype(int).tolist())

    def _empty_grid(self) -> VoxelGrid:
        return VoxelGrid(
            grid=np.zeros((4, 4, 4), dtype=np.uint8),
            size_mm=(0, 0, 0), voxel_size_mm=self.voxel_size_mm
        )
