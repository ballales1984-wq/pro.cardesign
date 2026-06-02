from __future__ import annotations
import numpy as np
from typing import Any
from .base_stage import BaseStage
from ..config import Config


class PerspectiveStage(BaseStage):
    name = "perspective"
    model_name = "simple-perspective"

    def _compute_vanishing_points(self, image_np: np.ndarray) -> list[dict[str, int]]:
        try:
            import cv2
        except Exception:
            return []

        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180.0, 80, minLineLength=30, maxLineGap=20)
        if lines is None:
            return []

        pts = []
        for line in lines[:8]:
            x1, y1, x2, y2 = line[0]
            pts.append({"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)})
        return pts

    def run(self, image: Any, context: dict[str, Any], config: Config) -> dict[str, Any]:
        image_np = np.array(image.convert("RGB")) if hasattr(image, "convert") else np.array(image)
        height, width = image_np.shape[:2]
        return {
            "model_used": self.model_name,
            "camera": {
                "fx": 500.0,
                "fy": 500.0,
                "cx": float(width) / 2.0,
                "cy": float(height) / 2.0,
                "fov": 60.0,
            },
            "vanishing_points": self._compute_vanishing_points(image_np),
        }
