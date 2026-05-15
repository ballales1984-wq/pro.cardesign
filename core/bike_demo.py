#!/usr/bin/env python3
"""
Demo del Brick System - Genera un esempio di telaio bici
"""

from brick import create_cube, create_bar, create_wheel_tire, next_brick_id

def create_bike_frame_demo():
    bricks = []
    
    # Bottom bracket area (centro)
    # Main triangle
    for i in range(8):  # Down tube
        bricks.append(create_bar(next_brick_id(), 
            f"down_tube_{i}", 250, 'x', 20, [i*30, 0, 0], "aluminum"))
    
    for i in range(8):  # Top tube
        bricks.append(create_bar(next_brick_id(),
            f"top_tube_{i}", 200, 'x', 18, [i*25+20, 70, 0], "aluminum"))
    
    for i in range(12):  # Seat tube
        bricks.append(create_bar(next_brick_id(),
            f"seat_tube_{i}", 300, 'y', 22, [0, i*25, 0], "aluminum"))
    
    # Wheels
    wheels = [
        create_wheel_tire(next_brick_id(), "Front Wheel", 270, 250, [0, 270, 0]),
        create_wheel_tire(next_brick_id(), "Rear Wheel", 270, 250, [0, 270, 300]),
    ]
    bricks.extend(wheels)
    
    return bricks

if __name__ == "__main__":
    bricks = create_bike_frame_demo()
    print(f"Created {len(bricks)} bricks for bike demo")
    print("\nSample bricks:")
    for b in bricks[:3]:
        print(f"  {b.name}: pos={b.position}, size={b.size}, volume={b.volume_mm3}mm³")