import json
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
try:
    from physics_wrapper import calculate_mass as c_calculate_mass
    from physics_wrapper import calculate_com as c_calculate_com
    HAS_C_API = True
except ImportError:
    HAS_C_API = False

@dataclass
class Voxel:
    x: int
    y: int
    z: int
    material: str
    density: float
    temperature_limit: float
    module: str
    color: str

@dataclass
class Brick:
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    width: float = 10.0
    height: float = 10.0
    depth: float = 10.0
    material: str = "alluminio"
    density: float = 2700.0
    temperature_limit: float = 660.0
    module: str = "default"
    color: str = "#A8A8A8"
    
    @property
    def volume_mm3(self) -> float:
        return self.width * self.height * self.depth
    
    @property
    def mass_kg(self) -> float:
        return self.volume_mm3 * self.density / 1_000_000

@dataclass
class Module:
    name: str
    voxels: List[Voxel] = field(default_factory=list)
    tolerance: float = 0.01
    function: str = ""
    properties: Dict[str, Any] = field(default_factory=dict)

@dataclass
class Component:
    name: str
    type: str
    parameters: Dict[str, float] = field(default_factory=dict)
    default_material: str = "alluminio"
    
    def get_bricks(self, x: float, y: float, z: float) -> List[Brick]:
        pass

class WheelComponent(Component):
    def __init__(self):
        super().__init__(
            name="Wheel",
            type="wheel",
            parameters={"radius": 270.0, "width": 250.0, "rim_radius": 260.0}
        )
    
    def get_bricks(self, x: float, y: float, z: float) -> List[Brick]:
        r = self.parameters["radius"]
        w = self.parameters["width"]
        rr = self.parameters["rim_radius"]
        return [
            Brick(x=x, y=y, z=z, width=w, height=r*2, depth=r*2, material="titanio"),
            Brick(x=x+w*0.1, y=y, z=z+w*0.1, width=w*0.8, height=rr*2, depth=rr*2, material="acciaio")
        ]

class BeamComponent(Component):
    def __init__(self, length: float = 200.0, thickness: float = 20.0):
        super().__init__(
            name="Beam",
            type="beam",
            parameters={"length": length, "thickness": thickness}
        )
    
    def get_bricks(self, x: float, y: float, z: float) -> List[Brick]:
        l = self.parameters["length"]
        t = self.parameters["thickness"]
        return [Brick(x=x, y=y, z=z, width=l, height=t, depth=t, material="acciaio")]

class ComponentLibrary:
    def __init__(self):
        self.components: Dict[str, Component] = {}
        self._register_defaults()
    
    def _register_defaults(self):
        self.components["wheel_26"] = WheelComponent()
        self.components["wheel_27"] = WheelComponent()
        self.components["wheel_28"] = WheelComponent()
        self.components["beam_200"] = BeamComponent(200.0, 20.0)
        self.components["beam_400"] = BeamComponent(400.0, 20.0)
    
    def create_instance(self, name: str, x: float = 0.0, y: float = 0.0, z: float = 0.0) -> 'ComponentInstance':
        if name not in self.components:
            raise ValueError(f"Unknown component: {name}")
        return ComponentInstance(self.components[name], x, y, z)

@dataclass
class ComponentInstance:
    component: Component
    x: float
    y: float
    z: float
    rotation: float = 0.0
    
    def get_bricks(self) -> List[Brick]:
        return self.component.get_bricks(self.x, self.y, self.z)

class BrickEngine:
    def __init__(self):
        self.bricks: List[Brick] = []
        self.material_properties = self._init_materials()
        self.modules: Dict[str, Module] = {}
        self.active_module: Optional[str] = None
        self.component_library = ComponentLibrary()
        self.component_instances: List[ComponentInstance] = []

    def _init_materials(self) -> Dict[str, Dict[str, float]]:
        return {
            "titanio": {"density": 4500.0, "temperature_limit": 1668.0, "color": "#C0C0C0"},
            "carbonio": {"density": 1750.0, "temperature_limit": 3600.0, "color": "#2C2C2C"},
            "alluminio": {"density": 2700.0, "temperature_limit": 660.0, "color": "#A8A8A8"},
            "acciaio": {"density": 7850.0, "temperature_limit": 1371.0, "color": "#4A4A4A"},
            "vetro": {"density": 2500.0, "temperature_limit": 560.0, "color": "#87CEEB"},
        }

    def create_brick(self, x: float, y: float, z: float, 
                     width: float, height: float, depth: float, 
                     material: str, module: str = None):
        if material not in self.material_properties:
            raise ValueError(f"Unknown material: {material}")
        
        mat_props = self.material_properties[material]
        brick = Brick(
            x=x, y=y, z=z,
            width=width, height=height, depth=depth,
            material=material,
            density=mat_props["density"],
            temperature_limit=mat_props["temperature_limit"],
            module=module or self.active_module or "default",
            color=mat_props["color"]
        )
        
        self.bricks.append(brick)
        return brick

    def add_component(self, component_name: str, x: float, y: float, z: float):
        instance = self.component_library.create_instance(component_name, x, y, z)
        self.component_instances.append(instance)
        for brick in instance.get_bricks():
            self.bricks.append(brick)
        return instance

    def calculate_mass(self) -> float:
        return sum(brick.mass_kg for brick in self.bricks)
    
    def calculate_mass_fast(self) -> float:
        if not HAS_C_API:
            return self.calculate_mass()
        bricks_data = [{'x': b.x, 'y': b.y, 'z': b.z, 'width': b.width, 
                        'height': b.height, 'depth': b.depth, 'density': b.density} 
                       for b in self.bricks]
        return c_calculate_mass(bricks_data)

    def calculate_com(self) -> tuple:
        if not self.bricks:
            return (0.0, 0.0, 0.0)
        
        total_mass = 0.0
        weighted_x = 0.0
        weighted_y = 0.0
        weighted_z = 0.0
        
        for brick in self.bricks:
            m = brick.mass_kg
            cx = brick.x + brick.width / 2
            cy = brick.y + brick.height / 2
            cz = brick.z + brick.depth / 2
            total_mass += m
            weighted_x += m * cx
            weighted_y += m * cy
            weighted_z += m * cz
        
        if total_mass == 0:
            return (0.0, 0.0, 0.0)
        return (weighted_x / total_mass, weighted_y / total_mass, weighted_z / total_mass)

    def calculate_com_fast(self) -> tuple:
        if not HAS_C_API:
            return self.calculate_com()
        bricks_data = [{'x': b.x, 'y': b.y, 'z': b.z, 'width': b.width,
                        'height': b.height, 'depth': b.depth, 'density': b.density}
                       for b in self.bricks]
        return c_calculate_com(bricks_data)

    def scale_brick(self, brick_index: int, scale_x: float = 1.0, scale_y: float = 1.0, scale_z: float = 1.0) -> bool:
        """Scale a brick along specified axes.
        
        Args:
            brick_index: Index of the brick in self.bricks list
            scale_x: Scale factor for X axis (width)
            scale_y: Scale factor for Y axis (height) 
            scale_z: Scale factor for Z axis (depth)
            
        Returns:
            True if successful, False if brick_index is invalid
        """
        if brick_index < 0 or brick_index >= len(self.bricks):
            return False
            
        brick = self.bricks[brick_index]
        brick.width *= scale_x
        brick.height *= scale_y
        brick.depth *= scale_z
        return True

    def set_brick_dimensions(self, brick_index: int, width: float, height: float, depth: float) -> bool:
        """Set exact dimensions for a brick.
        
        Args:
            brick_index: Index of the brick in self.bricks list
            width: New width in mm
            height: New height in mm
            depth: New depth in mm
            
        Returns:
            True if successful, False if brick_index is invalid
        """
        if brick_index < 0 or brick_index >= len(self.bricks):
            return False
            
        brick = self.bricks[brick_index]
        brick.width = width
        brick.height = height
        brick.depth = depth
        return True

    def save_bricks_json(self, filepath: str):
        data = {
            "bricks": [
                {
                    "x": b.x, "y": b.y, "z": b.z,
                    "width": b.width, "height": b.height, "depth": b.depth,
                    "material": b.material,
                    "density": b.density,
                    "temperature_limit": b.temperature_limit,
                    "module": b.module,
                    "color": b.color
                }
                for b in self.bricks
            ]
        }
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

    def load_bricks_json(self, filepath: str):
        with open(filepath, 'r') as f:
            data = json.load(f)
        self.bricks.clear()
        for brick_data in data["bricks"]:
            self.bricks.append(Brick(
                x=brick_data["x"], y=brick_data["y"], z=brick_data["z"],
                width=brick_data["width"], height=brick_data["height"], depth=brick_data["depth"],
                material=brick_data["material"],
                density=brick_data["density"],
                temperature_limit=brick_data["temperature_limit"],
                module=brick_data["module"],
                color=brick_data["color"]
            ))

class VoxelEngine:
    def __init__(self, size_x: int = 64, size_y: int = 64, size_z: int = 64):
        self.size_x = size_x
        self.size_y = size_y
        self.size_z = size_z
        self.grid = np.zeros((size_x, size_y, size_z), dtype=np.int32)
        self.voxel_map: Dict[tuple, Voxel] = {}
        self.modules: Dict[str, Module] = {}
        self.active_module: Optional[str] = None
        self.material_properties = self._init_materials()

    def _init_materials(self) -> Dict[str, Dict[str, float]]:
        return {
            "titanio": {"density": 4500.0, "temperature_limit": 1668.0, "color": "#C0C0C0"},
            "carbonio": {"density": 1750.0, "temperature_limit": 3600.0, "color": "#2C2C2C"},
            "alluminio": {"density": 2700.0, "temperature_limit": 660.0, "color": "#A8A8A8"},
            "acciaio": {"density": 7850.0, "temperature_limit": 1371.0, "color": "#4A4A4A"},
            "vetro": {"density": 2500.0, "temperature_limit": 560.0, "color": "#87CEEB"},
        }

    def set_voxel(self, x: int, y: int, z: int, material: str, module: str = None):
        if not (0 <= x < self.size_x and 0 <= y < self.size_y and 0 <= z < self.size_z):
            raise ValueError(f"Position ({x},{y},{z}) out of bounds")

        if material not in self.material_properties:
            raise ValueError(f"Unknown material: {material}")

        mat_props = self.material_properties[material]
        voxel = Voxel(
            x=x, y=y, z=z,
            material=material,
            density=mat_props["density"],
            temperature_limit=mat_props["temperature_limit"],
            module=module or self.active_module or "default",
            color=mat_props["color"]
        )

        self.grid[x, y, z] = 1
        self.voxel_map[(x, y, z)] = voxel

        module_name = module or self.active_module
        if module_name:
            if module_name not in self.modules:
                self.modules[module_name] = Module(name=module_name)
            self.modules[module_name].voxels.append(voxel)

    def remove_voxel(self, x: int, y: int, z: int):
        if (x, y, z) in self.voxel_map:
            voxel = self.voxel_map[(x, y, z)]
            if voxel.module in self.modules and voxel in self.modules[voxel.module].voxels:
                self.modules[voxel.module].voxels.remove(voxel)
            del self.voxel_map[(x, y, z)]
            self.grid[x, y, z] = 0

    def create_module(self, name: str, function: str = "", tolerance: float = 0.01, properties: Dict[str, Any] = None):
        self.modules[name] = Module(
            name=name,
            function=function,
            tolerance=tolerance,
            properties=properties or {}
        )

    def set_active_module(self, name: str):
        if name not in self.modules:
            raise ValueError(f"Module '{name}' does not exist")
        self.active_module = name

    def calculate_mass(self) -> float:
        voxel_volume = 1e-9  # 1 cubic mm = 1e-9 m^3
        total_mass = 0.0
        for voxel in self.voxel_map.values():
            total_mass += voxel.density * voxel_volume
        return total_mass

    def calculate_com(self) -> tuple:
        if not self.voxel_map:
            return (0, 0, 0)

        voxel_volume = 1e-9
        total_mass = 0.0
        weighted_x = 0.0
        weighted_y = 0.0
        weighted_z = 0.0

        for voxel in self.voxel_map.values():
            m = voxel.density * voxel_volume
            total_mass += m
            weighted_x += m * voxel.x
            weighted_y += m * voxel.y
            weighted_z += m * voxel.z

        if total_mass == 0:
            return (0, 0, 0)
        return (weighted_x / total_mass, weighted_y / total_mass, weighted_z / total_mass)

    def clear(self):
        self.grid.fill(0)
        self.voxel_map.clear()
        self.modules.clear()

    def save_json(self, filepath: str):
        data = {
            "dimensions": {"x": self.size_x, "y": self.size_y, "z": self.size_z},
            "voxels": [
                {
                    "x": v.x, "y": v.y, "z": v.z,
                    "material": v.material,
                    "density": v.density,
                    "temperature_limit": v.temperature_limit,
                    "module": v.module,
                    "color": v.color
                }
                for v in self.voxel_map.values()
            ],
            "modules": [
                {
                    "name": m.name,
                    "voxel_count": len(m.voxels),
                    "function": m.function,
                    "tolerance": m.tolerance,
                    "properties": m.properties
                }
                for m in self.modules.values()
            ]
        }
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)

    def load_json(self, filepath: str):
        with open(filepath, 'r') as f:
            data = json.load(f)

        self.clear()
        self.size_x = data["dimensions"]["x"]
        self.size_y = data["dimensions"]["y"]
        self.size_z = data["dimensions"]["z"]
        self.grid = np.zeros((self.size_x, self.size_y, self.size_z), dtype=np.int32)

        for voxel_data in data["voxels"]:
            self.set_voxel(
                x=voxel_data["x"],
                y=voxel_data["y"],
                z=voxel_data["z"],
                material=voxel_data["material"],
                module=voxel_data["module"]
            )

def main():
    print("Initializing VoxelCAD System...")

    # Create 64x64x64 grid
    engine = VoxelEngine(64, 64, 64)
    print(f"Grid created: {engine.size_x}x{engine.size_y}x{engine.size_z}")

    # Create modules
    engine.create_module("telaio", function="structural_frame", tolerance=0.5)
    engine.create_module("carrozzeria", function="body_shell", tolerance=0.1)

    # Add titanio frame for telaio module (outline frame)
    print("\nBuilding telaio structure (titanio frame)...")
    frame_positions = []
    # Bottom frame
    for x in range(10, 54):
        frame_positions.append((x, 10, 10))
        frame_positions.append((x, 10, 53))
        frame_positions.append((x, 53, 10))
        frame_positions.append((x, 53, 53))
    # Vertical pillars
    for y in range(10, 54):
        frame_positions.append((10, y, 10))
        frame_positions.append((10, y, 53))
        frame_positions.append((53, y, 10))
        frame_positions.append((53, y, 53))

    for pos in frame_positions:
        engine.set_voxel(pos[0], pos[1], pos[2], "titanio", "telaio")

    telaio_count = len(engine.modules["telaio"].voxels)
    print(f"  Telaio voxels: {telaio_count}")

    # Add carbonio outer shell for carrozzeria module
    print("\nBuilding carrozzeria structure (carbonio shell)...")
    shell_positions = []
    # Outer shell layer
    for x in range(8, 56):
        for y in range(8, 56):
            shell_positions.append((x, y, 8))
            shell_positions.append((x, y, 55))
    for x in range(8, 56):
        for z in range(8, 56):
            shell_positions.append((x, 8, z))
            shell_positions.append((x, 55, z))
    for y in range(8, 56):
        for z in range(8, 56):
            shell_positions.append((8, y, z))
            shell_positions.append((55, y, z))

    for pos in shell_positions:
        engine.set_voxel(pos[0], pos[1], pos[2], "carbonio", "carrozzeria")

    carrozzeria_count = len(engine.modules["carrozzeria"].voxels)
    print(f"  Carrozzeria voxels: {carrozzeria_count}")

    # Calculate statistics
    print("\n--- Analysis Results ---")
    total_mass = engine.calculate_mass()
    com = engine.calculate_com()

    print(f"Total mass: {total_mass:.2f} kg")
    print(f"Center of mass: X={com[0]:.2f}, Y={com[1]:.2f}, Z={com[2]:.2f}")
    print(f"Total voxels: {len(engine.voxel_map)}")
    print(f"Active modules: {list(engine.modules.keys())}")

    # Verify result
    assert total_mass > 0, "Mass should be positive"
    assert 31 <= com[0] <= 32, "COM X should be near center"
    assert 31 <= com[1] <= 32, "COM Y should be near center"
    assert 31 <= com[2] <= 32, "COM Z should be near center"

    print("\n* All assertions passed")
    print("\nVoxelCAD system operational.")

if __name__ == "__main__":
    main()

def test_brick_engine():
    print("\n=== Testing Brick Engine ===")
    engine = BrickEngine()
    
    engine.create_brick(0, 0, 0, 200, 20, 20, "titanio")
    engine.create_brick(0, 20, 0, 200, 20, 20, "titanio")
    engine.create_brick(0, 40, 0, 200, 10, 20, "carbonio")
    
    print(f"Total bricks: {len(engine.bricks)}")
    print(f"Total mass: {engine.calculate_mass():.3f} kg")
    print(f"Center of mass: {engine.calculate_com()}")
    
    for i, brick in enumerate(engine.bricks):
        print(f"  Brick {i} @ ({brick.x}, {brick.y}, {brick.z}) size: {brick.width}x{brick.height}x{brick.depth} mm")
    
    # Test scaling functions
    print("\n--- Testing Scaling Functions ---")
    # Scale first brick: make it longer in X, shorter in Y
    success = engine.scale_brick(0, scale_x=1.5, scale_y=0.5, scale_z=1.0)
    print(f"Scaled brick 0 (1.5x, 0.5y, 1.0z): {'Success' if success else 'Failed'}")
    
    # Set exact dimensions for second brick
    success = engine.set_brick_dimensions(1, 150, 30, 25)
    print(f"Set brick 1 dimensions (150x30x25 mm): {'Success' if success else 'Failed'}")
    
    print(f"Updated brick 0 size: {engine.bricks[0].width}x{engine.bricks[0].height}x{engine.bricks[0].depth} mm")
    print(f"Updated brick 1 size: {engine.bricks[1].width}x{engine.bricks[1].height}x{engine.bricks[1].depth} mm")
    
    print(f"Total mass after scaling: {engine.calculate_mass():.3f} kg")
    print(f"Center of mass after scaling: {engine.calculate_com()}")

def voxels_to_bricks(voxel_engine):
    brick_engine = BrickEngine()
    seen_positions = {}
    
    for (vx, vy, vz), voxel in voxel_engine.voxel_map.items():
        key = voxel.module
        if key not in seen_positions:
            seen_positions[key] = {"min": [vx, vy, vz], "max": [vx, vy, vz], "material": voxel.material}
        else:
            pos = seen_positions[key]
            pos["min"][0] = min(pos["min"][0], vx)
            pos["min"][1] = min(pos["min"][1], vy)
            pos["min"][2] = min(pos["min"][2], vz)
            pos["max"][0] = max(pos["max"][0], vx)
            pos["max"][1] = max(pos["max"][1], vy)
            pos["max"][2] = max(pos["max"][2], vz)
    
    for module, pos in seen_positions.items():
        width = (pos["max"][0] - pos["min"][0] + 1) * 10
        height = (pos["max"][1] - pos["min"][1] + 1) * 10
        depth = (pos["max"][2] - pos["min"][2] + 1) * 10
        brick_engine.create_brick(pos["min"][0] * 10, pos["min"][1] * 10, pos["min"][2] * 10,
                                  width, height, depth, pos["material"], module)
    
    return brick_engine

if __name__ == "__main__":
    main()
    test_brick_engine()
