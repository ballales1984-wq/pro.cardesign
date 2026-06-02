from __future__ import annotations
import numpy as np
from typing import Any
from .base_stage import BaseStage
from ..config import Config

try:
    from ai_pipeline.segmenter import CarSegmenter
except Exception:
    CarSegmenter = None


class SAMSegmentationStage(BaseStage):
    name = "segmentation"
    model_name = "sam2-hiera-small"

    def run(self, image: Any, context: dict[str, Any], config: Config) -> dict[str, Any]:
        image_np = np.array(image.convert("RGB")) if hasattr(image, "convert") else np.array(image)

        if CarSegmenter is not None:
            segmenter = CarSegmenter()
            try:
                mask_result = segmenter.segment_car(image_np)
                return {
                    "model_used": mask_result.model_used,
                    "mask": mask_result.mask,
                    "bboxes": mask_result.bboxes,
                    "labels": getattr(mask_result, "labels", []),
                }
            except Exception:
                pass

        height, width = image_np.shape[:2]
        fallback_mask = np.ones((height, width), dtype=np.uint8) * 255
        return {
            "model_used": "fallback_full_mask",
            "mask": fallback_mask,
            "bboxes": [],
            "labels": [],
        }
