"""
Brick System - Dati geometrici con misure reali in millimetri
"""
from dataclasses import dataclass, field
from typing import Optional
import numpy as np

@dataclass
class Brick:
    """Un brick con dimensioni reali in mm"""
    id: int
    name: str = "Brick"
    
    # Posizione dell'angolo inferiore (min corner) in mm
    position: np.ndarray = field(default_factory=lambda: np.array([0.0, 0.0, 0.0]))
    
    # Dimensioni in mm [width(X), height(Y), depth(Z)]
    size: np.ndarray = field(default_factory=lambda: np.array([10.0, 10.0, 10.0]))
    
    material: str = "steel"
    module: Optional[str] = None
    
    # Metadati
    is_visible: bool = True
    is_selected: bool = False

    @property
    def center(self) -> np.ndarray:
        """Centro del brick in mm"""
        return self.position + self.size / 2.0

    @property
    def volume_mm3(self) -> float:
        """Volume in mm³"""
        return float(np.prod(self.size))

    @property
    def max_corner(self) -> np.ndarray:
        """Angolo superiore opposto"""
        return self.position + self.size

    def contains_point(self, point: np.ndarray) -> bool:
        """Controlla se un punto è dentro il brick"""
        return np.all(point >= self.position) and np.all(point <= self.max_corner)

    def overlaps(self, other: 'Brick') -> bool:
        """Controlla se si sovrappone con un altro brick (tocco esatto ≠ sovrapposizione)"""
        return not (
            np.any(self.max_corner <= other.position) or 
            np.any(other.max_corner <= self.position)
        )


def create_brick(id: int, name: str, size_mm: list, position_mm: list = None, 
                 material: str = "steel", module: str = None) -> Brick:
    """Crea un brick con misure reali in mm"""
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
    """Crea un cubo con lato specificato in mm"""
    return create_brick(id, name, [side_mm, side_mm, side_mm], position_mm, material)


def create_bar(id: int, name: str, length_mm: float, axis: str = 'x', 
               thickness_mm: float = 20.0, position_mm: list = None,
               material: str = "steel") -> Brick:
    """Crea una barra tipo Lego"""
    if axis == 'x':
        size = [length_mm, thickness_mm, thickness_mm]
    elif axis == 'y':
        size = [thickness_mm, length_mm, thickness_mm]
    else:  # z
        size = [thickness_mm, thickness_mm, length_mm]
    return create_brick(id, name, size, position_mm, material)


def create_wheel_tire(id: int, name: str, radius_mm: float = 270, 
                      width_mm: float = 250, position_mm: list = None) -> Brick:
    """Approssimazione brick per pneumatico"""
    if position_mm is None:
        position_mm = [0, radius_mm, 0]
    return create_brick(id, name, [width_mm, radius_mm*2, radius_mm*2], position_mm, "rubber")


# ID counter per nuovi brick
_brick_id_counter = 0

def next_brick_id() -> int:
    global _brick_id_counter
    _brick_id_counter += 1
    return _brick_id_counter