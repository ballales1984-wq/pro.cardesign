"""
perspective — Perspective analysis for the Artist 3D Pipeline.
Detects:
  - Vanishing points (horizon line)
  - Camera focal length estimate
  - Ground plane orientation
"""

from __future__ import annotations
import logging
import time
from dataclasses import dataclass, field
from typing import Optional, List, Tuple

import numpy as np

from .config import PerspectiveConfig
from .utils import setup_logging, clamp

logger = setup_logging()


@dataclass
class PerspectiveData:
    vanishing_points: List[np.ndarray] = field(default_factory=list)
    horizon_y: Optional[float] = None
    focal_length: Optional[float] = None
    confidence: float = 0.0
    method: str = "none"
    inference_time_ms: float = 0.0

    def has_valid_estimate(self) -> bool:
        return len(self.vanishing_points) >= 1 and self.focal_length is not None


def _detect_lines_edges(image: np.ndarray, max_lines: int = 200) -> np.ndarray:
    gray = image.mean(axis=2) if image.ndim == 3 else image.astype(np.float32)
    from scipy import ndimage
    gx = ndimage.sobel(gray, axis=1)
    gy = ndimage.sobel(gray, axis=0)
    magnitude = np.sqrt(gx ** 2 + gy ** 2)
    p_low, p_high = np.percentile(magnitude, 90), np.percentile(magnitude, 99)
    magnitude = np.clip((magnitude - p_low) / (p_high - p_low + 1e-6), 0, 1)
    return magnitude


def _hough_line_detection(edge_map: np.ndarray, threshold: float = 0.3) -> List[Tuple[float, float, float]]:
    h, w = edge_map.shape
    diag = int(np.ceil(np.sqrt(h ** 2 + w ** 2)))
    thetas = np.linspace(-np.pi / 2, np.pi / 2, 180, endpoint=False)
    rhos = np.linspace(-diag, diag, 2 * diag)
    accumulator = np.zeros((len(rhos), len(thetas)), dtype=np.int32)
    ys, xs = np.where(edge_map > threshold)
    if len(xs) == 0:
        return []
    theta_idx = np.searchsorted(thetas, np.arctan2(ys - h / 2, xs - w / 2))
    theta_idx = np.clip(theta_idx, 0, len(thetas) - 1)
    rho_vals = (xs * np.cos(thetas[theta_idx]) + ys * np.sin(thetas[theta_idx])).astype(int)
    rho_idx = rho_vals + diag
    valid = (rho_idx >= 0) & (rho_idx < len(rhos))
    np.add.at(accumulator, (rho_idx[valid], theta_idx[valid]), 1)
    lines = []
    thresh_count = max(2, int(len(xs) * 0.002))
    indices = np.argwhere(accumulator > thresh_count)
    flat = accumulator.ravel()
    top_k = min(max(len(indices), 1), 200)
    best_indices = np.argsort(flat)[-top_k:][::-1]
    for idx in best_indices:
        if flat[idx] <= thresh_count:
            break
        ri, ti = divmod(int(idx), len(thetas))
        rho = float(rhos[ri])
        theta = float(thetas[ti])
        cos_t, sin_t = np.cos(theta), np.sin(theta)
        x0 = cos_t * rho
        y0 = sin_t * rho
        dx = -sin_t * 1000
        dy = cos_t * 1000
        lines.append((x0, y0, x0 + dx, y0 + dy))
    return lines


def _cluster_vanishing_points(lines: List[Tuple[float, float, float, float]], h: int, w: int) -> List[np.ndarray]:
    if not lines:
        return []
    intersections = []
    for i in range(len(lines)):
        for j in range(i + 1, len(lines)):
            x1, y1, x2, y2 = lines[i]
            x3, y3, x4, y4 = lines[j]
            denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
            if abs(denom) < 1e-6:
                continue
            px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom
            py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom
            margin = max(w, h) * 2
            if -margin < px < w + margin and -margin < py < h + margin:
                intersections.append((px, py))
    if not intersections:
        return []
    pts = np.array(intersections, dtype=np.float32)
    from sklearn.cluster import KMeans
    n_clusters = min(3, len(pts))
    kmeans = KMeans(n_clusters=n_clusters, n_init=5, random_state=42)
    labels = kmeans.fit_predict(pts)
    vps = [np.mean(pts[labels == i], axis=0) for i in range(n_clusters)]
    return vps


def _estimate_focal_length(vps: List[np.ndarray], w: int, h: int) -> Optional[float]:
    if len(vps) < 2:
        return None
    principal = np.array([w / 2.0, h / 2.0])
    good = [v for v in vps if v[1] > 0 and v[1] < h]
    def focal_for(p1: np.ndarray, p2: np.ndarray) -> Optional[float]:
        dx1, dy1 = p1[0] - principal[0], p1[1] - principal[1]
        dx2, dy2 = p2[0] - principal[0], p2[1] - principal[1]
        dot = dx1 * dx2 + dy1 * dy2
        n1, n2 = np.sqrt(dx1 ** 2 + dy1 ** 2), np.sqrt(dx2 ** 2 + dy2 ** 2)
        if n1 < 1 or n2 < 1:
            return None
        cos_theta = clamp(dot / (n1 * n2), -1.0, 1.0)
        if cos_theta >= 1.0 - 1e-3:
            return None
        return np.sqrt(-1.0 / (2.0 * (cos_theta - 1.0))) * max(w, h)
    focal_values = []
    for i in range(len(good)):
        for j in range(i + 1, len(good)):
            f = focal_for(good[i], good[j])
            if f is not None and 100 < f < 3000:
                focal_values.append(f)
    if not focal_values:
        return None
    return float(np.median(focal_values))


def analyze_perspective(
    image: np.ndarray,
    mask: Optional[np.ndarray] = None,
    config: Optional[PerspectiveConfig] = None,
) -> PerspectiveData:
    """Extract perspective features from the image.

    Uses edge detection + Hough line detection + vanishing point clustering.
    """
    if config is None:
        config = PerspectiveConfig()
    h, w = image.shape[:2]
    t0 = time.perf_counter()

    if mask is not None:
        masked = image.copy()
        masked[mask == 0] = 0
        edge_map = _detect_lines_edges(masked)
    else:
        edge_map = _detect_lines_edges(image)

    lines = _hough_line_detection(edge_map, threshold=float(config.min_line_count))
    vps = _cluster_vanishing_points(lines, h, w)
    focal = _estimate_focal_length(vps, w, w)
    dt = (time.perf_counter() - t0) * 1000

    horizon_y = None
    if vps:
        horizon_y = float(np.median([v[1] for v in vps]))

    data = PerspectiveData(
        vanishing_points=[np.array(v, dtype=np.float32) for v in vps],
        horizon_y=horizon_y,
        focal_length=focal if focal is not None else config.default_focal_length,
        confidence=float(min(len(vps) / 3.0, 1.0)),
        method="opencv+hough",
        inference_time_ms=dt,
    )
    logger.info(f"Perspective: {len(vps)} VPs, focal={data.focal_length:.1f}, horizon_y={horizon_y}")
    return data
