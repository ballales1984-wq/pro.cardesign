import math
def project_3d_to_2d(x, y, z, cam_x, cam_y, cam_z, rot_x, rot_z, scale=1.0):
    ry = y * math.cos(rot_x) - z * math.sin(rot_x)
    rz = y * math.sin(rot_x) + z * math.cos(rot_x)
    rx = x * math.cos(rot_z) + rz * math.sin(rot_z)
    rz = -x * math.sin(rot_z) + rz * math.cos(rot_z)
    rx -= cam_x
    ry -= cam_y
    rz -= cam_z
    if rz <= 0.1: return None, None
    factor = scale / rz
    return int(rx * factor + 40), int(ry * factor + 20)

def ascii_view(voxels, cam_x=0, cam_y=0, cam_z=0, rot_x=0.5, rot_z=0.3):
    screen = [[' ' for _ in range(80)] for _ in range(40)]
    chars = {'carbonio': '#', 'titanio': '@', 'alluminio': '+', 'acciaio': '\$', 'vetro': '~'}
    for (x, y, z), v in voxels.items():
        if v.material == 'air': continue
        px, py = project_3d_to_2d(x, y, z, cam_x, cam_y, cam_z, rot_x, rot_z, 25)
        if px is None or not (0 <= px < 80 and 0 <= py < 40): continue
        screen[py][px] = chars.get(v.material, '?')
    return '\\n'.join(''.join(row) for row in screen)

if __name__ == '__main__':
    from voxel_editor import VoxelEngine
    e = VoxelEngine(64, 64, 64)
    e.load_json('test_model.json')
    print(ascii_view(e.voxel_map, cam_x=32, cam_y=32, cam_z=80))
