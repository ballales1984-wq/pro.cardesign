"""
Complete Test Suite — pro.cardesign
Coverage: Python core modules
Run: python -m unittest discover -s tests -p 'test_*.py'
"""

import unittest
import sys
import os
import json
import tempfile
import numpy as np

# Add root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.brick import Brick, create_brick, create_cube, create_bar, create_wheel_tire, next_brick_id
from core.component import ComponentDefinition, ComponentInstance, ComponentLibrary, create_component_instance


class TestBrick(unittest.TestCase):
    """Tests for the Brick system"""
    
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
    """Tests for factory functions"""
    
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


class TestBrickEdgeCases(unittest.TestCase):
    """Edge case tests for Brick"""
    
    def test_brick_with_zero_size(self):
        """Brick with zero size → volume = 0"""
        brick = create_brick(1, "Zero", [0, 0, 0], [0, 0, 0])
        self.assertAlmostEqual(brick.volume_mm3, 0)
        np.testing.assert_array_equal(brick.center, [0, 0, 0])
    
    def test_brick_with_negative_position(self):
        """Negative coordinates are allowed"""
        brick = create_brick(1, "Neg", [10, 10, 10], [-100, -200, -300])
        np.testing.assert_array_equal(brick.position, [-100, -200, -300])
    
    def test_brick_center_calculation(self):
        """Center = position + size/2"""
        brick = create_brick(1, "C", [10, 20, 30], [0, 0, 0])
        np.testing.assert_array_almost_equal(brick.center, [5, 10, 15])
    
    def test_brick_contains_point(self):
        brick = create_brick(1, "Box", [10, 10, 10], [0, 0, 0])
        self.assertTrue(brick.contains_point(np.array([5, 5, 5])))
        self.assertFalse(brick.contains_point(np.array([11, 5, 5])))
        self.assertFalse(brick.contains_point(np.array([-1, 5, 5])))
    
    def test_brick_no_overlap_far(self):
        b1 = create_brick(1, "A", [10, 10, 10], [0, 0, 0])
        b2 = create_brick(2, "B", [10, 10, 10], [50, 0, 0])
        self.assertFalse(b1.overlaps(b2))
    
    def test_brick_touch_but_no_overlap(self):
        b1 = create_brick(1, "A", [10, 10, 10], [0, 0, 0])
        b2 = create_brick(2, "B", [10, 10, 10], [10, 0, 0])  # touches at x=10
        self.assertFalse(b1.overlaps(b2))  # touching ≠ overlapping
    
    def test_create_bar_axis_z(self):
        bar = create_bar(1, "Bar Z", 500, 'z', 30, [0, 0, 0])
        self.assertAlmostEqual(bar.size[2], 500)
        self.assertAlmostEqual(bar.size[0], 30)
        self.assertAlmostEqual(bar.size[1], 30)
        self.assertAlmostEqual(bar.volume_mm3, 500 * 30 * 30)
    
    def test_create_wheel_tire_position(self):
        wheel = create_wheel_tire(1, "W", 270, 250, [100, 200, 300])
        np.testing.assert_array_equal(wheel.position, [100, 200, 300])
        # Size: [width, dia, dia]
        self.assertAlmostEqual(wheel.size[0], 250)
        self.assertAlmostEqual(wheel.size[1], 540)
        self.assertAlmostEqual(wheel.size[2], 540)


class TestVoxelEngineEdgeCases(unittest.TestCase):
    """Edge case tests for VoxelEngine"""
    
    def test_add_duplicate_voxel(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(16, 16, 16)
        engine.set_voxel(1, 2, 3, "titanio")
        engine.set_voxel(1, 2, 3, "alluminio")  # override
        key = (1, 2, 3)
        self.assertIn(key, engine.voxel_map)
        self.assertEqual(engine.voxel_map[key].material, "alluminio")
    
    def test_remove_nonexistent_voxel(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(16, 16, 16)
        # Should not crash
        engine.remove_voxel(99, 99, 99)
        self.assertEqual(len(engine.voxel_map), 0)
    
    def test_com_empty(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(16, 16, 16)
        self.assertEqual(engine.calculate_com(), (0, 0, 0))
    
    def test_mass_empty(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(16, 16, 16)
        self.assertEqual(engine.calculate_mass(), 0.0)
    
    def test_save_load_with_modules(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(16, 16, 16)
        engine.set_voxel(0, 0, 0, "titanio", "mod_a")
        engine.set_voxel(1, 1, 1, "carbonio", "mod_b")
        engine.create_module("mod_a")
        engine.create_module("mod_b", function="test")
        
        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
            path = f.name
        
        try:
            engine.save_json(path)
            engine2 = VoxelEngine(16, 16, 16)
            engine2.load_json(path)
            self.assertEqual(len(engine2.voxel_map), 2)
            self.assertGreater(len(engine2.modules), 0)
        finally:
            os.unlink(path)
    
    def test_coordinate_boundaries(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(8, 8, 8)
        # Coordinates at boundaries
        engine.set_voxel(0, 0, 0, "acciaio")
        engine.set_voxel(7, 7, 7, "acciaio")
        self.assertEqual(len(engine.voxel_map), 2)
        
        # Out of bounds coordinates → ValueError
        with self.assertRaises(ValueError):
            engine.set_voxel(-1, 0, 0, "acciaio")
        with self.assertRaises(ValueError):
            engine.set_voxel(8, 0, 0, "acciaio")
    
    def test_module_assignment(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(16, 16, 16)
        engine.create_module("my_module")
        engine.set_voxel(5, 5, 5, "titanio", "my_module")
        voxel = engine.voxel_map[(5, 5, 5)]
        self.assertEqual(voxel.module, "my_module")


class TestMaterialsPython(unittest.TestCase):
    """Python materials tests"""
    
    def test_all_materials_exist(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(8, 8, 8)
        expected = ["titanio", "carbonio", "alluminio", "acciaio", "vetro"]
        for mat in expected:
            self.assertIn(mat, engine.material_properties)
    
    def test_material_properties_values(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(8, 8, 8)
        titanio = engine.material_properties["titanio"]
        self.assertAlmostEqual(titanio["density"], 4500.0)
        self.assertGreater(titanio["temperature_limit"], 0)
        self.assertTrue(titanio["color"].startswith("#"))


class TestPhysicsPython(unittest.TestCase):
    """Physics tests"""
    
    def test_stress_analysis_different_materials(self):
        from voxel_editor import VoxelEngine
        from physics_engine import stress_analysis
        engine = VoxelEngine(16, 16, 16)
        engine.set_voxel(5, 5, 5, "titanio")
        result = stress_analysis(engine, (0, 0, -1e6))
        self.assertIsInstance(result, dict)
        key = (5, 5, 5)
        self.assertIn(key, result)
    
    def test_thermal_analysis(self):
        from voxel_editor import VoxelEngine
        from physics_engine import thermal_analysis
        engine = VoxelEngine(16, 16, 16)
        engine.set_voxel(8, 8, 8, "acciaio")
        result = thermal_analysis(engine)
        self.assertIsInstance(result, dict)
    
    def test_safety_check_pass(self):
        from voxel_editor import VoxelEngine
        from physics_engine import stress_analysis, check_safety_margins
        engine = VoxelEngine(16, 16, 16)
        for x in range(16):
            for z in range(16):
                engine.set_voxel(x, 8, z, "carbonio")
        
        stress = stress_analysis(engine, (0, 0, -1e6))
        temps = thermal_analysis = lambda e, hp, p: {}
        issues = check_safety_margins(engine, stress, {})
        self.assertIsInstance(issues, list)
    
    def test_component_system(self):
        """Tests for the component system"""
        
        def setUp(self):
            self.library = ComponentLibrary("data/test_components")
        
        def test_library_has_defaults(self):
            comps = self.library.get_all()
            self.assertGreater(len(comps), 0)
        
        def test_get_by_id(self):
            wheel = self.library.get(1)
            self.assertIsNotNone(wheel)
            self.assertIn("Wheel", wheel.name)
        
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
    """Physics integration tests"""
    
    def test_mass_calculation(self):
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(10, 10, 10)
        engine.set_voxel(0, 0, 0, "titanio")
        mass = engine.calculate_mass()
        # 1 voxel = 1mm³ = 1e-9 m³; titanium density = 4500 kg/m³
        # Mass = 4500 * 1e-9 = 4.5e-6 kg
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
        engine.set_voxel(1, 2, 3, "carbonio", "frame")
        engine.create_module("test", "test")
        
        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
            filepath = f.name
        
        try:
            engine.save_json(filepath)
            engine2 = VoxelEngine(10, 10, 10)
            engine2.load_json(filepath)
            
            self.assertEqual(len(engine2.voxel_map), 1)
            # Accept both tuple (1,2,3) and string '1,2,3' as key
            found = any(str(k) == '1,2,3' or k == (1,2,3) for k in engine2.voxel_map.keys())
            self.assertTrue(found, f"Voxel (1,2,3) not found. Keys: {list(engine2.voxel_map.keys())}")
        finally:
            os.unlink(filepath)


if __name__ == '__main__':
    unittest.main(verbosity=2)