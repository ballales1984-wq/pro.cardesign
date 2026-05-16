"""Wrapper to call C++ physics library from Python"""
try:
    import physics_c_api as c_mod
    HAS_C_API = True
except ImportError:
    HAS_C_API = False

def calculate_mass(bricks):
    if HAS_C_API:
        return c_mod.calculate_mass(bricks)
    return sum(b['width'] * b['height'] * b['depth'] * b['density'] / 1e6 for b in bricks)

def calculate_com(bricks):
    if HAS_C_API:
        return c_mod.calculate_com(bricks)
    if not bricks:
        return (0.0, 0.0, 0.0)
    total_mass = 0.0
    wx = wy = wz = 0.0
    for b in bricks:
        vol = b['width'] * b['height'] * b['depth']
        mass = vol * b['density'] / 1e6
        cx = b['x'] + b['width'] / 2.0
        cy = b['y'] + b['height'] / 2.0
        cz = b['z'] + b['depth'] / 2.0
        total_mass += mass
        wx += mass * cx
        wy += mass * cy
        wz += mass * cz
    return (wx / total_mass, wy / total_mass, wz / total_mass) if total_mass else (0, 0, 0)

def stress_analysis(positions, densities, force, com):
    if HAS_C_API:
        return c_mod.stress_analysis(positions, densities, tuple(force), tuple(com))
    import numpy as np
    dist = np.sqrt(((np.array(positions) - np.array(com))**2).sum(axis=1))
    return dict(stress=list(densities * abs(force[2]) / np.maximum(1, dist)))