"""
voxel_converter — Convert 3D mesh to Brick System for pro.cardesign.
Converts a refined mesh (vertices + faces) into the project's Brick objects
by:
  1. Voxelizing the mesh using raycasting/grid-walk.
  2. Replacing each voxel with a `core.brick.Brick` of configurable real size (mm).
"""

from __future__ import annotations
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

import numpy as np

from .config import PipelineConfig, VoxelConverterConfig
from .utils import setup_logging

logger = setup_logging()

try:
    from core.brick import create_brick, next_brick_id

    _CORE_AVAILABLE = True
except ImportError:
    try:
        import sys
        sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
        from core.brick import create_brick, next_brick_id

        _CORE_AVAILABLE = True
    except ImportError:
        _CORE_AVAILABLE = False
        logger.warning("core.brick not available; brick generation will be skipped")

try:
    from ai_pipeline.voxelizer import MeshToVoxel, VoxelGrid

    _VX_AVAILABLE = True
except ImportError:
    _VX_AVAILABLE = False
    logger.warning("ai_pipeline.voxelizer not available; falling back to inline voxelizer")


@dataclass
class BrickSystemResult:
    bricks: List[Any] = field(default_factory=list)
    voxel_grid: Any = None
    voxel_size_mm: float = 1.0
    vertex_count: int = 0
    face_count: int = 0
    metadata: dict = field(default_factory=dict)

    @property
    def brick_count(self) -> int:
        return len(self.bricks)


class VoxelConverter:
    def __init__(self, config: Optional[VoxelConverterConfig] = None):
        self.config = config or VoxelConverterConfig()
        self._vx = None

    def _init_voxelizer(self):
        if self._vx is None:
            if _VX_AVAILABLE:
                self._vx = MeshToVoxel(
                    voxel_size_mm=self.config.voxel_size_mm,
                    padding=self.config.padding,
                    method=self.config.method,
                )
        return self._vx

    def convert(self, source, config: Optional[PipelineConfig] = None) -> BrickSystemResult:
        if config is not None:
            self.config = config.voxel_converter
        vx = self._init_voxelizer()
        result = BrickSystemResult(voxel_size_mm=self.config.voxel_size_mm)

        if hasattr(source, "vertices") and hasattr(source, "faces"):
            verts = np.asarray(source.vertices, dtype=np.float32)
            faces = np.asarray(source.faces, dtype=np.int32)
            result.vertex_count = int(verts.shape[0])
            result.face_count = int(faces.shape[0])
        elif hasattr(source, "vertices") and hasattr(source, "vertex_count"):
            result.vertex_count = int(source.vertex_count)
            if hasattr(source, "faces"):
                faces = np.asarray(source.faces, dtype=np.int32)
                result.face_count = int(faces.shape[0])
            else:
                faces = np.zeros((0, 3), dtype=np.int32)
                result.face_count = 0
            verts = np.asarray(source.vertices, dtype=np.float32)
        elif hasattr(source, "points"):
            verts = np.asarray(source.points, dtype=np.float32)
            faces = np.zeros((0, 3), dtype=np.int32)
            result.vertex_count = int(verts.shape[0])
            result.face_count = 0
        else:
            raise TypeError(f"Unsupported source for VoxelConverter: {type(source)}")

        if verts.shape[0] < 3 or result.face_count == 0:
            h, w = getattr(source, "source_shape", (0, 0))
            if h == 0 and hasattr(source, "points"):
                h, w = int(np.max(verts[:, 1]) if verts.shape[0] > 0 else 0), int(np.max(verts[:, 0]) if verts.shape[0] > 0 else 0)
            return result

        grid = None
        if vx is not None and faces.shape[0] > 0:
            try:
                vgrid = vx.convert(source)
                grid = vgrid.grid
                result.voxel_grid = vgrid
                result.metadata["grid_shape"] = list(vgrid.shape)
                result.metadata["size_mm"] = list(vgrid.size_mm)
                logger.info(f"Voxelized: {vgrid.voxel_count} voxel, shape {vgrid.shape}")
            except Exception as exc:
                logger.warning(f"ai_pipeline.voxelizer failed: {exc}")
        if grid is None:
            grid, shape = self._inline_voxelize(verts, faces)
            result.voxel_grid = SimpleGrid(grid, shape, self.config.voxel_size_mm)
            result.metadata["grid_shape"] = list(shape)
            logger.info(f"Inline voxelized: {int(np.count_nonzero(grid))} voxel, shape {shape}")

        result.bricks = self._grid_to_bricks(grid, self.config.voxel_size_mm)
        result.metadata["brick_count"] = len(result.bricks)
        return result

    def _inline_voxelize(self, verts: np.ndarray, faces: np.ndarray) -> Tuple[np.ndarray, Tuple[int, int, int]]:
        min_b = verts.min(axis=0)
        vs = self.config.voxel_size_mm
        pad = self.config.padding
        dims = np.ceil((verts.max(axis=0) - min_b) / vs).astype(int) + 2 * pad
        dims = np.maximum(dims, 4)
        grid = np.zeros(tuple(dims), dtype=np.uint8)
        for fi in range(faces.shape[0]):
            v0, v1, v2 = verts[faces[fi]]
            xi0, yi0, zi0 = self._world_to_voxel(v0, min_b, vs)
            xi1, yi1, zi1 = self._world_to_voxel(v1, min_b, vs)
            xi2, yi2, zi2 = self._world_to_voxel(v2, min_b, vs)
            x_min, x_max = max(0, min(xi0, xi1, xi2)), min(dims[0] - 1, max(xi0, xi1, xi2))
            y_min, y_max = max(0, min(yi0, yi1, zi0)), min(dims[1] - 1, max(yi0, yi1, zi2))
            y_min, y_max = max(0, min(yi0, yi1, yi0)), min(dims[1] - 1, max(yi0, yi1, yi1))
            z_min, z_max = max(0, min(zi0, zi1, zi0)), min(dims[2] - 1, max(zi0, zi1, zi1))
            for xi in range(x_min, x_max + 1):
                for yi in range(y_min, y_max + 1):
                    for zi in range(z_min, z_max + 1):
                        px = xi * vs + min_b[0]
                        py = yi * vs + min_b[1]
                        pz = zi * vs + min_b[2]
                        p = np.array([px, py, pz], dtype=np.float32)
                        if self._point_in_triangle(p, v0, v1, v2):
                            grid[xi, yi, zi] = 1
        return grid, tuple(dims)

    def _point_in_triangle(self, p: np.ndarray, a: np.ndarray, b: np.ndarray, c: np.ndarray) -> bool:
        ab, ac = b - a, c - a
        ap = p - a
        d00 = float(np.dot(ab, ab))
        d01 = float(np.dot(ab, ac))
        d11 = float(np.dot(ac, ac))
        d20 = float(np.dot(ap, ab))
        d21 = float(np.dot(ap, ac))
        denom = d00 * d11 - d01 * d01
        if abs(denom) < 1e-10:
            return False
        u = (d11 * d20 - d01 * d21) / denom
        v = (d00 * d21 - d01 * d20) / denom
        return 0 <= u <= 1 and 0 <= v <= 1 and u + v <= 1

    def _world_to_voxel(self, p: np.ndarray, min_b: np.ndarray, vs: float) -> Tuple[int, int, int]:
        return tuple(np.round((p - min_b) / vs).astype(int).tolist())

    def _grid_to_bricks(self, grid: np.ndarray, voxel_size_mm: float) -> List[Any]:
        bricks: List[Any] = []
        if not _CORE_AVAILABLE:
            return bricks
        origin = grid.min(axis=(0, 1, 2))
        sx, sy, sz = grid.shape
        for x in range(sx):
            for y in range(sy):
                for z in range(sz):
                    if grid[x, y, z] > 0:
                        px = x * voxel_size_mm
                        py = y * voxel_size_mm
                        pz = z * voxel_size_mm
                        brick = create_brick(
                            id=next_brick_id(),
                            name=f"Voxel_{x}_{y}_{z}",
                            size_mm=[voxel_size_mm, voxel_size_mm, voxel_size_mm],
                            position_mm=[px, py, pz],
                            material=self.config.default_material,
                        )
                        bricks.append(brick)
        logger.info(f"Brick System: {len(bricks)} bricks generated")
        return bricks


@dataclass
class SimpleGrid:
    grid: np.ndarray
    shape: Tuple[int, int, int]
    voxel_size_mm: float

    @property
    def voxel_count(self) -> int:
        return int(np.count_nonzero(self.grid))

    def to_voxel_list(self) -> List[Dict[str, Any]]:
        return []
