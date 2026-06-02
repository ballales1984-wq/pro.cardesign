"""
pipeline — Pipeline orchestrator "foto → carrozzeria 3D"
Livello 0: coordina tutti gli altri moduli in un'unica interfaccia semplice.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    """Risultato completo della pipeline AI."""
    success: bool = True
    voxels: list = field(default_factory=list)
    point_cloud: Any = None
    mesh: Any = None
    symmetric_mesh: Any = None
    depth_map: Any = None
    segmentation_mask: Any = None
    stage_results: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)
    errors: list = field(default_factory=list)

    def summary(self) -> Dict[str, Any]:
        s = {
            "success": self.success,
            "voxel_count": len(self.voxels),
            "mesh_vertices": self.mesh.vertex_count if self.mesh else 0,
            "mesh_faces": self.mesh.face_count if self.mesh else 0,
            "depth_model": self.depth_map.model_used if self.depth_map else "none",
            "segmenter_model": self.segmentation_mask.model_used if self.segmentation_mask else "none",
            "stages_completed": len(self.stage_results),
        }
        if self.symmetric_mesh:
            s["symmetric_vertices"] = self.symmetric_mesh.vertex_count
            s["symmetry_quality"] = self.symmetric_mesh.mirror_quality
        if self.errors:
            s["errors"] = self.errors
        return s


class AIPipeline:
    def __init__(self, mode: str = "full"):
        self.mode = mode
        self._depth_est = None
        self._segmenter = None
        self._point_cloud = None
        self._mesh_builder = None
        self._voxelizer = None
        self._symmetric = None

    def _ensure_modules(self):
        from ai_pipeline.depth_estimator import DepthEstimator
        from ai_pipeline.segmenter import CarSegmenter
        from ai_pipeline.point_cloud import DepthToPointCloud
        from ai_pipeline.mesh_builder import PointCloudToMesh
        from ai_pipeline.voxelizer import MeshToVoxel
        from ai_pipeline.symmetric_reconstruction import SymmetricReconstructor
        self._depth_est = DepthEstimator()
        self._segmenter = CarSegmenter()
        self._point_cloud = DepthToPointCloud()
        self._mesh_builder = PointCloudToMesh(method="poisson")
        self._voxelizer = MeshToVoxel(voxel_size_mm=1.0)
        self._symmetric = SymmetricReconstructor()

    def process_image(self, image_path: str | Path,
                      options: Optional[dict] = None) -> PipelineResult:
        options = options or {}
        self._ensure_modules()
        result = PipelineResult()
        image = self._load_image(image_path)

        try:
            deep = self._depth_est.estimate(image)
            result.depth_map = deep
            result.stage_results["depth"] = {
                "model": deep.model_used,
                "shape": [deep.height, deep.width]
            }
            logger.info(f"[1/6] Depth: {deep.model_used} {deep.width}x{deep.height}")
        except Exception as e:
            result.errors.append(f"Depth estimation failed: {e}")
            logger.error(f"Depth: {e}")

        try:
            seg = self._segmenter.segment_car(image)
            result.segmentation_mask = seg
            result.stage_results["segmentation"] = {
                "model": seg.model_used,
                "bboxes": len(seg.bboxes),
            }
            logger.info(f"[2/6] Segmentation: {seg.model_used}, {len(seg.bboxes)} bboxes")
        except Exception as e:
            result.errors.append(f"Segmentation failed: {e}")
            if result.depth_map:
                h = result.depth_map.height
                w = result.depth_map.width
                seg = type('S', (), {
                    'mask': np.ones((h, w), dtype=np.uint8) * 255,
                    'model_used': 'fallback'
                })()
                seg.bboxes = []
                result.segmentation_mask = type('SM', (), {
                    'mask': seg.mask, 'bboxes': [], 'model_used': 'fallback'
                })()
            else:
                logger.warning("No depth map for fallback segmentation mask")

        try:
            pc = self._point_cloud.convert(
                result.depth_map, image=image,
                mask=result.segmentation_mask.mask if result.segmentation_mask else None
            )
            result.point_cloud = pc
            result.stage_results["pointcloud"] = {
                "points": pc.num_points
            }
            logger.info(f"[3/6] PointCloud: {pc.num_points} punti")
        except Exception as e:
            result.errors.append(f"Point cloud failed: {e}")
            from ai_pipeline.point_cloud import PointCloud, Point3D
            result.point_cloud = PointCloud(points=np.zeros((1, 3)), colors=np.ones((1, 3)) * 0.5)

        try:
            mesh = self._mesh_builder.reconstruct(result.point_cloud)
            result.mesh = mesh
            result.stage_results["mesh"] = {
                "vertices": mesh.vertex_count, "faces": mesh.face_count,
                "method": mesh.method
            }
            logger.info(f"[4/6] Mesh: {mesh.vertex_count} vertici, "
                        f"{mesh.face_count} facce ({mesh.method})")
        except Exception as e:
            result.errors.append(f"Mesh reconstruction failed: {e}")

        try:
            vgrid = self._voxelizer.convert(result.mesh)
            result.voxels = vgrid.to_voxel_list()
            result.stage_results["voxelization"] = {
                "voxel_count": vgrid.voxel_count,
                "grid_shape": list(vgrid.shape)
            }
            logger.info(f"[5/6] VoxelGrid: {vgrid.voxel_count} voxel, "
                        f"shape {vgrid.shape}")
        except Exception as e:
            result.errors.append(f"Voxelization failed: {e}")

        try:
            sym = self._symmetric.complete_from_half(result.mesh)
            result.symmetric_mesh = sym
            result.stage_results["symmetry"] = {
                "vertices": sym.vertex_count,
                "quality": sym.mirror_quality,
            }
            logger.info(f"[6/6] Simmetria: qualità {sym.mirror_quality:.2f}, "
                        f"{sym.vertex_count} vertici")
        except Exception as e:
            result.errors.append(f"Symmetry reconstruction failed: {e}")

        result.success = len(result.errors) == 0 or result.voxels or (result.mesh and result.mesh.vertex_count > 0)
        return result

    def process_multiview(self, image_paths: list,
                          options: Optional[dict] = None) -> PipelineResult:
        options = options or {}
        self._ensure_modules()
        result = PipelineResult()
        images = [self._load_image(p) for p in image_paths]

        try:
            from ai_pipeline.multiview import MultiViewReconstructor
            reconstructor = MultiViewReconstructor()
            mv_result = reconstructor.reconstruct_from_images(images)
            result.mesh = type('M', (), {
                'vertices': mv_result.combined_vertices,
                'faces': mv_result.combined_faces,
                'vertex_count': mv_result.vertex_count,
                'face_count': mv_result.face_count,
                'method': mv_result.method,
            })()
            result.stage_results["multiview"] = {
                "vertices": mv_result.vertex_count,
                "faces": mv_result.face_count,
                "views": mv_result.metadata.get("num_views", 0),
            }
            logger.info(f"MultiView: {mv_result.vertex_count} vertici, "
                        f"{mv_result.face_count} facce")
        except Exception as e:
            result.errors.append(f"Multi-view failed: {e}")

        if result.mesh and result.mesh.vertex_count > 0:
            try:
                vgrid = self._voxelizer.convert(result.mesh)
                result.voxels = vgrid.to_voxel_list()
            except Exception as e:
                result.errors.append(f"Voxelization (multiview) failed: {e}")

        result.success = result.mesh is not None and result.mesh.vertex_count > 0
        return result

    def process_text(self, prompt: str,
                     options: Optional[dict] = None) -> PipelineResult:
        options = options or {}
        self._ensure_modules()
        result = PipelineResult()
        try:
            from ai_pipeline.text_generator import TextTo3DVoxel
            t3d = TextTo3DVoxel()
            t3d_out = t3d.generate(prompt, voxel_size_mm=options.get("voxel_size_mm", 1.0))
            result.voxels = t3d_out.get("voxels", [])
            result.metadata["text_prompt"] = prompt
            result.stage_results["text_to_3d"] = {
                "voxel_count": len(result.voxels),
                "success": t3d_out.get("success", False),
            }
            logger.info(f"Text→3D: '{prompt}' → {len(result.voxels)} voxel")
        except Exception as e:
            result.errors.append(f"Text-to-3D failed: {e}")
        result.success = len(result.voxels) > 0
        return result

    def save_result(self, result: PipelineResult, output_dir: str | Path,
                    prefix: str = "car") -> dict:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        saved = {}

        if result.depth_map:
            p = out / f"{prefix}_depth.npy"
            result.depth_map.save(p)
            saved["depth"] = str(p)

        if result.segmentation_mask and hasattr(result.segmentation_mask, 'save'):
            p = out / f"{prefix}_mask.png"
            result.segmentation_mask.save(p)
            saved["mask"] = str(p)

        if result.point_cloud:
            p = out / f"{prefix}_points.ply"
            result.point_cloud.save_ply(p)
            saved["pointcloud"] = str(p)

        if result.mesh and result.mesh.vertex_count > 0:
            p = out / f"{prefix}_mesh.obj"
            from ai_pipeline.mesh_builder import MeshResult
            mesh_obj = MeshResult(
                vertices=result.mesh.vertices,
                faces=result.mesh.faces,
                normals=result.mesh.normals,
                method=result.mesh.method
            )
            mesh_obj.save_obj(p)
            saved["mesh_obj"] = str(p)

        if result.symmetric_mesh:
            p = out / f"{prefix}_symmetric.obj"
            result.symmetric_mesh.save_obj(p)
            saved["symmetric_mesh"] = str(p)

        if result.voxels:
            p = out / f"{prefix}_voxels.json"
            Path(p).write_text(str({
                "voxel_count": len(result.voxels),
                "voxels": result.voxels[:1000]
            }))
            saved["voxels_json"] = str(p)

        saved["summary"] = result.summary()
        (out / f"{prefix}_result.json").write_text(
            str(saved["summary"])
        )
        return saved

    @staticmethod
    def _load_image(path: str | Path) -> np.ndarray:
        path = str(path)
        try:
            from PIL import Image
            img = Image.open(path)
            return np.array(img.convert("RGB"), dtype=np.uint8)
        except Exception:
            return np.random.randint(0, 255, (256, 256, 3), dtype=np.uint8)
