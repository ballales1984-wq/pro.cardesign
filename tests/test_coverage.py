"""
Test Suite Completa — pro.cardesign
Coverage: Python core modules
Esegui: python -m unittest discover -s tests -p 'test_*.py'
"""

import unittest
import sys
import os
import json
import tempfile
import numpy as np

# Aggiungi root al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.brick import Brick, create_brick, create_cube, create_bar, create_wheel_tire, next_brick_id
from core.component import ComponentDefinition, ComponentInstance, ComponentLibrary, create_component_instance


class TestBrick(unittest.TestCase):
    """Test per il Brick system"""
    
    def setUp(self):
        self.brick = create_brick(1, "Test", [100, 50, 25], [10, 20, 30])
    
    def test_brick_creation(self):
        self.assertEqual(self.brick.id, 1)
        self.assertEqual(self.brick.name, "Test")
        np.testing.assert_array_equal(self.brick.position, [10, 20, 30])
        np.testing.assert_array_equal(self.brick.size, [100, 50, 25])
    
    def test_volume_calculation(self):
        self.assertAlmostEqual(self.brick.volume_mm3, 100 * 50 * 25)
    
    def test_center_calculation(self):
        expected_center = [10 + 100/2, 20 + 50/2, 30 + 25/2]
        np.testing.assert_array_almost_equal(self.brick.center, expected_center)
    
    def test_max_corner(self):
        expected = [10 + 100, 20 + 50, 30 + 25]
        np.testing.assert_array_equal(self.brick.max_corner, expected)
    
    def test_contains_point(self):
        inside = np.array([50, 40, 45])
        outside = np.array([200, 100, 100])
        self.assertTrue(self.brick.contains_point(inside))
        self.assertFalse(self.brick.contains_point(outside))
    
    def test_overlaps_true(self):
        b1 = create_brick(10, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(11, "B", [50, 50, 50], [25, 0, 0])
        self.assertTrue(b1.overlaps(b2))
    
    def test_overlaps_false(self):
        b1 = create_brick(10, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(12, "C", [50, 50, 50], [100, 0, 0])
        self.assertFalse(b1.overlaps(b2))


class TestCreateHelpers(unittest.TestCase):
    """Test per le funzioni factory"""
    
    def test_create_cube(self):
        cube = create_cube(1, "Cube", 50, [0, 0, 0])
        self.assertAlmostEqual(cube.size[0], 50)
        self.assertAlmostEqual(cube.size[1], 50)
        self.assertAlmostEqual(cube.size[2], 50)
    
    def test_create_bar_x(self):
        bar = create_bar(1, "Bar X", 200, 'x', 20)
        self.assertAlmostEqual(bar.size[0], 200)
        self.assertAlmostEqual(bar.size[1], 20)
        self.assertAlmostEqual(bar.size[2], 20)
    
    def test_create_bar_y(self):
        bar = create_bar(1, "Bar Y", 300, 'y', 25)
        self.assertAlmostEqual(bar.size[0], 25)
        self.assertAlmostEqual(bar.size[1], 300)
        self.assertAlmostEqual(bar.size[2], 25)
    
    def test_create_bar_z(self):
        bar = create_bar(1, "Bar Z", 150, 'z', 15)
        self.assertAlmostEqual(bar.size[0], 15)
        self.assertAlmostEqual(bar.size[1], 15)
        self.assertAlmostEqual(bar.size[2], 150)
    
    def test_create_wheel_tire(self):
        wheel = create_wheel_tire(1, "Wheel", 270, 250)
        self.assertAlmostEqual(wheel.size[1], 540)  # diameter = 2*radius
        self.assertAlmostEqual(wheel.size[2], 540)
        self.assertAlmostEqual(wheel.size[0], 250)  # width


class TestIDCounter(unittest.TestCase):
    def test_next_id_increments(self):
        id1 = next_brick_id()
        id2 = next_brick_id()
        id3 = next_brick_id()
        self.assertEqual(id2, id1 + 1)
        self.assertEqual(id3, id2 + 1)


class TestComponent(unittest.TestCase):
    """Test per il sistema componenti"""
    
    def setUp(self):
        self.library = ComponentLibrary("data/test_components")
    
    def test_library_has_defaults(self):
        comps = self.library.get_all()
        self.assertGreater(len(comps), 0)
    
    def test_get_by_id(self):
        wheel = self.library.get(1)
        self.assertIsNotNone(wheel)
        self.assertIn("Ruota", wheel.name)
    
    def test_get_by_category(self):
        wheels = self.library.get_by_category("wheels")
        self.assertGreater(len(wheels), 0)
        for w in wheels:
            self.assertEqual(w.category, "wheels")
    
    def test_get_by_type(self):
        wheels = self.library.get_by_type("wheel")
        self.assertGreater(len(wheels), 0)
    
    def test_search(self):
        results = self.library.search("700c")
        self.assertGreater(len(results), 0)
    
    def test_save_and_load_custom(self):
        comp = self.library.get(1)
        success = self.library.save_custom(comp)
        self.assertTrue(success)
        
        loaded = self.library.load_custom(f"data/test_components/component_{comp.id}.json")
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.name, comp.name)
    
    def test_component_instance(self):
        defn = self.library.get(1)
        instance = create_component_instance(defn, [0, 100, 0], {"outer_radius": 360})
        self.assertEqual(instance.definition_id, 1)
        np.testing.assert_array_equal(instance.position, [0, 100, 0])
        self.assertEqual(instance.parameter_overrides["outer_radius"], 360)


class TestPhysicsIntegration(unittest.TestCase):
    """Test integrazione fisica"""
    
    def test_mass_calculation(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(10, 10, 10)
        engine.set_voxel(0, 0, 0, "titanio")
        mass = engine.calculate_mass()
        # 1 voxel = 1mm³ = 1e-9 m³; densità titanio = 4500 kg/m³
        # Massa = 4500 * 1e-9 = 4.5e-6 kg
        self.assertGreater(mass, 0)
    
    def test_com_calculation(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(10, 10, 10)
        engine.set_voxel(0, 0, 0, "titanio")
        engine.set_voxel(1, 1, 1, "titanio")
        com = engine.calculate_com()
        self.assertAlmostEqual(com[0], 0.5, places=3)
        self.assertAlmostEqual(com[1], 0.5, places=3)
        self.assertAlmostEqual(com[2], 0.5, places=3)
    
    def test_save_load_json(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(10, 10, 10)
        engine.set_voxel(1, 2, 3, "carbonio", "telaio")
        engine.create_module("prova", "test")
        
        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
            filepath = f.name
        
        try:
            engine.save_json(filepath)
            engine2 = VoxelEngine(10, 10, 10)
            engine2.load_json(filepath)
            
            self.assertEqual(len(engine2.voxel_map), 1)
            key = '1,2,3'
            self.assertIn(key, engine2.voxel_map)
        finally:
            os.unlink(filepath)


if __name__ == '__main__':
    unittest.main(verbosity=2)