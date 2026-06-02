from __future__ import annotations
import numpy as np
from typing import Any
from .base_stage import BaseStage
from ..config import Config

try:
    from ai_pipeline.depth_estimator import DepthEstimator
except Exception:
    DepthEstimator = None


class DepthStage(BaseStage):
    name = "depth"
    model_name = "depth-anything-v2-small"

    def run(self, image: Any, context: dict[str, Any], config: Config) -> dict[str, Any]:
        image_np = np.array(image.convert("RGB")) if hasattr(image, "convert") else np.array(image)

        if DepthEstimator is not None:
            estimator = DepthEstimator(model="auto")
            try:
                depth_map = estimator.estimate(image_np)
                return {
                    "model_used": depth_map.model_used,
                    "depth_map": depth_map,
                }
            except Exception:
                pass

        height, width = image_np.shape[:2]
        fallback = np.ones((height, width), dtype=np.float32) * 0.5
        from dataclasses import dataclass
        from ai_pipeline.depth_estimator import DepthMap
        depth_map = DepthMap(width=width, height=height, data=fallback, model_used="fallback")
        return {
            "model_used": depth_map.model_used,
            "depth_map": depth_map,
        }
