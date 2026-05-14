import numpy as np
from voxel_editor import VoxelEngine

def stress_analysis(engine, force_applied=(0, 0, -1e6)):
    'Calculate stress distribution for applied force'
    stress = {}
    com = engine.calculate_com()
    fx, fy, fz = force_applied
    for (x, y, z), voxel in engine.voxel_map.items():
        dx, dy, dz = x - com[0], y - com[1], z - com[2]
        dist = max(1, np.sqrt(dx*dx + dy*dy + dz*dz))
        stress[(x, y, z)] = voxel.density * abs(fz) / dist
    return stress

def thermal_analysis(engine, heat_source=(32, 32, 32), power=1000):
    'Calculate temperature distribution from heat source'
    temps = {}
    for (x, y, z), voxel in engine.voxel_map.items():
        dist = max(1, np.sqrt((x-heat_source[0])**2 + (y-heat_source[1])**2 + (z-heat_source[2])**2))
        delta_t = power / (voxel.density * dist * 0.1)
        temps[(x, y, z)] = delta_t
    return temps

def check_safety_margins(engine, stress_results, temp_results):
    'Check if design exceeds material limits'
    issues = []
    for (x, y, z), stress_val in stress_results.items():
        voxel = engine.voxel_map[(x, y, z)]
        if stress_val > voxel.density * 100:  # Simplified yield check
            issues.append({'pos': (x, y, z), 'type': 'stress', 'value': stress_val})
    return issues

if __name__ == '__main__':
    e = VoxelEngine(64, 64, 64)
    e.load_json('full_model.json')
    stress = stress_analysis(e)
    temps = thermal_analysis(e)
    print(f'Stress: {len(stress)} voxels analyzed')
    print(f'Thermal: max delta {max(temps.values()):.1f}C')
