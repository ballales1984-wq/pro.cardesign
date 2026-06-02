from __future__ import annotations
from typing import Any
from .base_stage import BaseStage
from ..config import Config

try:
    from ai_pipeline.voxelizer import MeshToVoxel
except Exception:
    MeshToVoxel = None


class VoxelizationStage(BaseStage):
    name = "voxelization"
    model_name = "brick-conversion"

    def run(self, image: Any, context: dict[str, Any], config: Config) -> dict[str, Any]:
        refiner_output = context.get("refiner", {})
        mesh = refiner_output.get("mesh")

        if MeshToVoxel is not None and mesh is not None:
            voxelizer = MeshToVoxel(voxel_size_mm=config.voxel_size_mm)
            voxel_grid = voxelizer.convert(mesh)
            return {
                "model_used": self.model_name,
                "voxel_grid": voxel_grid,
            }

        return {
            "model_used": "fallback_voxel",
            "voxel_grid": None,
        }
