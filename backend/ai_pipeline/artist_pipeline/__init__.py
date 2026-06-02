"""
artist_pipeline — Artist Intelligence Pipeline
Image → Brick System v1.0
"""

from __future__ import annotations
from .pipeline import Artist3DPipeline, PipelineResult
from .config import PipelineConfig, get_default_config
from .detectors import detect_and_segment, DetectionResult, SegmentationResult
from .perspective import analyze_perspective, PerspectiveData
from .depth import DepthEstimator
from .lifter import Lifter, PointCloud as LifterPointCloud
from .car_refiner import CarRefiner, RefinedMesh
from .voxel_converter import VoxelConverter, BrickSystemResult
from .utils import setup_logging

__all__ = [
    "Artist3DPipeline",
    "PipelineResult",
    "PipelineConfig",
    "get_default_config",
    "detect_and_segment",
    "DetectionResult",
    "SegmentationResult",
    "analyze_perspective",
    "PerspectiveData",
    "DepthEstimator",
    "Lifter",
    "LifterPointCloud",
    "CarRefiner",
    "RefinedMesh",
    "VoxelConverter",
    "BrickSystemResult",
    "setup_logging",
]
