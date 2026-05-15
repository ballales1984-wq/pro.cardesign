#!/usr/bin/env python3
"""
CLI minimale — pro.cardesign
Uso:
  python cli.py info        # Info brick system
  python cli.py create       # Crea brick esempio
  python cli.py mass         # Calcola massa di esempio
  python cli.py components   # Lista componenti disponibili
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.brick import create_cube, create_bar, create_wheel_tire, next_brick_id
from core.component import ComponentLibrary

def cmd_info():
    from core import brick
    print("=== pro.cardesign Brick System ===")
    print(f"Modulo caricato: {brick.__name__}")
    print(f"Funzioni disponibili: create_brick, create_cube, create_bar, create_wheel_tire")

def cmd_create():
    bricks = []
    
    # Crea esempio: barra 200x20x20
    bar = create_bar(next_brick_id(), "Barra Esempio", 200, 'x', 20)
    bricks.append(bar)
    
    # Cubo 50x50x50
    cube = create_cube(next_brick_id(), "Cubo Esempio", 50, [200, 0, 0])
    bricks.append(cube)
    
    # Ruota approssimata
    wheel = create_wheel_tire(next_brick_id(), "Ruota Esempio", 270, 250, [0, 0, 0])
    bricks.append(wheel)
    
    print(f"Creati {len(bricks)} brick di esempio:")
    for b in bricks:
        print(f"  • {b.name}: {b.size[0]:.0f}×{b.size[1]:.0f}×{b.size[2]:.0f} mm | {b.volume_mm3/1000:.1f} cm³")

def cmd_mass():
    from voxel_editor import VoxelEngine
    engine = VoxelEngine(64, 64, 64)
    
    # Aggiungi alcuni voxel per test
    engine.set_voxel(0, 0, 0, "titanio")
    engine.set_voxel(1, 1, 1, "titanio")
    engine.set_voxel(2, 2, 2, "carbonio")
    
    mass = engine.calculate_mass()
    com = engine.calculate_com()
    print(f"Massa totale: {mass:.6f} kg")
    print(f"Centro di massa: X={com[0]:.2f}, Y={com[1]:.2f}, Z={com[2]:.2f}")

def cmd_components():
    library = ComponentLibrary()
    comps = library.get_all()
    
    print(f"=== Libreria Componenti ({len(comps)} totali) ===\n")
    
    by_cat = {}
    for c in comps:
        if c.category not in by_cat:
            by_cat[c.category] = []
        by_cat[c.category].append(c)
    
    for cat, items in by_cat.items():
        print(f"【{cat.upper()}】({len(items)}):")
        for item in items:
            params = ', '.join(f"{k}={v:.0f}mm" for k, v in list(item.parameters.items())[:3])
            print(f"  • {item.icon} {item.name} — {params}")
        print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    cmd = sys.argv[1].lower()
    if cmd == 'info':
        cmd_info()
    elif cmd == 'create':
        cmd_create()
    elif cmd == 'mass':
        cmd_mass()
    elif cmd == 'components':
        cmd_components()
    else:
        print(f"Comando sconosciuto: {cmd}")
        print(__doc__)
        sys.exit(1)