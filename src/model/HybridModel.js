/**
 * HybridModel — mode switch + voxel↔mesh conversion coordinator
 *
 * Acts as the single entry point for all modelling operations.
 * Consumers switch between modes via setMode('voxel' | 'mesh').
 *
 * In voxel mode  → delegate to VoxelModel
 * In mesh  mode  → delegate to EditableMeshModel
 *
 * Conversion voxel → mesh uses the Marching-Cubes based converter in
 * geometry/converters/voxelToMesh.js.
 * Conversion mesh  → voxel uses geometry/converters/meshToVoxel.js.
 */
const THREE = await import('three');
import { VoxelEngine } from '../voxel-engine.js';
import { VoxelModel } from './VoxelModel.js';
import { EditableMeshModel } from './EditableMeshModel.js';
import { voxelToMesh } from '../geometry/converters/voxelToMesh.js';
import { meshToVoxel } from '../geometry/converters/meshToVoxel.js';

export class HybridModel {
  /** Voxel side — always present (the "brick builder") */
  constructor(voxelEngine, scene) {
    this.voxelModel = new VoxelModel(voxelEngine);
    this._meshModel = null;
    this._mode = 'voxel';
    this._scene = scene;
    this.onModeChange = null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Mode accessors
  // ═══════════════════════════════════════════════════════════════════════

  get mode() { return this._mode; }

  /**
   * Switch active modelling mode.
   * 'mesh' → voxel: discards the editable mesh (call convertToVoxel first).
   * 'voxel' → mesh: calls convertToMesh() automatically.
   */
  setMode(targetMode) {
    if (this._mode === targetMode) return true;
    if (targetMode === 'mesh') return this._switchToMesh();
    return this._switchToVoxel();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Voxel-mode delegate
  // ═══════════════════════════════════════════════════════════════════════

  addVoxel(pos, material, moduleId) {
    return this.voxelModel.addVoxel(pos, material, moduleId);
  }

  removeVoxel(x, y, z) {
    return this.voxelModel.removeVoxel(x, y, z);
  }

  scaleVoxel(x, y, z, sx, sy, sz) {
    return this.voxelModel.scaleVoxel(x, y, z, sx, sy, sz);
  }

  voxelAt(x, y, z) {
    return this.voxelModel.getVoxel(x, y, z);
  }

  voxelsIterator() {
    return this.voxelModel.voxelsIterator();
  }

  get voxelCount() {
    return this.voxelModel.voxelCount;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Mesh-mode delegate
  // ═══════════════════════════════════════════════════════════════════════

  get meshModel() { return this._meshModel; }

  moveVertex(vertexIndex, delta) {
    if (!this._meshModel) return;
    this._meshModel.moveVertex(vertexIndex, delta);
  }

  moveVertices(ops) {
    if (!this._meshModel) return;
    this._meshModel.moveVertices(ops);
  }

  getVertex(vertexIndex) {
    if (!this._meshModel) return null;
    return this._meshModel.getVertex(vertexIndex, this._meshModel.mesh.matrixWorld);
  }

  get vertexCount() {
    return this._meshModel ? this._meshModel.vertexCount : 0;
  }

  get faceCount() {
    return this._meshModel ? this._meshModel.faceCount : 0;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Conversion: voxel → mesh
  // ═══════════════════════════════════════════════════════════════════════

  convertToMesh(options) {
    if (this._mode === 'mesh' && this._meshModel) {
      return { geometry: this._meshModel.geometry, metadata: { voxelSize: 1, bounds: new THREE.Vector3(), voxelsConverted: 0 } };
    }
    const result = voxelToMesh(this.voxelModel.voxelsIterator(), options);
    this._meshModel = new EditableMeshModel(result.geometry);
    this._mode = 'mesh';
    this._afterModeSwitch();
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Conversion: mesh → voxel
  // ═══════════════════════════════════════════════════════════════════════

  convertToVoxel(options) {
    if (!this._meshModel) return null;
    const { voxels, metadata } = meshToVoxel(this._meshModel.geometry, options);
    for (const v of voxels) {
      this.voxelModel.addVoxel({ x: v.x, y: v.y, z: v.z }, 'steel');
    }
    return { voxels, metadata };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Clear all (both sides)
  // ═══════════════════════════════════════════════════════════════════════

  clearAll() {
    this.voxelModel.clearAll();
    if (this._meshModel) {
      this._meshModel.dispose();
      this._meshModel = null;
    }
    this._mode = 'voxel';
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Serialization
  // ═══════════════════════════════════════════════════════════════════════

  toJSON() {
    return { mode: this._mode, voxels: this.voxelModel.toJSON() };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Private: mode-switch helpers
  // ═══════════════════════════════════════════════════════════════════════

  _switchToMesh() {
    if (!this._meshModel) {
      this.convertToMesh();
    } else {
      this._mode = 'mesh';
      this._afterModeSwitch();
    }
    return true;
  }

  _switchToVoxel() {
    if (this._meshModel) {
      this._meshModel.dispose();
      this._meshModel = null;
    }
    this._mode = 'voxel';
    this._afterModeSwitch();
    return true;
  }

  _afterModeSwitch() {
    this._rebuildSceneGraph();
    if (this.onModeChange) this.onModeChange(this._mode);
  }

  _rebuildSceneGraph() {}

  /** Remove the EditableMeshModel object from all scenes and dispose it. */
  disposeMesh() {
    if (this._meshModel) {
      this._meshModel.dispose();
      this._meshModel = null;
    }
    this._mode = 'voxel';
  }
}
