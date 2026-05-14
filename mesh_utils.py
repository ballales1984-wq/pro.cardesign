import numpy as np

# Marching cubes lookup tables (simplified)
VERT_TABLE = [
    [0,1,2], [0,2,3], [0,4,5], [0,5,1], [0,6,7], [0,7,4], [0,2,5], [0,5,7], [0,7,2], [0,2,6]
]

def marching_cubes(grid, isolevel=0.5):
    \"\"\"Convert voxel grid to triangles\"\"\"
    vertices = []
    faces = []
    
    dims = grid.shape
    for x in range(dims[0]-1):
        for y in range(dims[1]-1):
            for z in range(dims[2]-1):
                # Get 8 corner values
                cube = [
                    grid[x,y,z], grid[x+1,y,z], grid[x+1,y+1,z], grid[x,y+1,z],
                    grid[x,y,z+1], grid[x+1,y,z+1], grid[x+1,y+1,z+1], grid[x,y+1,z+1]
                ]
                
                # Check if cube is inside surface
                inside = sum(1 for v in cube if v > isolevel)
                if inside == 0 or inside == 8:
                    continue
                
                # Add cube vertices
                base_idx = len(vertices)
                for dx,dy,dz in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]:
                    vertices.append([x+dx, y+dy, z+dz])
                
                # Add face triangles for simplicity
                faces.extend([[base_idx+0, base_idx+2, base_idx+1],
                              [base_idx+0, base_idx+3, base_idx+2],
                              [base_idx+4, base_idx+5, base_idx+6],
                              [base_idx+4, base_idx+6, base_idx+7],
                              [base_idx+0, base_idx+1, base_idx+5],
                              [base_idx+0, base_idx+5, base_idx+4],
                              [base_idx+2, base_idx+3, base_idx+7],
                              [base_idx+2, base_idx+7, base_idx+6],
                              [base_idx+0, base_idx+4, base_idx+7],
                              [base_idx+0, base_idx+7, base_idx+3],
                              [base_idx+1, base_idx+2, base_idx+6],
                              [base_idx+1, base_idx+6, base_idx+5]])
    
    return np.array(vertices), np.array(faces)

def export_stl(filepath, vertices, faces):
    with open(filepath, 'w') as f:
        f.write('solid voxel_model\n')
        for face in faces:
            v0, v1, v2 = vertices[face[0]], vertices[face[1]], vertices[face[2]]
            n = np.cross(np.array(v1)-np.array(v0), np.array(v2)-np.array(v0))
            norm = np.linalg.norm(n)
            if norm > 0: n = n/norm
            f.write(f'  facet normal {n[0]:.4f} {n[1]:.4f} {n[2]:.4f}\n')
            f.write('    outer loop\n')
            f.write(f'      vertex {v0[0]:.4f} {v0[1]:.4f} {v0[2]:.4f}\n')
            f.write(f'      vertex {v1[0]:.4f} {v1[1]:.4f} {v1[2]:.4f}\n')
            f.write(f'      vertex {v2[0]:.4f} {v2[1]:.4f} {v2[2]:.4f}\n')
            f.write('    endloop\n  endfacet\n')
        f.write('endsolid voxel_model\n')

if __name__ == '__main__':
    from voxel_editor import VoxelEngine
    e = VoxelEngine(64, 64, 64)
    e.load_json('full_model.json')
    
    # Convert voxel map to grid for marching cubes
    grid = e.grid.copy()
    verts, faces = marching_cubes(grid)
    export_stl('marching_output.stl', verts, faces)
    print(f'Exported {len(faces)} triangles')
