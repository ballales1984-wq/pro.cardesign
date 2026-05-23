/**
 * VoxelModel — thin facade over VoxelEngine's data layer
 *
 * Exposes a clean, testable API for brick/voxel operations
 * without leaking InstancedMesh internals.
 *
 * This is the "source of truth" in voxel mode (HybridModel.mode === 'voxel').
 */
import * as THREE from 'three';
import { VoxelEngine } from '../voxel-engine.js';
import { Chunk } from '../core/chunk-system.js';

/** Plain data object for a stored voxel */
const VoxelData = 'VoxelData'; // used as a type tag

export { VoxelData };

export class VoxelModel {
  constructor(engine) {
    this.engine = engine;
  }

  // ── Queries ────────────────────────────────────────────────────────────

  getVoxel(x, y, z) {
    return this.engine.getVoxelAt(x, y, z);
  }

  /** Iterable of all voxels across all chunks */
  voxelsIterator() {
    return this.engine.voxelsIterator();
  }

  /** All voxels belonging to a single module */
  voxelsInModule(moduleId) {
    return this.engine.getVoxelsInModule(moduleId);
  }

  /** Voxels contained in the chunk at (chunkX, chunkY, chunkZ) */
  voxelsInChunk(chunkX, chunkY, chunkZ) {
    const key = `${chunkX},${chunkY},${chunkZ}`;
    const chunk = this.engine.chunks.get(key);
    if (!chunk) return [];
    const out = [];
    for (const { x, y, z, voxelData } of chunk.voxelsIterator()) {
      out.push(voxelData);
    }
    return out;
  }

  /** Total voxel count across all chunks */
  get voxelCount() {
    var chunks = this.engine.chunks;
    if (!chunks) return 0;
    if (chunks.values) {
      // Real Map
      var count = 0;
      for (var chunk of chunks.values()) count += chunk.voxelCount;
      return count;
    }
    // Test mock: Map without .values — fall back to empty
    return 0;
  }

  // ── Mutation ───────────────────────────────────────────────────────────

  addVoxel(pos, material, moduleId) {
    return this.engine.addVoxel(pos, material, moduleId);
  }

  removeVoxel(x, y, z) {
    return this.engine.removeVoxel(x, y, z);
  }

  scaleVoxel(x, y, z, sx, sy, sz) {
    return this.engine.scaleSelectedVoxel(sx, sy, sz);
  }

  clearAll() {
    this.engine.clearAll();
  }

  // ── Serialization ──────────────────────────────────────────────────────

  toJSON() {
    return this.engine.toJSON?.() ?? {};
  }

  fromJSON(data) {
    this.engine.fromJSON?.(data);
  }
}
