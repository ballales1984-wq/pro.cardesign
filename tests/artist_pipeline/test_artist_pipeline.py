"""
tests/artist_pipeline/test_artist_pipeline.py

Tests for the Artist 3D Pipeline artist_pipeline package.
"""

from __future__ import annotations

import numpy as np
import pytest


# ---- helpers ----


def _make_rgb(h=64, w=64):
    return np.random.randint(0, 255, (h, w, 3), dtype=np.uint8)


def _make_depth(h=64, w=64):
    return np.linspace(0.2, 0.8, h * w, dtype=np.float32).reshape(h, w)


# ---- config ----


class TestConfig:
    def test_default_config(self):
        from backend.ai_pipeline.artist_pipeline import get_default_config

        cfg = get_default_config()
        assert cfg.detection.model_name == "facebook/sam2-hiera-small"
        assert cfg.perspective.default_focal_length > 0
        assert cfg.depth.model == "auto"
        assert cfg.lifter.fx > 0
        assert cfg.car_refiner.wheel_radius_mm > 0
        assert cfg.voxel_converter.voxel_size_mm > 0

    def test_config_classes(self):
        from backend.ai_pipeline.artist_pipeline import (
            PipelineConfig,
            DetectionConfig,
            PerspectiveConfig,
            DepthConfig,
            LifterConfig,
            CarRefinerConfig,
            VoxelConverterConfig,
        )

        d = DetectionConfig()
        assert d.confidence_threshold == 0.5
        p = PerspectiveConfig()
        assert p.default_focal_length > 0
        dp = DepthConfig()
        assert dp.normalize_percentiles == (2.0, 98.0)
        l = LifterConfig()
        assert l.scale_xy == 100.0
        c = CarRefinerConfig()
        assert c.body_length_mm == 4500.0
        v = VoxelConverterConfig()
        assert v.method in ("raycasting", "grid_walk")

    def test_top_level_config(self):
        from backend.ai_pipeline.artist_pipeline import PipelineConfig

        cfg = PipelineConfig()
        assert hasattr(cfg, "detection")
        assert hasattr(cfg, "perspective")
        assert hasattr(cfg, "depth")
        assert hasattr(cfg, "lifter")
        assert hasattr(cfg, "car_refiner")
        assert hasattr(cfg, "voxel_converter")
        assert cfg.save_intermediate is False
        assert cfg.log_level == "INFO"


# ---- utils ----


class TestUtils:
    def test_setup_logging(self):
        from backend.ai_pipeline.artist_pipeline.utils import setup_logging

        logger = setup_logging("WARNING")
        assert logger is not None

    def test_normalize_array(self):
        from backend.ai_pipeline.artist_pipeline.utils import normalize_array

        arr = np.array([1.0, 2.0, 3.0, 4.0, 5.0], dtype=np.float32)
        norm = normalize_array(arr, 0.0, 100.0)
        assert norm.min() >= 0.0
        assert norm.max() <= 1.0
        assert norm.dtype == np.float32

    def test_clamp(self):
        from backend.ai_pipeline.artist_pipeline.utils import clamp

        assert clamp(5.0, 0.0, 10.0) == 5.0
        assert clamp(-1.0, 0.0, 10.0) == 0.0
        assert clamp(11.0, 0.0, 10.0) == 10.0

    def test_compute_bounds(self):
        from backend.ai_pipeline.artist_pipeline.utils import compute_bounds

        pts = np.array([[0, 0, 0], [2, 3, 5]], dtype=np.float32)
        min_b, max_b = compute_bounds(pts)
        assert np.allclose(min_b, [0, 0, 0])
        assert np.allclose(max_b, [2, 3, 5])

    def test_bbox_area(self):
        from backend.ai_pipeline.artist_pipeline.utils import bbox_area

        assert bbox_area((0, 0, 2, 3)) == 6.0
        assert bbox_area((1, 2, 1, 2)) == 0.0


# ---- data classes ----


class TestDataClasses:
    def test_detection_result(self):
        from backend.ai_pipeline.artist_pipeline.detectors import DetectionResult

        dr = DetectionResult(bbox=np.array([10, 20, 100, 100], dtype=np.float32), confidence=0.9, label="car")
        assert dr.label == "car"
        assert dr.confidence == 0.9
        assert dr.bbox is not None

    def test_segmentation_result(self):
        from backend.ai_pipeline.artist_pipeline.detectors import SegmentationResult

        mask = np.zeros((10, 10), dtype=np.uint8)
        mask[2:8, 2:8] = 255
        sr = SegmentationResult(mask=mask, bboxes=[(2, 2, 8, 8)], model_used="sam2-test")
        assert sr.best_bbox() == (2, 2, 8, 8)

    def test_perspective_data(self):
        from backend.ai_pipeline.artist_pipeline.perspective import PerspectiveData

        pd = PerspectiveData()
        assert pd.has_valid_estimate() is False
        pd2 = PerspectiveData(
            vanishing_points=[np.array([100.0, 200.0])],
            focal_length=500.0,
        )
        assert pd2.has_valid_estimate() is True

    def test_point_cloud(self):
        from backend.ai_pipeline.artist_pipeline.lifter import PointCloud

        pts = np.array([[0, 0, 0], [1, 1, 1]], dtype=np.float32)
        cols = np.array([[1, 0, 0], [0, 1, 0]], dtype=np.float32)
        pc = PointCloud(points=pts, colors=cols, source_shape=(10, 10))
        assert pc.num_points == 2
        min_b, max_b = pc.bounds()
        assert np.allclose(min_b, [0, 0, 0])
        assert np.allclose(max_b, [1, 1, 1])
        subsampled = pc.subsample(1)
        assert subsampled.num_points <= 1

    def test_refined_mesh(self):
        from backend.ai_pipeline.artist_pipeline.car_refiner import RefinedMesh

        verts = np.zeros((4, 3), dtype=np.float32)
        faces = np.array([[0, 1, 2], [1, 2, 3]], dtype=np.int32)
        rm = RefinedMesh(vertices=verts, faces=faces, normals=None)
        assert rm.vertex_count == 4
        assert rm.face_count == 2
        assert "wheels_placed" not in rm.metadata

    def test_brick_system_result(self):
        from backend.ai_pipeline.artist_pipeline.voxel_converter import BrickSystemResult

        bs = BrickSystemResult()
        assert bs.brick_count == 0
        bs2 = BrickSystemResult(bricks=[1, 2, 3])
        assert bs2.brick_count == 3


# ---- lifter ----


class TestLifter:
    def test_lift_empty_depth(self):
        from backend.ai_pipeline.artist_pipeline import Lifter

        lifter = Lifter()
        depth = np.zeros((10, 10), dtype=np.float32)
        pc = lifter.lift(depth)
        assert pc.num_points <= 1

    def test_lift_flat_depth(self):
        from backend.ai_pipeline.artist_pipeline.lifter import DepthToPointCloud

        # Use DepthToPointCloud directly for deterministic behavior
        from backend.ai_pipeline.artist_pipeline.lifter import DepthMap
        from backend.ai_pipeline.artist_pipeline.lifter import DepthToPointCloud

        dm = DepthMap(width=10, height=10, data=np.linspace(0.3, 0.7, 100).reshape(10, 10).astype(np.float32))
        d2p = DepthToPointCloud(fx=100.0, fy=100.0)
        img = np.ones((10, 10, 3), dtype=np.uint8) * 128
        pc = d2p.convert(dm, image=img, scale_xy=10.0, scale_z=10.0)
        assert isinstance(pc.points, np.ndarray)
        assert isinstance(pc.colors, np.ndarray)


# ---- perspective ----


class TestPerspective:
    def test_analyze_perspective_flat(self):
        from backend.ai_pipeline.artist_pipeline import analyze_perspective

        img = np.ones((64, 64, 3), dtype=np.uint8) * 128
        pd = analyze_perspective(img)
        assert pd.method == "opencv+hough"
        assert pd.confidence >= 0.0
        assert pd.focal_length > 0

    def test_analyze_perspective_with_mask(self):
        from backend.ai_pipeline.artist_pipeline import analyze_perspective

        img = np.ones((64, 64, 3), dtype=np.uint8) * 128
        mask = np.zeros((64, 64), dtype=np.uint8)
        mask[10:54, 10:54] = 255
        pd = analyze_perspective(img, mask)
        assert pd.method == "opencv+hough"
        assert pd.focal_length > 0


# ---- depth ----


class TestDepth:
    def test_depth_fallback(self):
        from backend.ai_pipeline.artist_pipeline import DepthEstimator

        est = DepthEstimator()
        # ensure it falls back (no heavy model)
        assert est.load() is False
        img = _make_rgb()
        depth = est.estimate(img)
        assert depth.dtype == np.float32
        assert depth.min() >= 0.0
        assert depth.max() <= 1.0

    def test_depth_normalize(self):
        from backend.ai_pipeline.artist_pipeline.depth import normalize_array

        arr = np.array([0.0, 0.1, 0.2, 0.3], dtype=np.float32)
        n = normalize_array(arr, 0.0, 100.0)
        assert n.dtype == np.float32
        assert float(n.max()) <= 1.0 + 1e-5
        assert float(n.min()) >= 0.0 - 1e-5


# ---- car refiner ----


class TestCarRefiner:
    def test_refine_empty(self):
        from backend.ai_pipeline.artist_pipeline.car_refiner import CarRefiner, PointCloud

        refiner = CarRefiner()
        pc = PointCloud(points=np.zeros((0, 3), dtype=np.float32), colors=np.zeros((0, 3), dtype=np.float32))
        res = refiner.refine(pc)
        assert res.vertex_count == 1
        assert res.face_count == 1

    def test_symmetry_simple(self):
        from backend.ai_pipeline.artist_pipeline.car_refiner import CarRefiner

        refiner = CarRefiner()
        verts = np.array(
            [[-5, 0, 0], [0, 0, 0], [5, 0, 0], [-5, 1, 1], [0, 1, 1], [5, 1, 1]],
            dtype=np.float32,
        )
        out = refiner._enforce_symmetry(verts, np.zeros((0, 3), dtype=np.int32))
        assert out[0].shape == verts.shape

    def test_wheel_geometry(self):
        from backend.ai_pipeline.artist_pipeline.car_refiner import CarRefiner

        refiner = CarRefiner()
        verts, faces = refiner._cylinder(radius=100.0, width=200.0)
        assert verts.shape[1] == 3
        assert faces.shape[1] == 3
        assert faces.shape[0] > 0


# ---- voxel converter ----


class TestVoxelConverter:
    def test_brick_system_result(self):
        from backend.ai_pipeline.artist_pipeline.voxel_converter import BrickSystemResult

        res = BrickSystemResult()
        assert res.brick_count == 0
        res2 = BrickSystemResult(bricks=[1, 2, 3])
        assert res2.brick_count == 3

    def test_voxelizer_empty(self):
        from backend.ai_pipeline.artist_pipeline.voxel_converter import VoxelConverter
        from backend.ai_pipeline.artist_pipeline.lifter import PointCloud

        conv = VoxelConverter()
        pc = PointCloud(points=np.zeros((0, 3), dtype=np.float32), colors=np.zeros((0, 3), dtype=np.float32))
        res = conv.convert(pc)
        assert res.brick_count == 0


# ---- pipeline (integration-level, no models) ----


class TestArtist3DPipeline:
    def test_init_default(self):
        from backend.ai_pipeline.artist_pipeline import Artist3DPipeline

        p = Artist3DPipeline()
        assert p is not None

    def test_process_image_invalid_path(self):
        from backend.ai_pipeline.artist_pipeline import Artist3DPipeline, PipelineConfig

        cfg = PipelineConfig()
        cfg.detection.fallback_to_full_image = False
        cfg.depth.model = "none"
        p = Artist3DPipeline(config=cfg)
        res = p.process_image("__does_not_exist__.jpg")
        assert res.status == "error"
        assert len(res.errors) > 0

    def test_process_image_fallback(self):
        from backend.ai_pipeline.artist_pipeline import Artist3DPipeline, PipelineConfig
        from PIL import Image
        import tempfile, os

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as fh:
            img = Image.fromarray(np.ones((64, 64, 3), dtype=np.uint8) * 128)
            img.save(fh.name)
            path = fh.name
        try:
            cfg = PipelineConfig()
            cfg.detection.fallback_to_full_image = True
            cfg.depth.model = "auto"
            p = Artist3DPipeline(config=cfg)
            res = p.process_image(path)
            assert "brick_count" in res.summary()
            assert len(res.stage_times) > 0
        finally:
            os.unlink(path)

    def test_process_point_cloud(self):
        from backend.ai_pipeline.artist_pipeline import Artist3DPipeline
        from backend.ai_pipeline.artist_pipeline.lifter import PointCloud

        p = Artist3DPipeline()
        pc = PointCloud(points=np.array([[0, 0, 0], [1, 1, 1], [2, 2, 2]], dtype=np.float32), colors=np.ones((3, 3), dtype=np.float32))
        res = p.process_point_cloud(pc)
        assert "status" in res.summary()
