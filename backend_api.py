import json
import numpy as np
from flask import Flask, request, jsonify
from voxel_editor import VoxelEngine
from voxel_scaling import downscale_voxels, upscale_voxels, apply_lod
from pyramid_decimate import voxel_to_pyramids, octree_decimate

app = Flask(__name__)
engine = VoxelEngine(64, 64, 64)
engine.load_json('full_model.json')  # Load model on startup

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
    simplified = octree_decimate(engine.voxel_map)
    engine.voxel_map = simplified
    return jsonify({'voxels': len(engine.voxel_map)})

@app.route('/api/voxels/scale', methods=['POST'])
def scale_voxels():
    data = request.json
    action = data.get('action', 'downscale')
    factor = int(data.get('factor', 2))
    
    if action == 'downscale':
        new_voxels, new_size = downscale_voxels(engine, factor)
        engine.voxel_map = new_voxels
    elif action == 'upscale':
        new_voxels, new_size = upscale_voxels(engine, factor)
        engine.voxel_map = new_voxels
    
    return jsonify({'status': action + 'd', 'voxels': len(engine.voxel_map)})

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
    app.run(host='0.0.0.0', port=5000, use_reloader=False)

