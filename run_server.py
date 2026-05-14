from waitress import serve
from backend_api import app, engine
from voxel_editor import VoxelEngine

e = VoxelEngine(64, 64, 64)
e.load_json('full_model.json')
print(f'Starting server with {len(e.voxel_map)} voxels')
serve(app, host='0.0.0.0', port=5000)

