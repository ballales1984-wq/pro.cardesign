from __future__ import annotations
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional, Type

from .config import Config, ensure_directories
from .stages import (
    DetectionStage,
    LiftingStage,
    PerspectiveStage,
    RefinerStage,
    SAMSegmentationStage,
    VoxelizationStage,
    DepthStage,
)

STAGE_REGISTRY: dict[str, Type[object]] = {
    "detection": DetectionStage,
    "segmentation": SAMSegmentationStage,
    "perspective": PerspectiveStage,
    "depth": DepthStage,
    "lifting": LiftingStage,
    "refiner": RefinerStage,
    "voxelization": VoxelizationStage,
}


@dataclass
class StageResult:
    name: str
    success: bool = False
    output: Any = None
    metadata: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


@dataclass
class PipelineResult:
    success: bool = True
    stage_results: dict[str, StageResult] = field(default_factory=dict)
    outputs: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)

    def summary(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "stages": [
                {"name": name, "success": stage.success}
                for name, stage in self.stage_results.items()
            ],
            "errors": self.errors,
            "metadata": self.metadata,
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "outputs": self.outputs,
            "metadata": self.metadata,
            "errors": self.errors,
            "stage_results": {
                name: {
                    "success": stage.success,
                    "metadata": stage.metadata,
                    "error": stage.error,
                    "output": stage.output,
                }
                for name, stage in self.stage_results.items()
            },
        }


class ArtistPipeline:
    def __init__(self, config: Config | None = None) -> None:
        self.config = config or Config()
        ensure_directories()
        self.stages = self._build_stage_sequence()

    def _build_stage_sequence(self) -> list[object]:
        ordered_names = [name.lower() for name in self.config.stage_order]
        stages: list[object] = []

        for stage_name in ordered_names:
            stage_cls = STAGE_REGISTRY.get(stage_name)
            if not stage_cls:
                continue
            stages.append(stage_cls())

        if not stages:
            stages = [STAGE_REGISTRY[name]() for name in STAGE_REGISTRY]

        return stages

    def run(self, image_path: str | Path, options: Optional[dict[str, Any]] = None) -> PipelineResult:
        options = options or {}
        result = PipelineResult()
        image_path = Path(image_path)

        if not image_path.exists():
            result.success = False
            result.errors.append(f"Image not found: {image_path}")
            return result

        image = self._load_image(image_path)
        context: dict[str, Any] = {
            "config": self.config,
            "options": options,
            "image_path": image_path,
            "image": image,
            "started_at": time.time(),
        }

        for stage in self.stages:
            stage_name = getattr(stage, "name", stage.__class__.__name__.lower())
            stage_start = time.time()
            try:
                stage_output = stage.run(image=image, context=context, config=self.config)
                stage_metadata = {
                    "model": getattr(stage, "model_name", None),
                    "duration_sec": time.time() - stage_start,
                }
                result.stage_results[stage_name] = StageResult(
                    name=stage_name,
                    success=True,
                    output=stage_output,
                    metadata=stage_metadata,
                )
                context[stage_name] = stage_output
            except Exception as exc:
                stage_metadata = {
                    "model": getattr(stage, "model_name", None),
                    "duration_sec": time.time() - stage_start,
                }
                error_message = f"{stage_name} failed: {exc}"
                result.errors.append(error_message)
                result.stage_results[stage_name] = StageResult(
                    name=stage_name,
                    success=False,
                    output=None,
                    metadata=stage_metadata,
                    error=str(exc),
                )
                if stage_name == "detection":
                    break
                context[stage_name] = None

        result.outputs = {
            name: stage.output for name, stage in result.stage_results.items() if stage.output is not None
        }
        result.metadata = {
            "duration_sec": time.time() - context["started_at"],
            "stage_order": [stage.name for stage in self.stages],
        }
        result.success = len(result.errors) == 0
        return result

    def _load_image(self, image_path: Path) -> Any:
        from PIL import Image
        return Image.open(image_path).convert("RGB")
