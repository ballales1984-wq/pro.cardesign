import json
import numpy as np
from flask import Flask, request, jsonify
from voxel_editor import VoxelEngine, Voxel
from voxel_scaling import downscale_voxels, upscale_voxels, apply_lod
from pyramid_decimate import voxel_to_pyramids, octree_decimate

app = Flask(__name__)
engine = VoxelEngine(64, 64, 64)

@app.route('/api/voxels', methods=['GET'])
def get_voxels():
    return jsonify({'count': len(engine.voxel_map)})

@app.route('/api/voxels', methods=['POST'])
def add_voxel():
    data = request.json
    v = engine.set_voxel(data['x'], data['y'], data['z'], data.get('material', 'carbonio'))
    return jsonify({'status': 'ok'})

@app.route('/api/voxels/convert/pyramids', methods=['POST'])
def convert_pyramids():
    pyramids = voxel_to_pyramids(engine.voxel_map)
    return jsonify({'pyramids': len(pyramids)})

@app.route('/api/voxels/decimate/octree', methods=['POST'])
def decimate_octree():
    data = request.json
    node_size = data.get('node_size', 2)
    simplified = octree_decimate(engine.voxel_map)
    engine.voxel_map = simplified
    return jsonify({'voxels': len(engine.voxel_map), 'decimated': len(simplified)})

@app.route('/api/voxels/scale', methods=['POST'])
def scale_voxels():
    data = request.json
    action = data.get('action', 'downscale')
    factor = int(data.get('factor', 2))
    
    if action == 'downscale':
        new_voxels, new_size = downscale_voxels(engine, factor)
        engine.voxel_map = new_voxels
        engine.size_x, engine.size_y, engine.size_z = new_size
        engine.grid = np.zeros(new_size, dtype=np.int32)
        for (x, y, z) in new_voxels:
            engine.grid[x, y, z] = 1
    elif action == 'upscale':
        new_voxels, new_size = upscale_voxels(engine, factor)
        engine.voxel_map = new_voxels
        engine.size_x, engine.size_y, engine.size_z = new_size
        engine.grid = np.zeros(new_size, dtype=np.int32)
        for (x, y, z) in new_voxels:
            engine.grid[x, y, z] = 1
    
    return jsonify({'status': action + 'd', 'voxels': len(engine.voxel_map), 'size': list(new_size)})

@app.route('/api/physics/mass', methods=['GET'])
def get_mass():
    return jsonify({'mass_kg': engine.calculate_mass()})

@app.route('/api/physics/com', methods=['GET'])
def get_com():
    return jsonify({'center_of_mass': list(engine.calculate_com())})

@app.route('/api/model', methods=['POST'])
def save_model():
    engine.save_json('model.json')
    return jsonify({'status': 'saved'})

if __name__ == '__main__':
    app.run(port=5000)
