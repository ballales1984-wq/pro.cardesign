from __future__ import annotations
from typing import Any
from .base_stage import BaseStage
from ..config import Config


class DetectionStage(BaseStage):
    name = "detection"
    model_name = "light-bbox"

    def run(self, image: Any, context: dict[str, Any], config: Config) -> dict[str, Any]:
        width, height = image.size if hasattr(image, "size") else (image.shape[1], image.shape[0])
        bbox = {
            "x": int(width * 0.05),
            "y": int(height * 0.05),
            "w": int(width * 0.9),
            "h": int(height * 0.9),
        }
        return {
            "model_used": self.model_name,
            "objects": [{"label": "car", "bbox": bbox, "confidence": 0.75}],
            "car_bbox": bbox,
        }
