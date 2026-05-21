import * as THREE from 'three';
import { MeshoptDecimator } from './MeshoptDecimator.js';

export class OptimizedBoolean {
  constructor() {
    this.decimator = new MeshoptDecimator();
    this.brushCache = new Map();
  }

  getPreparedTool(geometry, params = {}) {
    const key = geometry.uuid;

    if (!this.brushCache.has(key)) {
      let optimizedGeo = this.decimator.decimateForBooleanTool(geometry);
      
      const mesh = new THREE.Mesh(optimizedGeo);
      prepareForCSG(mesh);
      
      this.brushCache.set(key, mesh);
    }

    const tool = this.brushCache.get(key).clone();
    tool.position.copy(params.position || new THREE.Vector3());
    tool.rotation.copy(params.rotation || new THREE.Euler());
    tool.scale.copy(params.scale || new THREE.Vector3(1, 1, 1));
    tool.updateMatrixWorld(true);

    return tool;
  }

  clearCache() {
    this.brushCache.clear();
  }
}

function prepareForCSG(mesh) {
  mesh.geometry.computeVertexNormals();
  mesh.updateMatrixWorld(true);
}