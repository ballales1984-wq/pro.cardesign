"""
Brick System - Geometric data with real measurements in millimeters
"""
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

@dataclass
class Brick:
    """A brick with real dimensions in mm"""
    id: int
    name: str = "Brick"
    
    # Position of the lower corner (min corner) in mm
    position: np.ndarray = field(default_factory=lambda: np.array([0.0, 0.0, 0.0]))
    
    # Dimensions in mm [width(X), height(Y), depth(Z)]
    size: np.ndarray = field(default_factory=lambda: np.array([10.0, 10.0, 10.0]))
    
    material: str = "steel"
    module: Optional[str] = None
    
    # Metadata
    is_visible: bool = True
    is_selected: bool = False

    @property
    def center(self) -> np.ndarray:
        """Center of the brick in mm"""
        return self.position + self.size / 2.0

    @property
    def volume_mm3(self) -> float:
        """Volume in mm³"""
        return float(np.prod(self.size))

    @property
    def max_corner(self) -> np.ndarray:
        """Opposite upper corner"""
        return self.position + self.size

    def contains_point(self, point: np.ndarray) -> bool:
        """Check if a point is inside the brick"""
        return np.all(point >= self.position) and np.all(point <= self.max_corner)

    def overlaps(self, other: 'Brick') -> bool:
        """Check if it overlaps with another brick (exact touch ≠ overlap)"""
        return not (
            np.any(self.max_corner <= other.position) or 
            np.any(other.max_corner <= self.position)
        )


def create_brick(id: int, name: str, size_mm: list, position_mm: list = None, 
                 material: str = "steel", module: str = None) -> Brick:
    """Create a brick with real measurements in mm"""
    if position_mm is None:
        position_mm = [0.0, 0.0, 0.0]
    
    return Brick(
        id=id,
        name=name,
        position=np.array(position_mm, dtype=float),
        size=np.array(size_mm, dtype=float),
        material=material,
        module=module
    )


def create_cube(id: int, name: str, side_mm: float, position_mm: list = None,
                material: str = "steel") -> Brick:
    """Create a cube with specified side in mm"""
    return create_brick(id, name, [side_mm, side_mm, side_mm], position_mm, material)


def create_bar(id: int, name: str, length_mm: float, axis: str = 'x', 
               thickness_mm: float = 20.0, position_mm: list = None,
               material: str = "steel") -> Brick:
    """Create a Lego-type bar"""
    if axis == 'x':
        size = [length_mm, thickness_mm, thickness_mm]
    elif axis == 'y':
        size = [thickness_mm, length_mm, thickness_mm]
    else:  # z
        size = [thickness_mm, thickness_mm, length_mm]
    return create_brick(id, name, size, position_mm, material)


def create_wheel_tire(id: int, name: str, radius_mm: float = 270, 
                       width_mm: float = 250, position_mm: list = None) -> Brick:
    """Brick approximation for tire"""
    if position_mm is None:
        position_mm = [0, radius_mm, 0]
    return create_brick(id, name, [width_mm, radius_mm*2, radius_mm*2], position_mm, "rubber")


def create_cylinder(id: int, name: str, radius_mm: float, height_mm: float, 
                    position_mm: list = None, material: str = "steel") -> Brick:
    """Create a cylinder with specified radius and height in mm"""
    if position_mm is None:
        position_mm = [0.0, 0.0, 0.0]
    # Cylinder occupies a box of [2*radius, height, 2*radius]
    size = [2 * radius_mm, height_mm, 2 * radius_mm]
    return create_brick(id, name, size, position_mm, material)


def create_cone(id: int, name: str, radius_mm: float, height_mm: float, 
                position_mm: list = None, material: str = "steel") -> Brick:
    """Create a cone with specified radius and height in mm"""
    if position_mm is None:
        position_mm = [0.0, 0.0, 0.0]
    # Cone occupies same bounding box as cylinder: [2*radius, height, 2*radius]
    size = [2 * radius_mm, height_mm, 2 * radius_mm]
    return create_brick(id, name, size, position_mm, material)


def create_sphere(id: int, name: str, diameter_mm: float, 
                  position_mm: list = None, material: str = "steel") -> Brick:
    """Create a sphere with specified diameter in mm"""
    if position_mm is None:
        position_mm = [0.0, 0.0, 0.0]
    # Sphere occupies a cube: [diameter, diameter, diameter]
    size = [diameter_mm, diameter_mm, diameter_mm]
    return create_brick(id, name, size, position_mm, material)


# ID counter for new bricks
_brick_id_counter = 0

def next_brick_id() -> int:
    global _brick_id_counter
    _brick_id_counter += 1
    return _brick_id_counter