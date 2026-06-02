"""
text_generator — Generazione 3D da testo (Livello 7)
Pipeline: testo → immagini multi-view → ricostruzione 3D
Supporta Stable Diffusion XL + InstantMesh-style reconstruction.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)


@dataclass
class TextTo3DResult:
    mesh_vertices: np.ndarray
    mesh_faces: np.ndarray
    prompt: str
    generated_images: list = field(default_factory=list)
    method: str = "text_to_3d"
    metadata: dict = field(default_factory=dict)

    def save_obj(self, path: str | Path) -> Path:
        from ai_pipeline.mesh_builder import MeshResult
        mesh = MeshResult(
            vertices=self.mesh_vertices, faces=self.mesh_faces,
            method=self.method
        )
        return mesh.save_obj(path)

    @property
    def vertex_count(self) -> int:
        return int(self.mesh_vertices.shape[0])

    @property
    def face_count(self) -> int:
        return int(self.mesh_faces.shape[0])


class TextTo3D:
    def __init__(self, stability_api_key: Optional[str] = None):
        self.stability_api_key = stability_api_key
        self._generator = None

    def load(self) -> bool:
        try:
            from diffusers import StableDiffusionXLPipeline, DiffusionPipeline
            import torch
            self._pipe = StableDiffusionXLPipeline.from_pretrained(
                "stabilityai/stable-diffusion-xl-base-1.0",
                torch_dtype=torch.float16, variant="fp16"
            ).to("cuda" if torch.cuda.is_available() else "cpu")
            self._method = "sd_xl"
            logger.info("SD XL loaded")
            return True
        except Exception as e:
            logger.warning(f"SD XL load failed: {e}")
        self._method = "none"
        return False

    def generate_multi_view(self, prompt: str,
                            num_views: int = 4) -> list:
        self.load()
        if self._method == "sd_xl":
            return self._generate_sdxl(prompt, num_views)
        return self._generate_placeholder(prompt, num_views)

    def generate_mesh(self, prompt: str,
                      mesh_method: str = "convex_hull") -> TextTo3DResult:
        views = self.generate_multi_view(prompt, num_views=4)
        from ai_pipeline.multiview import MultiViewReconstructor
        reconstructor = MultiViewReconstructor()
        result = reconstructor.reconstruct_from_images(views)
        return TextTo3DResult(
            mesh_vertices=result.combined_vertices,
            mesh_faces=result.combined_faces,
            prompt=prompt,
            generated_images=[],
            method="text_to_3d_" + mesh_method,
            metadata={"num_views": len(views)}
        )

    def _generate_sdxl(self, prompt: str, num_views: int) -> list:
        view_prompts = self._build_view_prompts(prompt, num_views)
        images = []
        for vp in view_prompts:
            img = self._pipe(vp, num_inference_steps=20).images[0]
            images.append(np.array(img, dtype=np.uint8))
        return images

    def _build_view_prompts(self, base_prompt: str, n: int) -> List[str]:
        templates = [
            f"Front view of {base_prompt}, automotive design, studio lighting, white background",
            f"Rear view of {base_prompt}, automotive design, studio lighting, white background",
            f"Side view of {base_prompt}, automotive design, studio lighting, white background",
            f"3/4 view of {base_prompt}, automotive design, studio lighting, white background",
        ]
        return templates[:n]

    def _generate_placeholder(self, prompt: str, num_views: int) -> list:
        images = []
        for i in range(num_views):
            img = np.random.randint(80, 180, (256, 256, 3), dtype=np.uint8)
            img[60:200, 80:180] = np.random.randint(100, 200, (140, 100, 3))
            images.append(img)
        logger.info(f"Placeholder: generated {num_views} dummy views for '{prompt}'")
        return images


class TextTo3DVoxel:
    def __init__(self, text_to_3d: Optional[TextTo3D] = None):
        self.text_to_3d = text_to_3d or TextTo3D()
        self._voxelizer = None

    def generate(self, text: str,
                 voxel_size_mm: float = 1.0,
                 grid_size: int = 64) -> dict:
        mesh_result = self.text_to_3d.generate_mesh(text)
        from ai_pipeline.voxelizer import MeshToVoxel
        voxelizer = MeshToVoxel(voxel_size_mm=voxel_size_mm)
        vgrid = voxelizer.convert(mesh_result)

        if vgrid.voxel_count == 0:
            return {
                "success": False,
                "voxels": [],
                "mesh_vertices": mesh_result.mesh_vertices.tolist(),
                "mesh_faces": mesh_result.mesh_faces.tolist(),
                "message": "Voxelization produced no voxels, returning mesh fallback",
            }

        voxel_data = vgrid.to_voxel_list()
        return {
            "success": True,
            "voxels": voxel_data,
            "grid_shape": list(vgrid.shape),
            "voxel_count": vgrid.voxel_count,
            "voxel_size_mm": voxel_size_mm,
            "origin_mm": list(vgrid.origin_mm),
            "mesh_vertices": mesh_result.mesh_vertices.tolist(),
            "mesh_faces": mesh_result.mesh_faces.tolist(),
            "text_prompt": text,
        }
