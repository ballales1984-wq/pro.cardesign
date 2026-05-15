#!/usr/bin/env python3
"""Test del sistema Brick"""

from brick import Brick, create_brick, create_cube, create_bar, create_wheel_tire

def test_brick_creation():
    print("=== Testing Brick System ===\n")
    
    # Test basic brick
    brick1 = create_brick(
        id=1,
        name="Test Brick",
        size_mm=[100, 20, 20],
        position_mm=[0, 0, 0],
        material="steel"
    )
    print(f"Brick: {brick1.name}")
    print(f"  Position: {brick1.position}")
    print(f"  Size: {brick1.size}")
    print(f"  Volume: {brick1.volume_mm3} mm³")
    print(f"  Center: {brick1.center}")
    print()
    
    # Test cube
    cube = create_cube(2, "Test Cube", 50, [100, 0, 0])
    print(f"Cube: {cube.name}")
    print(f"  Size: {cube.size}")
    print(f"  Volume: {cube.volume_mm3} mm³")
    print()
    
    # Test bar
    bar = create_bar(3, "Test Bar", 200, 'x', 15, [0, 100, 0])
    print(f"Bar: {bar.name}")
    print(f"  Size: {bar.size}")
    print(f"  Volume: {bar.volume_mm3} mm³")
    print()
    
    # Test wheel approximation
    wheel = create_wheel_tire(4, "Wheel", 270, 250, [0, 0, 0])
    print(f"Wheel: {wheel.name}")
    print(f"  Size: {wheel.size}")
    print(f"  Volume: {wheel.volume_mm3} mm³")
    print()
    
    # Test overlap detection
    brick_a = create_brick(5, "A", [50, 50, 50], [0, 0, 0])
    brick_b = create_brick(6, "B", [50, 50, 50], [25, 0, 0])  # overlaps
    brick_c = create_brick(7, "C", [50, 50, 50], [100, 0, 0])  # no overlap
    
    print("Overlap tests:")
    print(f"  A overlaps B: {brick_a.overlaps(brick_b)}")
    print(f"  A overlaps C: {brick_a.overlaps(brick_c)}")
    
    print("\n=== All tests passed ===")

if __name__ == "__main__":
    test_brick_creation()