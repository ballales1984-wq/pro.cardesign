"""
config — Configuration for the Artist 3D Pipeline.
Centralizes all parameters so they can be adjusted without touching module code.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class DetectionConfig:
    """Object detection and segmentation (SAM 2) settings."""
    model_name: str = "facebook/sam2-hiera-small"
    device: str = "auto"
    confidence_threshold: float = 0.5
    fallback_to_full_image: bool = True


@dataclass
class PerspectiveConfig:
    """Perspective analysis settings."""
    detector_type: str = "opencv"
    min_line_count: int = 10
    ransac_threshold: float = 5.0
    default_focal_length: float = 500.0


@dataclass
class DepthConfig:
    """Depth estimation settings."""
    model: str = "auto"  # auto | depth-anything-small | midas-dpt-large | fallback
    normalize_percentiles: tuple = field(default=(2.0, 98.0))


@dataclass
class LifterConfig:
    """2D-to-3D lifting settings."""
    fx: float = 500.0
    fy: float = 500.0
    scale_xy: float = 100.0
    scale_z: float = 100.0
    max_points: int = 50000


@dataclass
class CarRefinerConfig:
    """Car-specific mesh refinement settings."""
    symmetry_threshold: float = 0.8
    wheel_radius_mm: float = 300.0
    wheel_width_mm: float = 250.0
    body_height_mm: float = 1500.0
    body_length_mm: float = 4500.0


@dataclass
class VoxelConverterConfig:
    """Voxel conversion settings."""
    voxel_size_mm: float = 10.0
    padding: int = 2
    method: str = "grid_walk"
    default_material: str = "steel"


@dataclass
class PipelineConfig:
    """Top-level pipeline configuration."""
    detection: DetectionConfig = field(default_factory=DetectionConfig)
    perspective: PerspectiveConfig = field(default_factory=PerspectiveConfig)
    depth: DepthConfig = field(default_factory=DepthConfig)
    lifter: LifterConfig = field(default_factory=LifterConfig)
    car_refiner: CarRefinerConfig = field(default_factory=CarRefinerConfig)
    voxel_converter: VoxelConverterConfig = field(default_factory=VoxelConverterConfig)

    output_dir: Optional[Path] = None
    save_intermediate: bool = False
    log_level: str = "INFO"


def get_default_config() -> PipelineConfig:
    """Return a PipelineConfig with sensible defaults."""
    return PipelineConfig()
