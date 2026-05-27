"""
Edge case tests for Brick overlap detection - AABB collision logic
"""
import unittest
import sys
import os
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.brick import Brick, create_brick


class TestBrickOverlapEdgeCases(unittest.TestCase):
    """Edge case tests for AABB overlap detection"""

    # === EDGE CASE: Touching on edges/corners (NOT overlap) ===
    def test_touching_along_x_axis_only(self):
        """Bricks touch on X but are separate in Y and Z - NO overlap"""
        b1 = create_brick(1, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(2, "B", [50, 50, 50], [50, 100, 100])
        self.assertFalse(b1.overlaps(b2))

    def test_touching_along_y_axis_only(self):
        """Bricks touch on Y but are separate in X and Z - NO overlap"""
        b1 = create_brick(1, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(2, "B", [50, 50, 50], [100, 50, 100])
        self.assertFalse(b1.overlaps(b2))

    def test_touching_along_z_axis_only(self):
        """Bricks touch on Z but are separate in X and Y - NO overlap"""
        b1 = create_brick(1, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(2, "B", [50, 50, 50], [100, 100, 50])
        self.assertFalse(b1.overlaps(b2))

    def test_touching_corners_diagonal(self):
        """Bricks touch only at a corner (diagonal) - NOT overlap"""
        b1 = create_brick(1, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(2, "B", [50, 50, 50], [50, 50, 50])
        self.assertFalse(b1.overlaps(b2))

    def test_touching_edges_not_corners(self):
        """Bricks touch along an edge but NOT on all axes - NO overlap"""
        b1 = create_brick(1, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(2, "B", [50, 50, 50], [50, 25, 25])
        self.assertFalse(b1.overlaps(b2))

    # === EDGE CASE: Containment ===
    def test_containment_smaller_inside_larger(self):
        """Smaller brick completely inside larger - IS overlap"""
        b1 = create_brick(1, "A", [100, 100, 100], [0, 0, 0])
        b2 = create_brick(2, "B", [20, 20, 20], [40, 40, 40])
        self.assertTrue(b1.overlaps(b2))

    def test_containment_identical_bricks(self):
        """Identical bricks (same position/size) - ARE overlap"""
        b1 = create_brick(1, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(2, "B", [50, 50, 50], [0, 0, 0])
        self.assertTrue(b1.overlaps(b2))

    def test_containment_larger_contains_smaller(self):
        """Larger brick contains smaller - IS overlap"""
        b1 = create_brick(1, "A", [20, 20, 20], [0, 0, 0])
        b2 = create_brick(2, "B", [100, 100, 100], [0, 0, 0])
        self.assertTrue(b1.overlaps(b2))

    # === EDGE CASE: Partial overlaps ===
    def test_partial_overlap_all_axes(self):
        """Full 3D overlap"""
        b1 = create_brick(1, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(2, "B", [50, 50, 50], [25, 25, 25])
        self.assertTrue(b1.overlaps(b2))

    def test_partial_overlap_intersecting(self):
        """Intersecting bricks - partial overlap"""
        b1 = create_brick(1, "A", [100, 100, 100], [0, 0, 0])
        b2 = create_brick(2, "B", [50, 50, 50], [75, 75, 75])
        self.assertTrue(b1.overlaps(b2))

    # === EDGE CASE: Different dimensions ===
    def test_overlaps_with_rectangular_bricks(self):
        """Non-uniform dimensions - partial overlap"""
        b1 = create_brick(1, "A", [200, 50, 30], [0, 0, 0])
        b2 = create_brick(2, "B", [40, 100, 60], [150, 25, 15])
        self.assertTrue(b1.overlaps(b2))

    def test_overlaps_separate_non_uniform(self):
        """Non-uniform dimensions - separated"""
        b1 = create_brick(1, "A", [200, 50, 30], [0, 0, 0])
        b2 = create_brick(2, "B", [40, 100, 60], [300, 25, 15])
        self.assertFalse(b1.overlaps(b2))

    def test_overlaps_rectangular_touching(self):
        """Rectangular bricks touching on one face"""
        b1 = create_brick(1, "A", [200, 50, 30], [0, 0, 0])
        b2 = create_brick(2, "B", [40, 100, 60], [200, 100, 60])
        self.assertFalse(b1.overlaps(b2))

    # === EDGE CASE: Negative coordinates ===
    def test_overlaps_negative_positions(self):
        """Overlap with negative coordinates"""
        b1 = create_brick(1, "A", [50, 50, 50], [-100, -100, -100])
        b2 = create_brick(2, "B", [50, 50, 50], [-75, -75, -75])
        self.assertTrue(b1.overlaps(b2))

    def test_overlaps_negative_separated(self):
        """Separated bricks with negative coordinates"""
        b1 = create_brick(1, "A", [50, 50, 50], [-100, -100, -100])
        b2 = create_brick(2, "B", [50, 50, 50], [0, 0, 0])
        self.assertFalse(b1.overlaps(b2))


if __name__ == '__main__':
    unittest.main(verbosity=2)