import numpy as np
from voxel_editor import VoxelEngine

def stress_analysis(engine, force_vector=(0, 0, -1000)):
    stress = {}
    fx, fy, fz = force_vector
    com = engine.calculate_com()
    
    for (x, y, z), voxel in engine.voxel_map.items():
        dx, dy, dz = x - com[0], y - com[1], z - com[2]
        dist = np.sqrt(dx*dx + dy*dy + dz*dz)
        if dist < 1: dist = 1
        stress_val = voxel.density * abs(fz) / dist
        stress[(x, y, z)] = stress_val
    return stress

def thermal_simulation(engine, ambient_temp=20, heat_sources=None):
    temps = {pos: ambient_temp for pos in engine.voxel_map}
    if heat_sources:
        for hx, hy, hz, power in heat_sources:
            for (x, y, z), temp in temps.items():
                dist = np.sqrt((x-hx)**2 + (y-hy)**2 + (z-hz)**2)
                if dist < 1: dist = 1
                temps[(x, y, z)] = ambient_temp + power / dist
    return temps

if __name__ == '__main__':
    e = VoxelEngine(64, 64, 64)
    e.load_json('test_model.json')
    stress = stress_analysis(e)
    temps = thermal_simulation(e, 20, [(32, 32, 32, 100)])
    print(f'Stress: {len(stress)} voxels, Max temp: {max(temps.values()):.1f}C')
