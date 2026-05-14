import numpy as np
from voxel_editor import VoxelEngine, Voxel

def downscale_voxels(engine, factor=2):
    '''Combine voxels into larger cubes for LOD'''
    new_voxels = {}
    grid_size = engine.size_x // factor
    
    for x in range(grid_size):
        for y in range(grid_size):
            for z in range(grid_size):
                block_has_voxel = False
                representative = None
                for dx in range(factor):
                    for dy in range(factor):
                        for dz in range(factor):
                            px, py, pz = x*factor + dx, y*factor + dy, z*factor + dz
                            if (px, py, pz) in engine.voxel_map:
                                block_has_voxel = True
                                if representative is None:
                                    representative = engine.voxel_map[(px, py, pz)]
                
                if block_has_voxel and representative:
                    scaled_voxel = Voxel(
                        x=x, y=y, z=z,
                        material=representative.material,
                        density=representative.density,
                        temperature_limit=representative.temperature_limit,
                        module=representative.module,
                        color=representative.color
                    )
                    new_voxels[(x, y, z)] = scaled_voxel
    
    return new_voxels, (grid_size, grid_size, grid_size)

def upscale_voxels(engine, factor=2):
    '''Subdivide voxels into smaller cubes'''
    new_voxels = {}
    
    for (x, y, z), voxel in engine.voxel_map.items():
        for dx in range(factor):
            for dy in range(factor):
                for dz in range(factor):
                    new_x, new_y, new_z = x*factor + dx, y*factor + dy, z*factor + dz
                    new_voxels[(new_x, new_y, new_z)] = Voxel(
                        x=new_x, y=new_y, z=new_z,
                        material=voxel.material,
                        density=voxel.density,
                        temperature_limit=voxel.temperature_limit,
                        module=voxel.module,
                        color=voxel.color
                    )
    
    new_size = (engine.size_x * factor, engine.size_y * factor, engine.size_z * factor)
    return new_voxels, new_size

def apply_lod(engine, distance_thresholds=[50, 100, 200]):
    '''Generate multiple LOD levels for rendering'''
    lod_levels = {}
    current_voxels = engine.voxel_map
    
    for level, dist in enumerate(distance_thresholds):
        if level == 0:
            lod_levels[dist] = current_voxels.copy()
        else:
            temp_engine = VoxelEngine(engine.size_x, engine.size_y, engine.size_z)
            temp_engine.voxel_map = current_voxels
            new_voxels, _ = downscale_voxels(temp_engine, factor=2)
            lod_levels[dist] = new_voxels
            current_voxels = new_voxels
    
    return lod_levels

if __name__ == '__main__':
    e = VoxelEngine(64, 64, 64)
    e.load_json('full_model.json')
    print(f'Original: {len(e.voxel_map)} voxels')
    
    small_voxels, small_size = downscale_voxels(e, factor=4)
    print(f'Downscaled (4x): {len(small_voxels)} voxels, size {small_size}')
    
    up_voxels, up_size = upscale_voxels(e, factor=2)
    print(f'Upscaled (2x): {len(up_voxels)} voxels, size {up_size}')
    
    lod = apply_lod(e, [50, 100, 200])
    for dist, voxels in lod.items():
        print(f'LOD @ {dist} units: {len(voxels)} voxels')

