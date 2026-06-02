"""
ai_pipeline — Pipeline AI "foto → carrozzeria 3D" per pro.cardesign

Architettura modulare:
  Level 1: Depth Estimation + Point Cloud
  Level 2: Segmentazione (SAM)
  Level 3: Ricostruzione Simmetrica
  Level 4: Multi-view Reconstruction
  Level 6: Voxelizzazione
  Level 7: Generazione da Testo

Uso base:
    from ai_pipeline import AIPipeline
    result = AIPipeline.process_image("auto.jpg")
"""

from .depth_estimator import DepthEstimator, DepthMap
from .segmenter import CarSegmenter, SegmentationMask
from .point_cloud import DepthToPointCloud, PointCloud
from .mesh_builder import PointCloudToMesh, MeshResult
from .symmetric_reconstruction import SymmetricReconstructor
from .voxelizer import MeshToVoxel, VoxelGrid
from .multiview import MultiViewReconstructor
from .text_generator import TextTo3D
from .pipeline import AIPipeline

__all__ = [
    "DepthEstimator", "DepthMap",
    "CarSegmenter", "SegmentationMask",
    "DepthToPointCloud", "PointCloud",
    "PointCloudToMesh", "MeshResult",
    "SymmetricReconstructor",
    "MeshToVoxel", "VoxelGrid",
    "MultiViewReconstructor",
    "TextTo3D",
    "AIPipeline",
]
