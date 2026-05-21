import { MeshoptSimplifier } from 'meshoptimizer';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptWorkerManager } from './MeshoptWorkerManager.js';

let workerManager = null;

export class MeshoptDecimator {
  constructor() {
    if (MeshoptSimplifier.useWasm) {
      MeshoptSimplifier.ready().catch(() => {});
    }
  }

  decimate(geometry, targetRatio = 0.25, options = {}) {
    if (!geometry?.attributes?.position) return geometry;

    const originalVertexCount = geometry.attributes.position.count;
    let geo = this._prepareGeometry(geometry.clone());

    if (!geo.index) {
      return geometry;
    }

    const { index } = geo;
    const targetIndexCount = Math.max(6, Math.floor(index.count * targetRatio * 0.75));

    try {
      const indices = index.array instanceof Uint32Array ? new Uint32Array(index.array) : new Uint32Array(index.array.slice());
      const positions = new Float32Array(geo.attributes.position.array);

      const [simplifiedIndices, error] = MeshoptSimplifier.simplify(
        indices,
        positions,
        3,
        targetIndexCount,
        options.errorThreshold || 0.02,
        options
      );

      console.log(`Meshopt Decimazione: ${originalVertexCount} → ~${Math.round(simplifiedIndices.length / 3)} vertici | Errore: ${error.toFixed(4)}`);

      const [remapOut, newVertexCount] = MeshoptSimplifier.compactMesh(simplifiedIndices);

      const oldToNew = new Map();
      for (let i = 0; i < newVertexCount; i++) {
        oldToNew.set(remapOut[i], i);
      }

      const newGeometry = new THREE.BufferGeometry();

      const newPositions = new Float32Array(newVertexCount * 3);
      for (let i = 0; i < newVertexCount; i++) {
        const srcIdx = remapOut[i];
        newPositions[i * 3] = positions[srcIdx * 3];
        newPositions[i * 3 + 1] = positions[srcIdx * 3 + 1];
        newPositions[i * 3 + 2] = positions[srcIdx * 3 + 2];
      }
      newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));

      const newIndices = new Uint32Array(simplifiedIndices.length);
      for (let i = 0; i < simplifiedIndices.length; i++) {
        newIndices[i] = oldToNew.get(simplifiedIndices[i]);
      }
      newGeometry.setIndex(new THREE.BufferAttribute(newIndices, 1));

      this._transferAttributes(geo, newGeometry, remapOut);

      newGeometry.computeVertexNormals();

      return newGeometry;

    } catch (err) {
      console.warn("Meshopt fallito, fallback su geometria originale", err);
      return geometry;
    }
  }

  _prepareGeometry(geometry) {
    if (!geometry?.attributes?.position) {
      return geometry;
    }
    if (!geometry.index) {
      geometry = mergeVertices(geometry);
    }
    return geometry;
  }

  _transferAttributes(sourceGeo, targetGeo, remap) {
    ['normal', 'uv', 'color'].forEach(attrName => {
      if (sourceGeo.attributes[attrName]) {
        const srcAttr = sourceGeo.attributes[attrName];
        const itemSize = srcAttr.itemSize;
        const newArray = new Float32Array(remap.length * itemSize);
        
        for (let i = 0; i < remap.length; i++) {
          for (let j = 0; j < itemSize; j++) {
            newArray[i * itemSize + j] = srcAttr.getComponent(remap[i], j);
          }
        }
        
        targetGeo.setAttribute(attrName, new THREE.BufferAttribute(newArray, itemSize));
      }
    });
  }

  decimateForPreview(geometry) {
    return this.decimate(geometry, 0.12, { errorThreshold: 0.05 });
  }

  decimateForBooleanTool(geometry) {
    return this.decimate(geometry, 0.18, { errorThreshold: 0.03 });
  }

  decimateForFinal(geometry) {
    return this.decimate(geometry, 0.45, { errorThreshold: 0.008 });
  }

  async decimateAsync(geometry, targetRatio = 0.25, options = {}) {
    if (!workerManager) {
      workerManager = new MeshoptWorkerManager();
    }
    return workerManager.decimateAsync(geometry, targetRatio, options);
  }
}