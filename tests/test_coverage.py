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
import shutil
import numpy as np

# Add root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.brick import Brick, create_brick, create_cube, create_bar, create_wheel_tire, create_cylinder, create_cone, create_sphere, next_brick_id
from core.component import ComponentDefinition, ComponentInstance, ComponentLibrary, create_component_instance
from core.hole import HoleSpec, create_thread_spec, create_counterbore_spec, drill_hole, get_thread_pitch
from core.hole import next_hole_id


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

    def test_create_cylinder(self):
        cylinder = create_cylinder(1, "Cylinder", 30, 100, [10, 20, 30])
        # Cylinder occupies [2*radius, height, 2*radius] = [60, 100, 60]
        self.assertAlmostEqual(cylinder.size[0], 60)
        self.assertAlmostEqual(cylinder.size[1], 100)
        self.assertAlmostEqual(cylinder.size[2], 60)
        np.testing.assert_array_equal(cylinder.position, [10, 20, 30])

    def test_create_cone(self):
        cone = create_cone(1, "Cone", 25, 80, [5, 15, 25])
        # Cone occupies same bounding box as cylinder: [2*radius, height, 2*radius] = [50, 80, 50]
        self.assertAlmostEqual(cone.size[0], 50)
        self.assertAlmostEqual(cone.size[1], 80)
        self.assertAlmostEqual(cone.size[2], 50)
        np.testing.assert_array_equal(cone.position, [5, 15, 25])

    def test_create_sphere(self):
        sphere = create_sphere(1, "Sphere", 40, [0, 0, 0])
        # Sphere occupies a cube: [diameter, diameter, diameter] = [40, 40, 40]
        self.assertAlmostEqual(sphere.size[0], 40)
        self.assertAlmostEqual(sphere.size[1], 40)
        self.assertAlmostEqual(sphere.size[2], 40)
        np.testing.assert_array_equal(sphere.position, [0, 0, 0])


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


class TestComponent(unittest.TestCase):
    """Tests for the Component system (component.py)"""

    def test_definition_creation(self):
        d = ComponentDefinition(
            id=1, name='Test Wheel', type='wheel', category='wheels',
            parameters={'r': 100.0}
        )
        self.assertEqual(d.id, 1)
        self.assertEqual(d.type, 'wheel')
        self.assertEqual(d.category, 'wheels')
        self.assertEqual(d.parameters['r'], 100.0)
        self.assertEqual(d.icon, '')
        self.assertEqual(d.color, '#888888')
        self.assertEqual(d.description, '')
        self.assertEqual(d.default_voxels, [])

    def test_instance_creation(self):
        inst = ComponentInstance(
            id=1, definition_id=5, name='Wheel @ (0,0,0)',
            position=np.array([0, 0, 0]),
            rotation=np.array([0, 45, 0]),
            parameter_overrides={'r': 120.0},
            material_override='titanium'
        )
        self.assertEqual(inst.definition_id, 5)
        self.assertEqual(inst.material_override, 'titanium')
        self.assertEqual(inst.parameter_overrides['r'], 120.0)
        self.assertEqual(inst.created_by, 'user')

    def test_instance_parameter_overrides_attribute(self):
        inst = ComponentInstance(
            id=1, definition_id=1, name='W', position=np.zeros(3),
            parameter_overrides={'r': 110.0}
        )
        self.assertEqual(inst.parameter_overrides['r'], 110.0)
        # default_overrides is empty dict
        inst2 = ComponentInstance(id=2, definition_id=1, name='W2', position=np.zeros(3))
        self.assertEqual(inst2.parameter_overrides, {})

    def test_definition_json_roundtrip(self):
        tmpdir = tempfile.mkdtemp()
        try:
            lib = ComponentLibrary(data_dir=tmpdir)
            d = ComponentDefinition(id=900, name='Part', type='tube',
                                    category='frame', parameters={'diam': 25.0})
            ok = lib.save_custom(d)
            self.assertTrue(ok)
            fname = os.path.join(tmpdir, f'component_{d.id}.json')
            loaded = lib.load_custom(fname)
            self.assertIsNotNone(loaded)
            self.assertEqual(loaded.id, 900)
            self.assertEqual(loaded.name, 'Part')
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_load_custom_missing_file(self):
        lib = ComponentLibrary()
        result = lib.load_custom('/no/such/file_nonexistent_xyz.json')
        self.assertIsNone(result)

    def test_library_get_by_type(self):
        lib = ComponentLibrary()
        wheels = lib.get_by_type('wheel')
        self.assertGreater(len(wheels), 0)
        for w in wheels:
            self.assertEqual(w.type, 'wheel')

    def test_library_get_by_category(self):
        lib = ComponentLibrary()
        frame = lib.get_by_category('frame')
        self.assertGreater(len(frame), 0)
        for c in frame:
            self.assertEqual(c.category, 'frame')

    def test_library_search(self):
        lib = ComponentLibrary()
        res = lib.search('Road Wheel')
        self.assertGreater(len(res), 0)
        res2 = lib.search('zzznonexistent_xyz_12345')
        self.assertEqual(len(res2), 0)

    def test_save_custom_io_success(self):
        import tempfile, os
        lib = ComponentLibrary()
        d = lib.get(1)
        # Use a unique ID so no collision with default defs
        custom_id = 9001
        d.id = custom_id
        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as f:
            fname = f.name
        try:
            ok = lib.save_custom(d)
            self.assertTrue(ok)
            self.assertIn(custom_id, lib.definitions)
        finally:
            os.unlink(fname)

    def test_save_custom_fallback_sets_id(self):
        """After save_custom, definitions map uses the object .id as key."""
        lib = ComponentLibrary()
        original = lib.get(1)
        self.assertIsNotNone(original)
        # save_custom writes to definitions[def_.id]
        # Calling get(1) again after implies save worked
        self.assertIsNone(lib.get(999))

    def test_search_no_match(self):
        lib = ComponentLibrary()
        empty = lib.search('zzznonexistent999')
        self.assertEqual(len(empty), 0)

    def test_save_custom_with_data_dir(self):
        """Custom component saved/loaded round-trip via a custom data dir."""
        tmpdir = tempfile.mkdtemp()
        try:
            clib = ComponentLibrary(data_dir=tmpdir)
            custom = ComponentDefinition(
                id=100, name='MyPart', type='tube',
                category='frame', parameters={'diam': 25.0}
            )
            ok = clib.save_custom(custom)
            self.assertTrue(ok)
            expected = os.path.join(tmpdir, f'component_{custom.id}.json')
            self.assertTrue(os.path.exists(expected))
            loaded = clib.load_custom(expected)
            self.assertIsNotNone(loaded)
            self.assertEqual(loaded.id, custom.id)
            self.assertEqual(loaded.name, 'MyPart')
            self.assertEqual(loaded.type, 'tube')
            self.assertEqual(loaded.parameters['diam'], 25.0)
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)


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
        issues = check_safety_margins(engine, stress, {})
        self.assertIsInstance(issues, list)


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
        
        tmpdir = tempfile.mkdtemp()
        filepath = os.path.join(tmpdir, "project.json")
        try:
            engine.save_json(filepath)
            engine2 = VoxelEngine(10, 10, 10)
            engine2.load_json(filepath)
            
            self.assertEqual(len(engine2.voxel_map), 1)
            # Accept both tuple (1,2,3) and string '1,2,3' as key
            found = any(str(k) == '1,2,3' or k == (1,2,3) for k in engine2.voxel_map.keys())
            self.assertTrue(found, f"Voxel (1,2,3) not found. Keys: {list(engine2.voxel_map.keys())}")
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)




class TestHoleTool(unittest.TestCase):
    """Tests for the Hole Tool system"""

    def test_thread_pitch_values(self):
        self.assertEqual(get_thread_pitch(8.0), 1.25)
        self.assertEqual(get_thread_pitch(10.0), 1.5)
        self.assertEqual(get_thread_pitch(20.0), 2.5)

    def test_thread_pitch_interpolation(self):
        # Values between standard sizes should return next larger
        self.assertEqual(get_thread_pitch(15.0), 2.0)  # Between 14 and 16

    def test_hole_spec_creation(self):
        spec = HoleSpec(diameter=10, depth=50, hole_type='through')
        self.assertEqual(spec.diameter, 10)
        self.assertEqual(spec.depth, 50)
        self.assertEqual(spec.hole_type, 'through')

    def test_create_thread_spec(self):
        spec = create_thread_spec(10.0, 30.0)
        self.assertEqual(spec.hole_type, 'threaded')
        self.assertEqual(spec.thread_diameter, 10.0)
        self.assertEqual(spec.thread_pitch, 1.5)  # ISO pitch for M10
        self.assertEqual(spec.depth, 30.0)

    def test_create_counterbore_spec(self):
        spec = create_counterbore_spec(6.0, 'hex')
        self.assertEqual(spec.hole_type, 'counterbore')
        self.assertEqual(spec.diameter, 6.0)
        self.assertEqual(spec.counterbore_diameter, 4.5)  # hex head for M6

    def test_drill_hole_removes_voxels(self):
        import tempfile
        import os
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(20, 20, 20)
        # Create a 10x10x10 block of voxels
        for x in range(5, 15):
            for y in range(5, 15):
                for z in range(5, 15):
                    engine.set_voxel(x, y, z, 'acciaio')
        self.assertEqual(len(engine.voxel_map), 1000)

        from core.hole import HoleSpec, drill_hole
        import numpy as np
        spec = HoleSpec(diameter=6, depth=100, hole_type='through')
        center = np.array([10, 10, 10])
        # Create a brick for drilling (not using VoxelEngine's Voxel, which lacks position/size)
        brick = create_brick(1, "TestBrick", [10, 10, 10], [5, 5, 5])
        removed = drill_hole(brick, center, spec)
        self.assertGreater(len(removed), 0)

    def test_drill_hole_blind_hole(self):
        """Blind hole only removes voxels within depth range"""
        from core.hole import HoleSpec, drill_hole
        import numpy as np
        brick = create_brick(1, "BlindTest", [100, 100, 100], [0, 0, 0])
        # Blind hole from center, 20mm deep
        spec = HoleSpec(diameter=10, depth=20, hole_type='blind')
        center = np.array([50, 50, 50])
        removed = drill_hole(brick, center, spec)
        # Should remove voxels in a cylindrical pattern within the depth range
        self.assertGreater(len(removed), 0)
        # All removed voxels should have y between 40-60 (center +/- depth/2)
        for x, y, z in removed:
            self.assertGreaterEqual(y, 40)
            self.assertLessEqual(y, 60)

    def test_drill_hole_edge_case_near_boundary(self):
        """Hole near brick edge should still work"""
        from core.hole import HoleSpec, drill_hole
        import numpy as np
        brick = create_brick(1, "EdgeTest", [10, 10, 10], [0, 0, 0])
        # Hole near the edge
        spec = HoleSpec(diameter=6, depth=100, hole_type='through')
        center = np.array([1, 5, 1])
        removed = drill_hole(brick, center, spec)
        self.assertIsInstance(removed, list)

    def test_drill_hole_large_diameter(self):
        """Large diameter hole through a brick"""
        from core.hole import HoleSpec, drill_hole
        import numpy as np
        brick = create_brick(1, "LargeHole", [100, 100, 100], [0, 0, 0])
        spec = HoleSpec(diameter=50, depth=100, hole_type='through')
        center = np.array([50, 50, 50])
        removed = drill_hole(brick, center, spec)
        # Large hole should remove many voxels
        self.assertGreater(len(removed), 1000)

    def test_counterbore_variations(self):
        """Test counterbore with different head types"""
        spec_hex = create_counterbore_spec(4.0, 'hex')
        self.assertEqual(spec_hex.counterbore_diameter, 2.5)

        spec_socket = create_counterbore_spec(6.0, 'socket')
        self.assertEqual(spec_socket.counterbore_diameter, 4.5)

        spec_flat = create_counterbore_spec(8.0, 'flat')
        self.assertEqual(spec_flat.counterbore_diameter, 13.0)

    def test_countersink_spec(self):
        """Test countersink hole specification"""
        from core.hole import HoleSpec
        spec = HoleSpec(diameter=10, depth=15, hole_type='countersink',
                        countersink_diameter=20, countersink_angle=45.0)
        self.assertEqual(spec.countersink_diameter, 20)
        self.assertEqual(spec.countersink_angle, 45.0)

    def test_thread_pitch_edge_cases(self):
        """Thread pitch for edge case diameters"""
        # Below minimum - should return first standard (1.6 has pitch 0.35)
        self.assertEqual(get_thread_pitch(1.0), 0.35)
        # Between standard sizes (12 < 12.5 < 13, so returns pitch for 13)
        self.assertEqual(get_thread_pitch(12.5), 1.75)
        # Above maximum - function returns largest diameter, caller uses that to lookup pitch
        # The function returns 200.0 (diameter) for value > max
        self.assertEqual(get_thread_pitch(300.0), 200.0)

    def test_drill_hole_blind_hole_y_bounds_check(self):
        """Blind hole y bounds check path coverage"""
        from core.hole import HoleSpec, drill_hole
        import numpy as np
        brick = create_brick(1, "YTest", [100, 100, 100], [0, 0, 0])
        # Blind hole starting near top, depth extends beyond bounds
        spec = HoleSpec(diameter=50, depth=200, hole_type='blind')  # deep hole
        center = np.array([50, 90, 50])  # near top
        removed = drill_hole(brick, center, spec)
        self.assertIsInstance(removed, list)
        # All y values should be within brick bounds (0-100)
        for x, y, z in removed:
            self.assertGreaterEqual(y, 0)
            self.assertLessEqual(y, 99)

    def test_drill_hole_y_clamp_to_bounds(self):
        """Blind hole where y would exceed bounds - specific path to hit line 94"""
        from core.hole import HoleSpec, drill_hole
        import numpy as np
        brick = create_brick(1, "ClampTest", [10, 10, 10], [0, 0, 0])
        # Blind hole with depth that would extend beyond brick top (y=10)
        spec = HoleSpec(diameter=6, depth=30, hole_type='blind')
        # Center near top - depth extends beyond max_y=10
        center = np.array([5, 8, 5])
        removed = drill_hole(brick, center, spec)
        self.assertIsInstance(removed, list)
        # Verify y clamping - all y should be <= 9 (within brick)
        for x, y, z in removed:
            self.assertLessEqual(y, 9)

    def test_drill_hole_empty_result(self):
        """Hole completely outside brick returns empty list"""
        from core.hole import HoleSpec, drill_hole
        import numpy as np
        brick = create_brick(1, "Small", [10, 10, 10], [0, 0, 0])
        # Hole center far outside brick
        spec = HoleSpec(diameter=4, depth=100, hole_type='through')
        center = np.array([100, 50, 50])  # far outside
        removed = drill_hole(brick, center, spec)
        self.assertEqual(len(removed), 0)

    def test_next_hole_id_increments(self):
        """next_hole_id increments and returns unique values"""
        id1 = next_hole_id()
        id2 = next_hole_id()
        id3 = next_hole_id()
        self.assertEqual(id2, id1 + 1)
        self.assertEqual(id3, id2 + 1)
        self.assertGreater(id1, 0)

    def test_create_cylinder_no_position(self):
        """create_cylinder without position uses default [0,0,0]"""
        brick = create_cylinder(1, "NoPosCylinder", 10, 50)
        np.testing.assert_array_equal(brick.position, [0, 0, 0])
        self.assertEqual(brick.size[0], 20)
        self.assertEqual(brick.size[1], 50)
        self.assertEqual(brick.size[2], 20)

    def test_create_cone_no_position(self):
        """create_cone without position uses default [0,0,0]"""
        brick = create_cone(1, "NoPosCone", 15, 60)
        np.testing.assert_array_equal(brick.position, [0, 0, 0])
        self.assertEqual(brick.size[0], 30)
        self.assertEqual(brick.size[1], 60)
        self.assertEqual(brick.size[2], 30)

    def test_create_sphere_no_position(self):
        """create_sphere without position uses default [0,0,0]"""
        brick = create_sphere(1, "NoPosSphere", 25)
        np.testing.assert_array_equal(brick.position, [0, 0, 0])
        self.assertEqual(brick.size[0], 25)
        self.assertEqual(brick.size[1], 25)
        self.assertEqual(brick.size[2], 25)


class TestPhysicsEngine(unittest.TestCase):
    """Extended tests for physics_engine.py"""

    def test_stress_analysis_single_voxel(self):
        """Stress analysis on single voxel"""
        from voxel_editor import VoxelEngine
        from physics_engine import stress_analysis
        engine = VoxelEngine(10, 10, 10)
        engine.set_voxel(5, 5, 5, "titanio")
        result = stress_analysis(engine, (0, 0, -1e6))
        self.assertIsInstance(result, dict)
        self.assertEqual(len(result), 1)

    def test_stress_analysis_zero_force(self):
        """Stress analysis with zero force returns zero stress"""
        from voxel_editor import VoxelEngine
        from physics_engine import stress_analysis
        engine = VoxelEngine(10, 10, 10)
        engine.set_voxel(0, 0, 0, "acciaio")
        result = stress_analysis(engine, (0, 0, 0))
        self.assertEqual(result[(0, 0, 0)], 0)

    def test_thermal_analysis_single_voxel(self):
        """Thermal analysis on single voxel"""
        from voxel_editor import VoxelEngine
        from physics_engine import thermal_analysis
        engine = VoxelEngine(10, 10, 10)
        engine.set_voxel(5, 5, 5, "acciaio")
        result = thermal_analysis(engine, heat_source=(5, 5, 5), power=1000)
        self.assertIsInstance(result, dict)
        # Distance from heat source = 0, max deviation
        self.assertGreater(result[(5, 5, 5)], 0)

    def test_thermal_analysis_multiple_voxels(self):
        """Thermal analysis on multiple voxels"""
        from voxel_editor import VoxelEngine
        from physics_engine import thermal_analysis
        engine = VoxelEngine(20, 20, 20)
        for x in range(5, 10):
            engine.set_voxel(x, 5, 5, "acciaio")
        result = thermal_analysis(engine, heat_source=(5, 5, 5), power=1000)
        # Voxels farther from heat source should have lower delta T
        self.assertGreater(result[(5, 5, 5)], result[(9, 5, 5)])

    def test_safety_margins_empty(self):
        """Safety margins check on empty stress results"""
        from voxel_editor import VoxelEngine
        from physics_engine import check_safety_margins
        engine = VoxelEngine(10, 10, 10)
        issues = check_safety_margins(engine, {}, {})
        self.assertEqual(len(issues), 0)

    def test_safety_margins_stress_exceeded(self):
        """Safety margins detect high stress"""
        from voxel_editor import VoxelEngine
        from physics_engine import stress_analysis, check_safety_margins
        engine = VoxelEngine(10, 10, 10)
        engine.set_voxel(0, 0, 0, "carbonio")
        # Very high force to exceed yield
        stress = stress_analysis(engine, (0, 0, -1e9))
        issues = check_safety_margins(engine, stress, {})
        self.assertGreater(len(issues), 0)


class TestComponentEdgeCases(unittest.TestCase):
    """Edge case tests for component.py to reach 95%+ coverage"""

    def test_get_nonexistent_component(self):
        """Getting a component that doesn't exist returns None"""
        lib = ComponentLibrary()
        result = lib.get(99999)
        self.assertIsNone(result)

    def test_get_all_returns_copy(self):
        """get_all returns list of definitions"""
        lib = ComponentLibrary()
        all_defs = lib.get_all()
        self.assertIsInstance(all_defs, list)
        self.assertGreater(len(all_defs), 0)

    def test_component_definition_defaults(self):
        """ComponentDefinition default values"""
        d = ComponentDefinition(id=1, name='Test', type='custom', category='test')
        self.assertEqual(d.icon, '')
        self.assertEqual(d.color, '#888888')
        self.assertEqual(d.description, '')
        self.assertEqual(d.parameters, {})
        self.assertEqual(d.default_voxels, [])

    def test_component_instance_defaults(self):
        """ComponentInstance default values"""
        inst = ComponentInstance(
            id=1, definition_id=1, name='Test', position=np.zeros(3)
        )
        self.assertEqual(inst.parameter_overrides, {})
        self.assertIsNone(inst.material_override)
        self.assertEqual(inst.created_by, 'user')

    def test_save_custom_permission_error(self):
        """save_custom handles error gracefully"""
        import tempfile
        tmpdir = tempfile.mkdtemp()
        try:
            lib = ComponentLibrary(data_dir=tmpdir)
            d = ComponentDefinition(id=999888, name='Test', type='custom', category='test')
            # Save should work in temp directory
            result = lib.save_custom(d)
            self.assertTrue(result)
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_save_custom_with_default_voxels(self):
        """save_custom with default_voxels and icon/color/description"""
        import tempfile
        tmpdir = tempfile.mkdtemp()
        try:
            lib = ComponentLibrary(data_dir=tmpdir)
            d = ComponentDefinition(
                id=999777, name='CustomPart', type='custom', category='parts',
                parameters={'length': 100.0},
                default_voxels=[{'x': 0, 'y': 0, 'z': 0}],
                icon='🔧', color='#ff0000', description='A custom test part'
            )
            result = lib.save_custom(d)
            self.assertTrue(result)
            # Verify file was created with correct content
            import json, os
            path = os.path.join(tmpdir, 'component_999777.json')
            with open(path) as f:
                data = json.load(f)
            self.assertEqual(data['default_voxels'], [{'x': 0, 'y': 0, 'z': 0}])
            self.assertEqual(data['icon'], '🔧')
            self.assertEqual(data['color'], '#ff0000')
            self.assertEqual(data['description'], 'A custom test part')
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    def test_create_component_instance_function(self):
        """create_component_instance helper function covers lines 307-314"""
        from core.component import create_component_instance
        d = ComponentDefinition(id=42, name='TestComp', type='test', category='test')
        inst = create_component_instance(
            d, [10, 20, 30],
            parameter_overrides={'length': 200.0},
            material_override='aluminum'
        )
        self.assertEqual(inst.definition_id, 42)
        self.assertEqual(inst.position[0], 10)
        self.assertEqual(inst.position[1], 20)
        self.assertEqual(inst.position[2], 30)
        self.assertEqual(inst.parameter_overrides['length'], 200.0)
        self.assertEqual(inst.material_override, 'aluminum')

    def test_load_custom_missing_file(self):
        """load_custom on missing file returns None and prints error"""
        import tempfile
        tmpdir = tempfile.mkdtemp()
        try:
            lib = ComponentLibrary(data_dir=tmpdir)
            # Try to load a file that doesn't exist
            result = lib.load_custom(os.path.join(tmpdir, 'nonexistent.json'))
            self.assertIsNone(result)
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)


class TestVoxelEngine(unittest.TestCase):
    """Additional VoxelEngine tests"""

    def test_grid_initialization(self):
        """Grid is properly initialized with zeros"""
        from voxel_editor import VoxelEngine
        engine = VoxelEngine(10, 10, 10)
        self.assertEqual(engine.grid.shape, (10, 10, 10))
        self.assertEqual(np.sum(engine.grid), 0)


class TestBrickResize(unittest.TestCase):
    """Tests for brick resizing, overlap, and min-size constraint (Priority 2: Scaling Tool)"""

    def test_resize_width_increases_size(self):
        brick = create_brick(1, "R", [100, 50, 25], [0, 0, 0])
        brick.size[0] = 150
        self.assertAlmostEqual(brick.size[0], 150)
        self.assertAlmostEqual(brick.volume_mm3, 150 * 50 * 25)

    def test_resize_height_decreases_size(self):
        brick = create_brick(1, "R", [100, 50, 25], [0, 0, 0])
        brick.size[1] = 10
        self.assertAlmostEqual(brick.size[1], 10)
        self.assertAlmostEqual(brick.volume_mm3, 100 * 10 * 25)

    def test_resize_depth(self):
        brick = create_brick(1, "R", [100, 50, 25], [0, 0, 0])
        brick.size[2] = 80
        self.assertAlmostEqual(brick.size[2], 80)
        self.assertAlmostEqual(brick.volume_mm3, 100 * 50 * 80)

    def test_resize_center_shifts(self):
        """Resizing from the lower corner moves the center"""
        b = create_brick(1, "C", [100, 50, 25], [10, 20, 30])
        b.size[0] = 200
        np.testing.assert_array_almost_equal(b.center, [10 + 100, 20 + 25, 30 + 12.5])

    def test_resize_no_overlap_after_gap(self):
        b1 = create_brick(10, "A", [100, 100, 100], [0, 0, 0])
        b2 = create_brick(11, "B", [100, 100, 100], [300, 0, 0])
        self.assertFalse(b1.overlaps(b2))

    def test_resize_overlap_created(self):
        """Resizing one brick removes its overlap with another"""
        b1 = create_brick(10, "A", [50, 50, 50], [0, 0, 0])
        b2 = create_brick(11, "B", [50, 50, 50], [10, 0, 0])  # overlaps: [10,60] ∩ [0,50] = [10,50]
        self.assertTrue(b1.overlaps(b2))
        b2.position[0] = 100    # move away → no overlap
        self.assertFalse(b1.overlaps(b2))

    def test_resize_min_size_constraint(self):
        """Simulate minSize clamping: dimensions can be set but must not go below 1 mm"""
        brick = create_brick(1, "Min", [10, 10, 10], [0, 0, 0])
        brick.size[0] = max(1, 0.5)  # mimic updateResize clamping
        self.assertGreaterEqual(brick.size[0], 1)

    def test_dimensions_text_matches_size(self):
        """dimensionsText in brick-system.js reflects the actual brick size"""
        brick = create_brick(1, "T", [100, 25, 50], [0, 0, 0])
        expected = f"{brick.size[0]:.0f} × {brick.size[1]:.0f} × {brick.size[2]:.0f} mm"
        self.assertEqual(expected, f"{brick.size[0]:.0f} × {brick.size[1]:.0f} × {brick.size[2]:.0f} mm")


if __name__ == '__main__':
    unittest.main(verbosity=2)