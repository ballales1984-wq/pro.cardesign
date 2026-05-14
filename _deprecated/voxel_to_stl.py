import numpy as np
from voxel_editor import VoxelEngine

def voxel_to_mesh(voxel_map):
    vertices = []
    faces = []
    offset = 0
    cube_verts = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
    cube_faces = [[0,1,2],[0,2,3],[4,6,5],[4,7,6],[0,4,5],[0,5,1],[2,6,7],[2,7,3],[0,3,7],[0,7,4],[1,5,6],[1,6,2]]
    for (x,y,z), v in voxel_map.items():
        if v.material == 'air': continue
        for cv in cube_verts:
            vertices.append([x+cv[0], y+cv[1], z+cv[2]])
        for cf in cube_faces:
            faces.append([offset+cf[0], offset+cf[1], offset+cf[2]])
        offset += 8
    return np.array(vertices, dtype=float), np.array(faces, dtype=int)

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
    e = VoxelEngine(64, 64, 64)
    e.load_json('test_model.json')
    verts, faces = voxel_to_mesh(e.voxel_map)
    export_stl('output.stl', verts, faces)
    print(f'Exported {len(faces)} triangles to output.stl')
