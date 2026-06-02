from __future__ import annotations
from typing import Any
from .base_stage import BaseStage
from ..config import Config

try:
    from ai_pipeline.mesh_builder import PointCloudToMesh
except Exception:
    PointCloudToMesh = None


class RefinerStage(BaseStage):
    name = "refiner"
    model_name = "car-concept"

    def run(self, image: Any, context: dict[str, Any], config: Config) -> dict[str, Any]:
        lifting_output = context.get("lifting", {})
        point_cloud = lifting_output.get("point_cloud")

        if PointCloudToMesh is not None and point_cloud is not None:
            mesh = PointCloudToMesh(method="poisson").reconstruct(point_cloud)
            return {
                "model_used": self.model_name,
                "mesh": mesh,
            }

        from ai_pipeline.mesh_builder import MeshResult
        from numpy import array, int32, float32
        vertices = array([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], dtype=float32)
        faces = array([[0, 1, 2], [0, 2, 3]], dtype=int32)
        mesh = MeshResult(vertices=vertices, faces=faces, method="fallback_plane")
        return {
            "model_used": "fallback_mesh",
            "mesh": mesh,
        }
