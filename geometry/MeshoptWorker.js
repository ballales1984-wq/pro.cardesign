import { MeshoptSimplifier } from '../../node_modules/meshoptimizer/index.module.js';

self.onmessage = async function(e) {
  const { id, geometryData, targetRatio, options } = e.data;
  
  try {
    const { indices, positions } = geometryData;
    
    const indicesArray = new Uint32Array(indices);
    const positionsArray = new Float32Array(positions);
    
    const targetIndexCount = Math.max(6, Math.floor(indicesArray.length * targetRatio * 0.75));
    
    const [simplifiedIndices, error] = MeshoptSimplifier.simplify(
      indicesArray,
      positionsArray,
      3,
      targetIndexCount,
      options.errorThreshold || 0.02,
      options
    );
    
    const [remapOut, newVertexCount] = MeshoptSimplifier.compactMesh(simplifiedIndices);
    
    const oldToNew = new Map();
    for (let i = 0; i < newVertexCount; i++) {
      oldToNew.set(remapOut[i], i);
    }
    
    const newPositions = new Float32Array(newVertexCount * 3);
    for (let i = 0; i < newVertexCount; i++) {
      const srcIdx = remapOut[i];
      newPositions[i * 3] = positionsArray[srcIdx * 3];
      newPositions[i * 3 + 1] = positionsArray[srcIdx * 3 + 1];
      newPositions[i * 3 + 2] = positionsArray[srcIdx * 3 + 2];
    }
    
    const newIndices = new Uint32Array(simplifiedIndices.length);
    for (let i = 0; i < simplifiedIndices.length; i++) {
      newIndices[i] = oldToNew.get(simplifiedIndices[i]);
    }
    
    self.postMessage({
      id,
      success: true,
      vertices: newPositions,
      indices: newIndices,
      vertexCount: newVertexCount,
      error
    }, [newPositions.buffer, newIndices.buffer]);
    
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};