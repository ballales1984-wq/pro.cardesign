"""
depth — Depth estimation wrapper for the Artist 3D Pipeline.
Wraps existing DepthEstimator in ai_pipeline and exposes a simple interface.
"""

from __future__ import annotations
import logging
import numpy as np

from .config import PipelineConfig, DepthConfig
from .utils import setup_logging, normalize_array

logger = setup_logging()


class DepthEstimator:
    """Estimated depth from a single RGB image."""

    def __init__(self, config: Optional[DepthConfig] = None):
        self.config = config or DepthConfig()
        self._estimator = None
        self._model_used = "none"

    def load(self) -> bool:
        try:
            from ai_pipeline.depth_estimator import DepthEstimator as OuterEst
            self._estimator = OuterEst(model=self.config.model)
            self._estimator.load()
            return True
        except Exception as exc:
            logger.warning(f"Failed to load ai_pipeline DepthEstimator: {exc}")
        try:
            from transformers import AutoImageProcessor, AutoModelForDepthEstimation
            import torch
            self._processor = AutoImageProcessor.from_pretrained(
                "depth-anything/Depth-Anything-V2-Small-hf"
            )
            self._model = AutoModelForDepthEstimation.from_pretrained(
                "depth-anything/Depth-Anything-V2-Small-hf"
            )
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self._model = self._model.to(device)
            self._model.eval()
            self._torch = torch
            self._device = device
            self._model_used = "depth-anything-small"
            return True
        except Exception as exc:
            logger.warning(f"Depth Anything load failed: {exc}")
        self._model_used = "fallback"
        return False

    def estimate(self, image: np.ndarray) -> np.ndarray:
        h, w = image.shape[:2]
        if self._estimator is not None:
            try:
                dm = self._estimator.estimate(image)
                self._model_used = dm.model_used
                return dm.data
            except Exception as exc:
                logger.warning(f"Outer depth estimator failed: {exc}")
        if hasattr(self, "_model") and self._model is not None:
            try:
                import torch
                from PIL import Image
                inputs = self._processor(images=image, return_tensors="pt")
                inputs = {k: v.to(self._device) for k, v in inputs.items()}
                with torch.no_grad():
                    outputs = self._model(**inputs)
                raw = outputs.predicted_depth.squeeze().cpu().numpy().astype(np.float32)
                pil_depth = Image.fromarray(raw)
                pil_depth = pil_depth.resize((w, h), Image.Resampling.BILINEAR)
                arr = np.array(pil_depth, dtype=np.float32)
                return normalize_array(arr, *self.config.normalize_percentiles)
            except Exception as exc:
                logger.warning(f"Depth Anything inference failed: {exc}")
        raw = _fallback_depth(image)
        return normalize_array(raw, *self.config.normalize_percentiles)

    @property
    def model_used(self) -> str:
        return self._model_used


def _fallback_depth(img: np.ndarray) -> np.ndarray:
    gray = img.mean(axis=2).astype(np.float32)
    from scipy import ndimage
    gy, gx = ndimage.sobel(gray, axis=0), ndimage.sobel(gray, axis=1)
    edges = np.sqrt(gx ** 2 + gy ** 2)
    depth = 1.0 - np.clip(edges / (edges.max() + 1e-6), 0, 1)
    depth = ndimage.gaussian_filter(depth, sigma=3)
    return depth.astype(np.float32)
