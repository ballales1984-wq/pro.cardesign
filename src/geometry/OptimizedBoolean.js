// geometry/OptimizedBoolean.js
import { GeometryDecimator } from './Decimator.js';
import * as THREE from 'three';

// Assuming prepareForCSG is available from somewhere (e.g., BVH utils)
// If not, you need to implement or import it.
function prepareForCSG(mesh) {
  // Placeholder for BVH preparation logic
  // This function should convert the mesh to a format suitable for CSG operations
  // For example, using three-mesh-bvh or similar.
  // Since the exact implementation is not provided, we'll leave it as a stub.
  console.warn('prepareForCSG is a stub. Implement proper BVH preparation for CSG.');
  return mesh;
}

export class OptimizedBoolean {
  constructor() {
    this.decimator = new GeometryDecimator();
    this.brushCache = new Map();
  }

  getPreparedTool(geometry, params) {
    const key = geometry.uuid;

    if (!this.brushCache.has(key)) {
      let toolGeo = geometry.clone();

      // Decimazione aggressiva per tool (fori, primitive, ecc.)
      toolGeo = this.decimator.decimateForCSG(toolGeo, 'medium');

      const mesh = new THREE.Mesh(toolGeo);
      prepareForCSG(mesh);                    // funzione BVH dal messaggio precedente
      this.brushCache.set(key, mesh);
    }

    const toolMesh = this.brushCache.get(key).clone();
    // Applica transform...
    // Example: apply position, rotation, scale from params
    if (params.position) toolMesh.position.copy(params.position);
    if (params.rotation) toolMesh.rotation.copy(params.rotation);
    if (params.scale) toolMesh.scale.copy(params.scale);
    return toolMesh;
  }
}