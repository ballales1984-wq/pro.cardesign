from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
import os

ROOT_DIR = Path(__file__).resolve().parent
MODEL_DIR = ROOT_DIR / "models"
OUTPUT_DIR = ROOT_DIR / "outputs"


def default_device() -> str:
    env_device = os.environ.get("AI_DEVICE", "").lower()
    if env_device in {"cuda", "gpu", "cpu"}:
        return env_device
    return "cuda" if os.environ.get("CUDA_VISIBLE_DEVICES") else "cpu"


@dataclass
class Config:
    root_dir: Path = ROOT_DIR
    model_dir: Path = MODEL_DIR
    output_dir: Path = OUTPUT_DIR
    device: str = field(default_factory=default_device)
    detection_model_name: str = "yolov11-car"
    segmentation_model_name: str = "sam-v3"
    perspective_model_name: str = "neurvps"
    depth_model_name: str = "depth-anything-v2-large"
    lifting_strategy: str = "simple-point-cloud"
    refiner_profile: str = "car-concept"
    voxel_size_mm: float = 1.0
    output_mesh_format: str = "ply"
    staging_enabled: bool = True
    stage_order: list[str] = field(default_factory=lambda: [
        "detection",
        "segmentation",
        "perspective",
        "depth",
        "lifting",
        "refiner",
        "voxelization",
    ])


def ensure_directories() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
