import numpy as np
from voxel_editor import VoxelEngine, Voxel

def voxel_to_pyramids(voxel_map):
    'Convert cubical voxels to pyramid shapes for faster rendering'
    pyramids = []
    
    for (x, y, z), voxel in voxel_map.items():
        if voxel.material == 'air':
            continue
        
        pyramid = {
            'base_center': (x + 0.5, y + 0.5, z + 0.5),
            'material': voxel.material,
            'height': 0.5,
            'base_size': 1.0,
            'type': 'pyramid'
        }
        pyramids.append(pyramid)
    
    return pyramids

def octree_decimate(voxel_map, threshold=0.5):
    'Decimate voxels using octree merging'
    node_size = 2
    nodes = {}
    
    for (x, y, z), voxel in voxel_map.items():
        if voxel.material == 'air':
            continue
            
        nx, ny, nz = x // node_size, y // node_size, z // node_size
        
        if (nx, ny, nz) not in nodes:
            nodes[(nx, ny, nz)] = {'voxels': [], 'material': voxel.material, 'color': voxel.color}
        
        nodes[(nx, ny, nz)]['voxels'].append((x, y, z))
    
    simplified = {}
    sample_voxel = list(voxel_map.values())[0] if voxel_map else None
    for (nx, ny, nz), data in nodes.items():
        if len(data['voxels']) >= 1:
            cx = sum(v[0] for v in data['voxels']) / len(data['voxels'])
            cy = sum(v[1] for v in data['voxels']) / len(data['voxels'])
            cz = sum(v[2] for v in data['voxels']) / len(data['voxels'])
            simplified[(int(cx), int(cy), int(cz))] = Voxel(
                x=int(cx), y=int(cy), z=int(cz),
                material=data['material'],
                density=sample_voxel.density if sample_voxel else 1000,
                temperature_limit=sample_voxel.temperature_limit if sample_voxel else 100,
                module=data['material'],
                color=data.get('color', (128,128,128))
            )
    
    return simplified

def frustum_culling(pyramids, camera_pos, view_matrix):
    'Culling algorithm for pyramids'
    visible = []
    for p in pyramids:
        dx = p['base_center'][0] - camera_pos[0]
        dy = p['base_center'][1] - camera_pos[1]
        dz = p['base_center'][2] - camera_pos[2]
        dist = np.sqrt(dx*dx + dy*dy + dz*dz)
        if dist < 200:
            visible.append(p)
    return visible

if __name__ == '__main__':
    e = VoxelEngine(64, 64, 64)
    e.load_json('full_model.json')
    
    pyramids = voxel_to_pyramids(e.voxel_map)
    print(f'Pyramids created: {len(pyramids)}')
    
    simplified = octree_decimate(e.voxel_map)
    print(f'Octree decimated: {len(simplified)} voxels (from {len(e.voxel_map)})')

