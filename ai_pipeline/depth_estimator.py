"""
depth_estimator — Depth Estimation da singola immagine
Livello 1 della pipeline Meshy.
Supporta: Depth Anything V2, MiDaS, fallback edge-based.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class DepthMap:
    width: int
    height: int
    data: np.ndarray  # float32, 0..1 normalizzato
    model_used: str = "fallback"
    raw_depth: Optional[np.ndarray] = None

    def save(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        np.save(path.with_suffix(".npy"), self.data)
        (path.parent / (path.stem + "_meta.json")).write_text(
            f'{{"width": {self.width}, "height": {self.height}, "model": "{self.model_used}"}}\n'
        )
        return path


def _fallback_depth(img: np.ndarray) -> np.ndarray:
    """Depth estimation fallback basata su edge detection + blur gaussiano."""
    h, w = img.shape[:2]
    gray = img.mean(axis=2) if len(img.shape) > 2 else img
    gy, gx = np.gradient(gray.astype(np.float32))
    edges = np.sqrt(gx ** 2 + gy ** 2)
    depth = 1.0 - np.clip(edges / (edges.max() + 1e-6), 0, 1)
    from scipy import ndimage
    depth = ndimage.gaussian_filter(depth, sigma=3)
    return depth.astype(np.float32)


def _normalize(depth: np.ndarray, p_low: float = 2.0, p_high: float = 98.0) -> np.ndarray:
    pl = np.percentile(depth, p_low)
    ph = np.percentile(depth, p_high)
    rng = max(ph - pl, 1e-6)
    return np.clip((depth - pl) / rng, 0, 1).astype(np.float32)


class DepthEstimator:
    def __init__(self, model: str = "auto"):
        self.model_name = model
        self._session = None
        self._model = None

    def load(self) -> bool:
        if self._session is not None:
            return True
        try:
            from transformers import AutoImageProcessor, AutoModelForDepthEstimation
            import torch
            self._model_name_loaded = "depth-anything-small"
            self._processor = AutoImageProcessor.from_pretrained(
                "depth-anything/Depth-Anything-V2-Small-hf"
            )
            self._model = AutoModelForDepthEstimation.from_pretrained(
                "depth-anything/Depth-Anything-V2-Small-hf"
            )
            self._torch = torch
            self._session = True
            return True
        except Exception as e:
            logger.warning(f"Depth Anything V2 load failed: {e}. Trying MiDaS...")
        try:
            from transformers import DPTImageProcessor, DPTForDepthEstimation
            import torch
            self._model_name_loaded = "midas-dpt-large"
            self._processor = DPTImageProcessor.from_pretrained("Intel/dpt-large")
            self._model = DPTForDepthEstimation.from_pretrained("Intel/dpt-large")
            self._torch = torch
            self._session = True
            return True
        except Exception as e:
            logger.warning(f"MiDaS DPT load failed: {e}")
        self._model_name_loaded = "fallback"
        self._session = True
        return False

    def estimate(self, image: np.ndarray) -> DepthMap:
        self.load()
        h, w = image.shape[:2]
        if self._model is not None and self._session is True and self._model_name_loaded != "fallback":
            return self._run_model(image, w, h)
        raw = _fallback_depth(image)
        norm = _normalize(raw)
        return DepthMap(width=w, height=h, data=norm,
                        model_used="fallback_edge", raw_depth=raw)

    def _run_model(self, image: np.ndarray, w: int, h: int) -> DepthMap:
        import torch
        inputs = self._processor(images=image, return_tensors="pt")
        with torch.no_grad():
            outputs = self._model(**inputs)
            pred = outputs.predicted_depth
        depth = pred.squeeze().cpu().numpy().astype(np.float32)
        from PIL import Image
        depth_img = Image.fromarray(depth)
        depth_img = depth_img.resize((w, h), Image.Resampling.BILINEAR)
        depth_arr = np.array(depth_img, dtype=np.float32)
        norm = _normalize(depth_arr)
        return DepthMap(width=w, height=h, data=norm,
                        model_used=self._model_name_loaded, raw_depth=depth_arr)
