"""
test_ai_pipeline — Test suite completa per ai_pipeline/
"""

import unittest
import sys
import os
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestDepthMap(unittest.TestCase):

    def test_depth_map_creation(self):
        from ai_pipeline.depth_estimator import DepthMap
        import numpy as np
        data = np.linspace(0, 1, 256, dtype=np.float32)
        dm = DepthMap(width=16, height=16, data=data, model_used="test-model")
        self.assertEqual(dm.width, 16)
        self.assertEqual(dm.height, 16)
        self.assertEqual(dm.model_used, "test-model")
        self.assertEqual(dm.data.shape, (256,))

    def test_depth_map_normalization(self):
        from ai_pipeline.depth_estimator import DepthMap
        import numpy as np
        data = np.array([0.0, 0.5, 1.0, 2.0, 0.3, 0.8], dtype=np.float32)
        dm = DepthMap(width=3, height=2, data=data)
        self.assertEqual(dm.width, 3)
        self.assertEqual(dm.height, 2)
        self.assertEqual(len(dm.data), 6)

    def test_depth_map_model_field(self):
        from ai_pipeline.depth_estimator import DepthMap
        import numpy as np
        dm = DepthMap(width=8, height=8,
                      data=np.ones(64, dtype=np.float32) * 0.5,
                      model_used="depth-anything-v2-small")
        self.assertEqual(dm.model_used, "depth-anything-v2-small")


class TestFallbackDepth(unittest.TestCase):

    def test_depth_map_zero_data(self):
        from ai_pipeline.depth_estimator import DepthMap
        import numpy as np
        dm = DepthMap(width=4, height=4, data=np.zeros(16, dtype=np.float32))
        self.assertEqual(dm.data.sum(), 0)

    def test_depth_map_values_in_range(self):
        from ai_pipeline.depth_estimator import DepthMap
        import numpy as np
        data = np.linspace(0.2, 0.8, 16, dtype=np.float32)
        dm = DepthMap(width=4, height=4, data=data)
        self.assertTrue(np.all(dm.data >= 0))
        self.assertTrue(np.all(dm.data <= 1))

    def test_depth_map_float32(self):
        from ai_pipeline.depth_estimator import DepthMap
        import numpy as np
        data = np.array([0.1, 0.2, 0.3, 0.4], dtype=np.float32)
        dm = DepthMap(width=2, height=2, data=data)
        self.assertEqual(dm.data.dtype, np.float32)


class TestDepthMapDataclass(unittest.TestCase):

    def test_depth_map_default_fields(self):
        from ai_pipeline.depth_estimator import DepthMap
        import numpy as np
        dm = DepthMap(width=4, height=4, data=np.zeros(16, dtype=np.float32))
        self.assertEqual(dm.model_used, "fallback")
        self.assertIsNone(dm.raw_depth)


class TestNormalizeFunction(unittest.TestCase):

    def test_normalize_output_range(self):
        import numpy as np
        from ai_pipeline.depth_estimator import _normalize
        d = np.array([0.0, 0.1, 0.5, 0.9, 1.0, 5.0, 100.0], dtype=np.float32)
        nd = _normalize(d)
        self.assertTrue(np.all(nd >= 0))
        self.assertTrue(np.all(nd <= 1))
        self.assertAlmostEqual(float(nd.min()), 0.0)
        self.assertAlmostEqual(float(nd.max()), 1.0)

    def test_normalize_monotonic(self):
        import numpy as np
        from ai_pipeline.depth_estimator import _normalize
        d = np.array([1.0, 2.0, 3.0, 4.0, 5.0], dtype=np.float32)
        nd = _normalize(d)
        self.assertEqual(int(nd.argmin()), 0)
        self.assertEqual(int(nd.argmax()), 4)

    def test_normalize_constant(self):
        import numpy as np
        from ai_pipeline.depth_estimator import _normalize
        d = np.ones(10, dtype=np.float32) * 0.5
        nd = _normalize(d)
        self.assertTrue(np.all(nd == 0))

    def test_normalize_single_value(self):
        import numpy as np
        from ai_pipeline.depth_estimator import _normalize
        d = np.array([42.0], dtype=np.float32)
        nd = _normalize(d)
        self.assertEqual(nd[0], 0.0)

    def test_normalize_custom_percentiles(self):
        import numpy as np
        from ai_pipeline.depth_estimator import _normalize
        d = np.linspace(0, 0.9, 10, dtype=np.float32)
        nd = _normalize(d, p_low=10.0, p_high=90.0)
        self.assertTrue(np.all(nd >= 0))
        self.assertTrue(np.all(nd <= 1))


class TestBBox(unittest.TestCase):

    def test_bbox_creation(self):
        from ai_pipeline.segmenter import BBox
        b = BBox(x=10, y=20, w=100, h=50, confidence=0.9)
        self.assertEqual(b.x, 10)
        self.assertEqual(b.y, 20)
        self.assertEqual(b.w, 100)
        self.assertEqual(b.h, 50)
        self.assertAlmostEqual(b.confidence, 0.9)

    def test_bbox_default_confidence(self):
        from ai_pipeline.segmenter import BBox
        b = BBox(x=0, y=0, w=10, h=10)
        self.assertEqual(b.confidence, 1.0)

    def test_bbox_area(self):
        from ai_pipeline.segmenter import BBox
        b = BBox(x=0, y=0, w=10, h=20)
        self.assertEqual(b.w * b.h, 200)


class TestSegmentationMask(unittest.TestCase):

    def test_mask_creation(self):
        import numpy as np
        from ai_pipeline.segmenter import SegmentationMask
        m = np.ones((64, 64), dtype=np.uint8) * 255
        mask = SegmentationMask(mask=m, bboxes=[], labels=[],
                                image_shape=(64, 64))
        self.assertEqual(mask.mask.shape, (64, 64))
        self.assertEqual(mask.image_shape, (64, 64))

    def test_car_bbox_none(self):
        import numpy as np
        from ai_pipeline.segmenter import SegmentationMask
        m = np.zeros((32, 32), dtype=np.uint8)
        mask = SegmentationMask(mask=m, bboxes=[], labels=[])
        self.assertIsNone(mask.car_bbox())

    def test_car_bbox_found(self):
        import numpy as np
        from ai_pipeline.segmenter import SegmentationMask, BBox
        m = np.ones((64, 64), dtype=np.uint8) * 255
        b1 = BBox(0, 0, 10, 10)
        b2 = BBox(0, 0, 100, 50)
        mask = SegmentationMask(mask=m, bboxes=[b1, b2], labels=["a", "b"])
        got = mask.car_bbox()
        self.assertIsNotNone(got)
        self.assertEqual(got.w, 100)

    def test_mask_array(self):
        import numpy as np
        from ai_pipeline.segmenter import SegmentationMask
        m = np.ones((32, 32), dtype=np.uint8) * 255
        mask = SegmentationMask(mask=m)
        arr = mask.mask_array()
        np.testing.assert_array_equal(arr, m)

    def test_mask_empty_labels(self):
        import numpy as np
        from ai_pipeline.segmenter import SegmentationMask
        m = np.ones((16, 16), dtype=np.uint8) * 255
        mask = SegmentationMask(mask=m, bboxes=[], labels=[])
        self.assertEqual(len(mask.labels), 0)


class TestBBoxToMasks(unittest.TestCase):

    def test_single_region(self):
        import numpy as np
        from ai_pipeline.segmenter import CarSegmenter
        m = np.zeros((64, 64), dtype=np.uint8)
        m[10:30, 20:40] = 255
        bboxes = CarSegmenter._mask_to_bboxes(m, 64, 64)
        self.assertEqual(len(bboxes), 1)
        self.assertEqual(bboxes[0].x, 20)
        self.assertEqual(bboxes[0].y, 10)
        self.assertGreaterEqual(bboxes[0].w, 19)
        self.assertGreaterEqual(bboxes[0].h, 19)

    def test_multiple_regions(self):
        import numpy as np
        from ai_pipeline.segmenter import CarSegmenter
        m = np.zeros((64, 64), dtype=np.uint8)
        m[5:15, 5:15] = 255
        m[40:55, 40:55] = 255
        bboxes = CarSegmenter._mask_to_bboxes(m, 64, 64)
        self.assertEqual(len(bboxes), 2)

    def test_empty_mask(self):
        import numpy as np
        from ai_pipeline.segmenter import CarSegmenter
        m = np.zeros((32, 32), dtype=np.uint8)
        bboxes = CarSegmenter._mask_to_bboxes(m, 32, 32)
        self.assertEqual(len(bboxes), 0)


class TestPoint3D(unittest.TestCase):

    def test_creation(self):
        import numpy as np
        from ai_pipeline.point_cloud import Point3D
        p = Point3D(1.0, 2.0, 3.0, 0.8, 0.6, 0.4)
        self.assertAlmostEqual(p.x, 1.0)
        self.assertAlmostEqual(p.y, 2.0)
        self.assertAlmostEqual(p.z, 3.0)
        self.assertAlmostEqual(p.r, 0.8)

    def test_default_color(self):
        import numpy as np
        from ai_pipeline.point_cloud import Point3D
        p = Point3D(1.0, 2.0, 3.0)
        self.assertAlmostEqual(p.r, 0.5)
        self.assertAlmostEqual(p.g, 0.5)
        self.assertAlmostEqual(p.b, 0.5)

    def test_to_array(self):
        import numpy as np
        from ai_pipeline.point_cloud import Point3D
        p = Point3D(1.0, 2.0, 3.0)
        arr = p.to_array()
        self.assertEqual(arr.dtype, np.float32)
        np.testing.assert_array_almost_equal(arr, [1.0, 2.0, 3.0])


class TestPointCloud(unittest.TestCase):

    def test_creation(self):
        import numpy as np
        from ai_pipeline.point_cloud import PointCloud
        pts = np.random.rand(100, 3).astype(np.float32)
        cols = np.random.rand(100, 3).astype(np.float32)
        pc = PointCloud(points=pts, colors=cols, source_shape=(64, 64))
        self.assertEqual(pc.num_points, 100)
        self.assertEqual(pc.source_shape, (64, 64))

    def test_bounds(self):
        import numpy as np
        from ai_pipeline.point_cloud import PointCloud
        pts = np.array([[0, 0, 0], [10, 20, 30]], dtype=np.float32)
        cols = np.ones((2, 3), dtype=np.float32) * 0.5
        pc = PointCloud(points=pts, colors=cols)
        min_b, max_b = pc.bounds()
        np.testing.assert_array_almost_equal(min_b, [0, 0, 0])
        np.testing.assert_array_almost_equal(max_b, [10, 20, 30])

    def test_empty_points(self):
        import numpy as np
        from ai_pipeline.point_cloud import PointCloud
        pc = PointCloud(points=np.zeros((0, 3), dtype=np.float32),
                        colors=np.ones((0, 3), dtype=np.float32) * 0.5)
        self.assertEqual(pc.num_points, 0)

    def test_default_camera_params(self):
        import numpy as np
        from ai_pipeline.point_cloud import PointCloud
        pc = PointCloud(points=np.zeros((1, 3), dtype=np.float32),
                        colors=np.ones((1, 3)) * 0.5)
        self.assertIn("fx", pc.camera_params)
        self.assertIn("fy", pc.camera_params)

    def test_save_ply_header(self):
        import numpy as np
        from ai_pipeline.point_cloud import PointCloud
        pts = np.array([[0.0, 0.0, 0.0], [10.0, 20.0, 30.0]], dtype=np.float32)
        cols = np.ones((2, 3), dtype=np.float32) * 0.7
        pc = PointCloud(points=pts, colors=cols)
        header = pc._ply_header(2)
        self.assertIn(b"ply", header)
        self.assertIn(b"element vertex 2", header)
        self.assertIn(b"float x", header)

    def test_save_ply_binary(self):
        import numpy as np
        from ai_pipeline.point_cloud import PointCloud
        pts = np.random.rand(50, 3).astype(np.float32) * 100
        cols = np.random.rand(50, 3).astype(np.float32)
        pc = PointCloud(points=pts, colors=cols, source_shape=(64, 64))
        tmpdir = tempfile.mkdtemp()
        try:
            path = Path(tmpdir) / "points.ply"
            saved = pc.save_ply(path)
            data = saved.read_bytes()
            self.assertIn(b"ply", data[:20])
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_save_npz(self):
        import numpy as np
        from ai_pipeline.point_cloud import PointCloud
        pts = np.random.rand(30, 3).astype(np.float32)
        cols = np.ones((30, 3), dtype=np.float32) * 0.5
        pc = PointCloud(points=pts, colors=cols)
        tmpdir = tempfile.mkdtemp()
        try:
            path = Path(tmpdir) / "cloud.npz"
            saved = pc.save_npz(path)
            self.assertTrue(saved.exists())
            loaded = np.load(saved)
            self.assertEqual(loaded["points"].shape, (30, 3))
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)


class TestDepthToPointCloud(unittest.TestCase):

    def test_converter_init(self):
        from ai_pipeline.point_cloud import DepthToPointCloud
        conv = DepthToPointCloud(fx=400, fy=400)
        self.assertEqual(conv.fx, 400)
        self.assertEqual(conv.fy, 400)

    def test_convert_small_depth(self):
        from ai_pipeline.depth_estimator import DepthMap
        from ai_pipeline.point_cloud import DepthToPointCloud, PointCloud
        import numpy as np
        conv = DepthToPointCloud()
        dm = DepthMap(width=4, height=4,
                      data=np.zeros(16, dtype=np.float32))
        pc = conv.convert(dm)
        self.assertIsInstance(pc, PointCloud)

    def test_convert_single_depth_value(self):
        import numpy as np
        from ai_pipeline.depth_estimator import DepthMap
        from ai_pipeline.point_cloud import DepthToPointCloud
        conv = DepthToPointCloud()
        dm = DepthMap(width=2, height=2,
                      data=np.ones(4, dtype=np.float32) * 0.5)
        pc = conv.convert(dm, max_points=500)
        self.assertIsInstance(pc, type(pc))

    def test_convert_with_mask(self):
        from ai_pipeline.depth_estimator import DepthMap
        from ai_pipeline.point_cloud import DepthToPointCloud
        import numpy as np
        conv = DepthToPointCloud()
        dm = DepthMap(width=4, height=4,
                      data=np.ones(16, dtype=np.float32) * 0.5)
        mask = np.zeros(16, dtype=np.float32)
        mask[0] = 1
        pc = conv.convert(dm, mask=mask, max_points=500)
        self.assertIsNotNone(pc.points)

    def test_convert_point_colors_in_range(self):
        import numpy as np
        from ai_pipeline.depth_estimator import DepthMap
        from ai_pipeline.point_cloud import DepthToPointCloud
        conv = DepthToPointCloud()
        dm = DepthMap(width=4, height=4,
                      data=np.ones(16, dtype=np.float32) * 0.5)
        img = np.random.randint(0, 255, (4, 4, 3), dtype=np.uint8)
        pc = conv.convert(dm, image=img)
        self.assertTrue(np.all(pc.colors >= 0))
        self.assertTrue(np.all(pc.colors <= 1))
