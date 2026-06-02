"""
utils — Shared utility functions for the Artist 3D Pipeline.
"""

from __future__ import annotations
import logging
import numpy as np
from pathlib import Path
from typing import Optional, Tuple


logger = logging.getLogger(__name__)


def ensure_float32(arr: np.ndarray) -> np.ndarray:
    if arr.dtype != np.float32:
        return arr.astype(np.float32)
    return arr


def clamp(value: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(value, max_val))


def normalize_array(arr: np.ndarray, p_low: float = 2.0, p_high: float = 98.0) -> np.ndarray:
    arr = arr.astype(np.float32)
    pl = np.percentile(arr, p_low)
    ph = np.percentile(arr, p_high)
    rng = max(ph - pl, 1e-6)
    return np.clip((arr - pl) / rng, 0, 1).astype(np.float32)


def compute_bounds(points: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    min_b = points.min(axis=0)
    max_b = points.max(axis=0)
    return min_b, max_b


def voxelize_points(
    points: np.ndarray,
    voxel_size_mm: float,
    origin_mm: np.ndarray,
) -> Tuple[np.ndarray, Tuple[int, int, int]]:
    min_b = points.min(axis=0)
    max_b = points.max(axis=0)
    dims = np.ceil((max_b - min_b) / voxel_size_mm).astype(int) + 1
    dims = np.maximum(dims, 4)
    grid = np.zeros(tuple(dims), dtype=np.uint8)
    for p in points:
        ix, iy, iz = np.round((p - min_b) / voxel_size_mm).astype(int)
        if 0 <= ix < dims[0] and 0 <= iy < dims[1] and 0 <= iz < dims[2]:
            grid[ix, iy, iz] = 1
    origin = tuple((min_b - origin_mm).tolist())
    return grid, tuple(dims)


def setup_logging(level: str = "INFO") -> logging.Logger:
    numeric = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(level=numeric, format="[%(name)s] %(levelname)s: %(message)s")
    return logging.getLogger("artist_pipeline")


def image_to_numpy(image) -> np.ndarray:
    try:
        from PIL import Image
        if isinstance(image, Image.Image):
            return np.array(image.convert("RGB"), dtype=np.uint8)
    except ImportError:
        pass
    return np.array(image, dtype=np.uint8)


def bbox_area(bbox) -> float:
    return (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
