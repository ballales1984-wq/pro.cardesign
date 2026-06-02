"""
pipeline - Artist 3D Pipeline orchestrator.

Pipeline stages:
    1. Load + validate input image
    2. Detect + segment (DETR + SAM 2)
    3. Estimate depth
    4. Lift to 3D point cloud
    5. Refine with car rules
    6. Convert to Brick System

Usage:
    from artist_pipeline.pipeline import Artist3DPipeline
    result = Artist3DPipeline().process_image("car.jpg")
"""

from __future__ import annotations
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any

import numpy as np

from .config import PipelineConfig, VoxelConverterConfig
from .utils import ensure_float32
from .detectors import detect_and_segment
from .perspective import analyze_perspective
from .depth import DepthEstimator
from .lifter import Lifter
from .car_refiner import CarRefiner
from .voxel_converter import VoxelConverter

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    status: str = "ok"
    brick_count: int = 0
    brick_system: Any = None
    mesh: Any = None
    point_cloud: Any = None
    perspective_data: Any = None
    depth_map: Any = None
    segmentation_mask: Any = None
    stage_times: Dict[str, float] = field(default_factory=dict)
    errors: list = field(default_factory=list)

    def summary(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "brick_count": self.brick_count,
            "stages": {k: f"{v:.1f}ms" for k, v in self.stage_times.items()},
            "errors": self.errors,
        }


class Artist3DPipeline:
    def __init__(self, config: Optional[PipelineConfig] = None, device: str = "auto"):
        self.config = config or PipelineConfig()
        self.config.voxel_converter.voxel_size_mm = 10.0
        self._depth = DepthEstimator(config=self.config.depth)
        self._lifter = Lifter(config=self.config.lifter)
        self._refiner = CarRefiner(config=self.config.car_refiner)
        self._converter = VoxelConverter(config=self.config.voxel_converter)
        self.device = device
        logger.info("Artist3DPipeline initialized")

    def _load_image(self, path: str | Path) -> np.ndarray:
        try:
            from PIL import Image
            return np.array(Image.open(str(path)).convert("RGB"), dtype=np.uint8)
        except Exception as exc:
            logger.error(f"Image load failed: {exc}")
            raise RuntimeError(f"Cannot load image: {exc}")

    def process_image(self, image_path: str | Path, voxel_size: float = 10.0) -> PipelineResult:
        result = PipelineResult()
        t_total = time.perf_counter()
        path = str(image_path)
        try:
            image = self._load_image(path)
        except Exception as exc:
            result.status = "error"
            result.errors.append(str(exc))
            return result
        self.config.voxel_converter.voxel_size_mm = voxel_size
        t0 = time.perf_counter()
        seg_img, mask = detect_and_segment(image, config=self.config)
        result.segmentation_mask = mask
        result.stage_times["detect_segment"] = (time.perf_counter() - t0) * 1000
        t0 = time.perf_counter()
        perspective_data = analyze_perspective(image, mask=mask, config=self.config.perspective)
        result.perspective_data = perspective_data
        result.stage_times["perspective"] = (time.perf_counter() - t0) * 1000
        t0 = time.perf_counter()
        raw_depth = self._depth.estimate(seg_img)
        result.depth_map = {"data": raw_depth, "model": self._depth.model_used}
        result.stage_times["depth"] = (time.perf_counter() - t0) * 1000
        t0 = time.perf_counter()
        point_cloud = self._lifter.lift(
            raw_depth,
            image=seg_img,
            mask=mask,
            perspective_data=perspective_data,
        )
        result.point_cloud = point_cloud
        result.stage_times["lifting"] = (time.perf_counter() - t0) * 1000
        t0 = time.perf_counter()
        refined = self._refiner.refine(point_cloud)
        result.mesh = refined
        result.stage_times["car_refine"] = (time.perf_counter() - t0) * 1000
        t0 = time.perf_counter()
        try:
            brick_system = self._converter.convert(refined, config=self.config)
            result.brick_system = brick_system
            result.brick_count = brick_system.brick_count
        except Exception as exc:
            logger.warning(f"Voxel conversion failed: {exc}")
            result.errors.append(f"Voxel conversion failed: {exc}")
        result.stage_times["voxel_convert"] = (time.perf_counter() - t0) * 1000
        result.stage_times["total"] = (time.perf_counter() - t_total) * 1000
        result.status = "ok" if result.brick_count > 0 else "partial"
        logger.info(f"Pipeline result: {result.summary()}")
        return result

    def process_point_cloud(self, point_cloud, config: Optional[PipelineConfig] = None):
        cfg = config or self.config
        result = PipelineResult()
        t0 = time.perf_counter()
        refined = self._refiner.refine(point_cloud)
        result.mesh = refined
        result.stage_times["car_refine"] = (time.perf_counter() - t0) * 1000
        try:
            brick_system = self._converter.convert(refined, config=cfg)
            result.brick_system = brick_system
            result.brick_count = brick_system.brick_count
        except Exception as exc:
            result.errors.append(str(exc))
        result.status = "ok" if result.brick_count > 0 else "partial"
        return result
