from http.server import HTTPServer, BaseHTTPRequestHandler
import json
from voxel_editor import VoxelEngine

engine = VoxelEngine(64, 64, 64)
engine.load_json('full_model.json')

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/voxels':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'count': len(engine.voxel_map)}).encode())
        elif self.path == '/api/physics/mass':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'mass_kg': engine.calculate_mass()}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass

print(f'Starting on port 5000 with {len(engine.voxel_map)} voxels')
HTTPServer(('127.0.0.1', 5000), Handler).serve_forever()

