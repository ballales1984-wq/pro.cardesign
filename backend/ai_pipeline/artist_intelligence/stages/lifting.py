from __future__ import annotations
import numpy as np
from typing import Any, Optional
from .base_stage import BaseStage
from ..config import Config

try:
    from ai_pipeline.point_cloud import DepthToPointCloud
except Exception:
    DepthToPointCloud = None


class LiftingStage(BaseStage):
    name = "lifting"
    model_name = "simple-point-cloud"

    def run(self, image: Any, context: dict[str, Any], config: Config) -> dict[str, Any]:
        depth_output = context.get("depth", {})
        depth_map = depth_output.get("depth_map")
        image_np = np.array(image.convert("RGB")) if hasattr(image, "convert") else np.array(image)
        mask: Optional[np.ndarray] = None
        segmentation_output = context.get("segmentation", {})
        if segmentation_output:
            mask = segmentation_output.get("mask")
        if DepthToPointCloud is not None and depth_map is not None:
            pc_converter = DepthToPointCloud()
            pc = pc_converter.convert(depth_map, image=image_np, mask=mask)
            return {
                "model_used": self.model_name,
                "point_cloud": pc,
            }

        from ai_pipeline.point_cloud import PointCloud
        fallback_pc = PointCloud(
            points=np.zeros((1, 3), dtype=np.float32),
            colors=np.ones((1, 3), dtype=np.float32) * 0.5,
            source_shape=(image_np.shape[0], image_np.shape[1]),
        )
        return {
            "model_used": "fallback_pointcloud",
            "point_cloud": fallback_pc,
        }
