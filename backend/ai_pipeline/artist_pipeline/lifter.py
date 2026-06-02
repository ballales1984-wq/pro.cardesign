"""
lifter — 2D Depth Map → 3D Point Cloud for the Artist 3D Pipeline.
Uses pinhole camera intrinsics (fx, fy, cx, cy) to project pixels into 3D.
"""

from __future__ import annotations
import logging
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, List, Tuple

from .config import PipelineConfig, LifterConfig
from .utils import setup_logging, clamp

logger = setup_logging()


@dataclass
class Point3D:
    x: float
    y: float
    z: float
    r: float = 0.5
    g: float = 0.5
    b: float = 0.5


@dataclass
class PointCloud:
    points: np.ndarray      # (N, 3) float32
    colors: np.ndarray      # (N, 3) float32 [0..1]
    normals: Optional[np.ndarray] = None
    source_shape: Tuple[int, int] = (0, 0)
    camera_params: dict = field(default_factory=dict)

    def __post_init__(self):
        self.camera_params.setdefault("fx", 500.0)
        self.camera_params.setdefault("fy", 500.0)
        if "cx" not in self.camera_params and self.source_shape != (0, 0):
            self.camera_params["cx"] = self.source_shape[1] / 2.0
        self.camera_params.setdefault("cx", 0.0)
        if "cy" not in self.camera_params and self.source_shape != (0, 0):
            self.camera_params["cy"] = self.source_shape[0] / 2.0
        self.camera_params.setdefault("cy", 0.0)

    @property
    def num_points(self) -> int:
        return int(self.points.shape[0])

    def bounds(self) -> Tuple[np.ndarray, np.ndarray]:
        return self.points.min(axis=0), self.points.max(axis=0)

    def subsample(self, max_points: int) -> "PointCloud":
        n = self.points.shape[0]
        if n <= max_points:
            return self
        idx = np.random.choice(n, size=max_points, replace=False)
        return PointCloud(
            points=self.points[idx],
            colors=self.colors[idx],
            normals=self.normals[idx] if self.normals is not None else None,
            source_shape=self.source_shape,
            camera_params=self.camera_params,
        )


class Lifter:
    """Project a depth map into 3D using camera intrinsics."""

    def __init__(self, config: Optional[LifterConfig] = None):
        self.config = config or LifterConfig()

    def lift(
        self,
        depth_map: np.ndarray,
        image: Optional[np.ndarray] = None,
        mask: Optional[np.ndarray] = None,
        perspective_data=None,
    ) -> PointCloud:
        h, w = depth_map.shape[:2]
        fx = self.config.fx
        fy = self.config.fy
        if perspective_data is not None and perspective_data.focal_length is not None:
            fx = fy = float(perspective_data.focal_length)
        cx, cy = w / 2.0, h / 2.0
        max_pts = self.config.max_points
        sx = max(1, int(np.sqrt(w * h / max_pts * (w / h))))
        sy = max(1, int(np.sqrt(w * h / max_pts * (h / w))))
        points_list: List[np.ndarray] = []
        colors_list: List[np.ndarray] = []
        img_arr = image if image is not None else None
        if mask is not None and mask.ndim == 3:
            mask = mask.mean(axis=2).astype(np.uint8)
        for y in range(0, h, sy):
            for x in range(0, w, sx):
                d = float(depth_map[y, x] if depth_map.ndim == 2 else depth_map[y, x, 0])
                if d <= 0.001 or d > 1.0:
                    continue
                if mask is not None and mask[y, x] == 0:
                    continue
                px = (x - cx) * d / fx * self.config.scale_xy
                py = (y - cy) * d / fy * self.config.scale_xy
                pz = d * self.config.scale_z
                if img_arr is not None and img_arr.ndim == 3:
                    col = img_arr[y, x, :3].astype(np.float32) / 255.0
                else:
                    col = np.array([0.5, 0.5, 0.5], dtype=np.float32)
                points_list.append(np.array([px, py, pz], dtype=np.float32))
                colors_list.append(col)
        if not points_list:
            return PointCloud(
                points=np.zeros((1, 3), dtype=np.float32),
                colors=np.ones((1, 3), dtype=np.float32) * 0.5,
                source_shape=(h, w),
                camera_params={"fx": fx, "fy": fy, "cx": cx, "cy": cy},
            )
        pts = np.vstack(points_list)
        cols = np.vstack(colors_list)
        logger.info(f"Lifter: {pts.shape[0]} punti da {w}x{h} depth map")
        return PointCloud(
            points=pts,
            colors=cols,
            source_shape=(h, w),
            camera_params={"fx": fx, "fy": fy, "cx": cx, "cy": cy},
        )
