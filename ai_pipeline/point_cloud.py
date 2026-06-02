"""
point_cloud — Depth map → Point Cloud (Livello 1)
Converte una DepthMap normalizzata in una nuvola di punti 3D
con parametri camera intrinseci.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple, List
import logging

logger = logging.getLogger(__name__)


@dataclass
class Point3D:
    x: float
    y: float
    z: float
    r: float = 0.5
    g: float = 0.5
    b: float = 0.5

    def to_array(self) -> np.ndarray:
        return np.array([self.x, self.y, self.z], dtype=np.float32)


@dataclass
class PointCloud:
    points: np.ndarray   # (N, 3) float32
    colors: np.ndarray   # (N, 3) float32, 0..1
    normals: Optional[np.ndarray] = None  # (N, 3) float32
    source_shape: Tuple[int, int] = (0, 0)
    camera_params: dict = field(default_factory=dict)

    @property
    def num_points(self) -> int:
        return int(self.points.shape[0])

    def bounds(self) -> Tuple[np.ndarray, np.ndarray]:
        min_b = self.points.min(axis=0)
        max_b = self.points.max(axis=0)
        return min_b, max_b

    def save_ply(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        n = self.num_points
        colors_uint8 = (self.colors * 255).astype(np.uint8)
        lines = [
            "ply",
            "format binary_little_endian 1.0",
            f"element vertex {n}",
            "property float x",
            "property float y",
            "property float z",
            "property uchar red",
            "property uchar green",
            "property uchar blue",
            "end_header\n",
        ]
        header = "\n".join(lines).encode()
        vertex_data = np.hstack([self.points.astype(np.float32),
                                  colors_uint8.astype(np.uint8)]).tobytes()
        path.write_bytes(header + vertex_data)
        (path.parent / (path.stem + "_meta.json")).write_text(
            f'{{"points": {n}, "bounds": {str(list(self.bounds()))}}}\n'
        )
        return path

    def save_npz(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez(path, points=self.points, colors=self.colors,
                 source_shape=np.array(self.source_shape))
        return path


class DepthToPointCloud:
    def __init__(self, fx: float = 500.0, fy: float = 500.0,
                 cx: Optional[float] = None, cy: Optional[float] = None):
        self.fx = fx
        self.fy = fy
        self.cx = cx
        self.cy = cy

    def convert(self, depth_map, image: Optional[np.ndarray] = None,
                scale_xy: float = 100.0, scale_z: float = 100.0,
                mask: Optional[np.ndarray] = None,
                max_points: int = 50000) -> PointCloud:
        h = depth_map.height
        w = depth_map.width
        depth_data = depth_map.data

        cx = self.cx if self.cx is not None else w / 2.0
        cy = self.cy if self.cy is not None else h / 2.0

        step_x = max(1, int(np.sqrt(w * h / max_points * (w / h))))
        step_y = max(1, int(np.sqrt(w * h / max_points * (h / w))))

        points_list: List[np.ndarray] = []
        colors_list: List[np.ndarray] = []

        img_arr = image if image is not None else None

        for y in range(0, h, step_y):
            for x in range(0, w, step_x):
                idx = y * w + x
                d = float(depth_data[idx])
                if d <= 0 or d > 1.0:
                    continue
                if mask is not None and mask[idx] == 0:
                    continue

                px = (x - cx) * d / self.fx * w / scale_xy
                py = (y - cy) * d / self.fy * h / scale_xy
                pz = d * scale_z

                if img_arr is not None and len(img_arr.shape) == 3:
                    col = img_arr[y, x, :3].astype(np.float32) / 255.0
                else:
                    col = np.array([0.5, 0.5, 0.5], dtype=np.float32)

                points_list.append(np.array([px, py, pz], dtype=np.float32))
                colors_list.append(col)

        if not points_list:
            points_arr = np.zeros((1, 3), dtype=np.float32)
            colors_arr = np.ones((1, 3), dtype=np.float32) * 0.5
        else:
            points_arr = np.vstack(points_list)
            colors_arr = np.vstack(colors_list)

        logger.info(f"PointCloud: {points_arr.shape[0]} punti da {w}x{h} depth map")
        return PointCloud(
            points=points_arr, colors=colors_arr,
            source_shape=(h, w),
            camera_params={"fx": self.fx, "fy": self.fy, "cx": cx, "cy": cy}
        )
