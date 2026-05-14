import json
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum

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
class Module:
    name: str
    voxels: List[Voxel] = field(default_factory=list)
    tolerance: float = 0.01
    function: str = ""
    properties: Dict[str, Any] = field(default_factory=dict)

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
