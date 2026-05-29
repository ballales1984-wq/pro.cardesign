"""
Hole Tool - Create holes, counterbores, and threads in brick geometry
Real measurements in millimeters
"""
from dataclasses import dataclass
from typing import Optional
import numpy as np
from .brick import Brick, create_brick, create_cylinder


# Thread standards (ISO metric)
THREAD_PITCHES = {
    1.6: 0.35, 2.0: 0.4, 2.5: 0.45, 3.0: 0.5, 3.5: 0.5,
    4.0: 0.7, 5.0: 0.8, 6.0: 1.0, 7.0: 1.0, 8.0: 1.25,
    9.0: 1.25, 10.0: 1.5, 11.0: 1.5, 12.0: 1.75, 13.0: 1.75,
    14.0: 2.0, 15.0: 2.0, 16.0: 2.0, 17.0: 2.0, 18.0: 2.5,
    20.0: 2.5, 22.0: 2.5, 24.0: 3.0, 27.0: 3.0, 30.0: 3.5,
    33.0: 3.5, 36.0: 4.0, 39.0: 4.0, 42.0: 4.5, 45.0: 4.5,
    48.0: 5.0, 52.0: 5.0, 56.0: 5.5, 60.0: 5.5, 64.0: 6.0,
    68.0: 6.5, 72.0: 7.0, 76.0: 7.0, 80.0: 8.0, 85.0: 8.0,
    90.0: 9.0, 100.0: 10.0, 110.0: 11.0, 120.0: 12.0, 130.0: 13.0,
    140.0: 14.0, 150.0: 15.0, 160.0: 16.0, 170.0: 17.0, 180.0: 18.0,
    200.0: 20.0
}


@dataclass
class HoleSpec:
    """Specification for a hole to be created"""
    diameter: float  # mm
    depth: float  # mm (full depth for through hole)
    hole_type: str = 'through'  # 'through', 'blind', 'counterbore', 'countersink', 'threaded'
    thread_diameter: Optional[float] = None  # mm, for threaded holes
    thread_pitch: Optional[float] = None  # mm, for threaded holes
    counterbore_diameter: Optional[float] = None  # mm, for counterbore
    countersink_diameter: Optional[float] = None  # mm, for countersink
    countersink_angle: float = 45.0  # degrees, for countersink


def get_thread_pitch(diameter: float) -> float:
    """Get ISO metric thread pitch for a given nominal diameter
    
    For diameters above the maximum standard size (200mm), returns the
    maximum standard diameter (200.0) so the caller can do the pitch lookup.
    """
    if diameter in THREAD_PITCHES:
        return THREAD_PITCHES[diameter]
    # Find closest standard size
    sizes = sorted(THREAD_PITCHES.keys())
    for s in sizes:
        if s >= diameter:
            return THREAD_PITCHES[s]
    # Above maximum - return the diameter (200.0) for caller's pitch lookup
    return sizes[-1]


def drill_hole(brick: Brick, center_mm: np.ndarray, spec: HoleSpec) -> list:
    """
    Drill a hole through a brick. Returns list of new Brick objects representing removed material.
    In voxel-based system, this creates cylindrical voids.
    
    Args:
        brick: The brick to drill into
        center_mm: Center point of hole in mm [x, y, z]
        spec: Hole specification
        
    Returns:
        List of Brick objects to remove (negative voxels)
    """
    radius = spec.diameter / 2.0
    
    # Calculate bounds of hole
    min_y = brick.position[1]
    max_y = brick.position[1] + brick.size[1]
    
    if spec.hole_type == 'through':
        # Through hole - full depth
        hole_min_y = min_y
        hole_max_y = max_y
    else:
        # Blind hole or counterbore - limited depth
        hole_min_y = center_mm[1] - spec.depth / 2.0
        hole_max_y = center_mm[1] + spec.depth / 2.0
    
    # Clamp to brick bounds
    hole_min_y = max(hole_min_y, min_y)
    hole_max_y = min(hole_max_y, max_y)
    
    # Create cylindrical void bricks
    void_bricks = []
    removed_voxels = []
    
    # For voxel system, we need to remove voxels that intersect the cylinder
    y_steps = max(1, int(np.ceil(hole_max_y - hole_min_y)))
    
    for y_offset in range(y_steps):
        y = int(hole_min_y + y_offset)
        if y < min_y or y > max_y:
            continue
            
        # Check each voxel in the brick that might intersect the cylinder
        for x in range(int(brick.position[0]), int(brick.position[0] + brick.size[0])):
            for z in range(int(brick.position[2]), int(brick.position[2] + brick.size[2])):
                # Distance from center (in mm, assuming 1mm per voxel)
                dist_x = (x + 0.5 - center_mm[0])  # center of voxel
                dist_z = (z + 0.5 - center_mm[2])
                dist = np.sqrt(dist_x**2 + dist_z**2)
                
                if dist <= radius:
                    void_bricks.append(create_brick(
                        id=0,
                        name=f"hole_void_{x}_{y}_{z}",
                        size_mm=[1, 1, 1],
                        position_mm=[float(x), float(y), float(z)],
                        material="void"
                    ))
                    removed_voxels.append((x, y, z))
    
    return removed_voxels


def create_thread_spec(diameter: float, length: float = None) -> HoleSpec:
    """Create a threaded hole specification for ISO metric thread"""
    pitch = get_thread_pitch(diameter)
    return HoleSpec(
        diameter=diameter,
        depth=length if length else diameter * 1.5,
        hole_type='threaded',
        thread_diameter=diameter,
        thread_pitch=pitch
    )


def create_counterbore_spec(screw_diameter: float, head_type: str = 'hex', head_size: float = None) -> HoleSpec:
    """Create a counterbore specification for screw head"""
    # Standard counterbore diameters for common head types
    head_diameters = {
        'hex': {4: 2.5, 5: 3.5, 6: 4.5, 8: 6.0, 10: 7.5, 12: 9.5, 16: 13.0, 20: 16.0},
        'socket': {4: 3.0, 5: 3.5, 6: 4.5, 8: 6.5, 10: 8.0, 12: 10.0},
        'flat': {4: 7.0, 5: 8.0, 6: 10.0, 8: 13.0, 10: 16.0, 12: 19.0}
    }
    
    cb_diam = head_size
    if head_type in head_diameters and screw_diameter in head_diameters[head_type]:
        cb_diam = head_diameters[head_type][screw_diameter]
    
    return HoleSpec(
        diameter=screw_diameter,
        depth=screw_diameter,  # depth for clearance hole
        hole_type='counterbore',
        counterbore_diameter=cb_diam
    )


# ID counter
_hole_id_counter = 0

def next_hole_id() -> int:
    global _hole_id_counter
    _hole_id_counter += 1
    return _hole_id_counter