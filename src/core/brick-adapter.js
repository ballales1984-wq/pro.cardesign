/**
 * BrickAdapter — Wrapper around existing VoxelEngine
 * Converts voxels to Bricks with real dimensions, without modifying voxel-engine.js
 *
 * Strategy:
 *   Each voxel → Brick with size = scale[0..2] (default 1×1×1 mm)
 *   Position = voxel.x,y,z * voxelSize (mm)
 *   Maintain backward compatibility with existing VoxelEngine
 */

import * as THREE from 'three';
import { Brick } from './brick-system.js';

export class BrickAdapter {
  constructor(voxelEngine) {
    this.engine = voxelEngine;
    this.bricks = new Map();        // brickId → Brick
    this.nextId = 1;
    this.SCALE = 0.01;              // 1mm → 0.01 Three.js units
    this.selectedBrickId = null;
    
    // Observe voxelEngine changes to synchronize
    this._syncFromVoxelEngine();
    
    // Register event listener
    this._boundOnVoxelsUpdated = () => this._onVoxelsUpdated();
    window.addEventListener('voxels-updated', this._boundOnVoxelsUpdated);
  }

  // ── Voxel → Brick Conversion ──────────────────────────────

  _voxelToBrick(voxel) {
    const scale = voxel.scale || [1, 1, 1];
    const pos = this.engine._worldPos ? this.engine._worldPos({ 
      x: voxel.x, y: voxel.y, z: voxel.z 
    }) : { x: voxel.x, y: voxel.y, z: voxel.z };
    
    return new Brick(
      this.nextId++,
      `Voxel_${voxel.x}_${voxel.y}_${voxel.z}`,
      { x: pos.x, y: pos.y, z: pos.z },
      { x: scale[0] || 1, y: scale[1] || 1, z: scale[2] || 1 },
      voxel.material
    );
  }

  _syncFromVoxelEngine() {
    this.bricks.clear();
    for (const [key, voxel] of this.engine.voxels) {
      const brick = this._voxelToBrick(voxel);
      this.bricks.set(brick.id, brick);
    }
    this.nextId = Math.max(...Array.from(this.bricks.keys()), 0) + 1;
  }

  _onVoxelsUpdated() {
    // Incremental: add/remove only changed
    // For now: complete rebuild (simple)
    this._syncFromVoxelEngine();
  }

  // ── Brick API ─────────────────────────────────────────────

  getAll() {
    return Array.from(this.bricks.values());
  }

  get(id) {
    return this.bricks.get(id);
  }

  getSelected() {
    return this.selectedBrickId ? this.bricks.get(this.selectedBrickId) : null;
  }

  selectByVoxel(x, y, z) {
    for (const brick of this.bricks.values()) {
      const bx = Math.round(brick.position.x);
      const by = Math.round(brick.position.y);
      const bz = Math.round(brick.position.z);
      if (bx === x && by === y && bz === z) {
        this.selectedBrickId = brick.id;
        return brick;
      }
    }
    this.selectedBrickId = null;
    return null;
  }

  // ── Brick Creation ────────────────────────────────────────

  createBrick(params) {
    // params: { position: {x,y,z}, size: {x,y,z}, material }
    const brick = new Brick(
      this.nextId++,
      `Brick_${this.nextId}`,
      params.position,
      params.size,
      params.material || this.engine.activeMaterial
    );
    this.bricks.set(brick.id, brick);
    
    // Also add to VoxelEngine (rounded coordinates)
    const voxelPos = {
      x: Math.round(params.position.x),
      y: Math.round(params.position.y),
      z: Math.round(params.position.z)
    };
    this.engine.addVoxel(voxelPos, brick.material, this.engine.activeModule);
    
    // Apply scale if size ≠ 1
    if (params.size && (params.size.x !== 1 || params.size.y !== 1 || params.size.z !== 1)) {
      const voxel = this.engine.getVoxelAt(voxelPos.x, voxelPos.y, voxelPos.z);
      if (voxel) {
        voxel.scale = [params.size.x, params.size.y, params.size.z];
        // Update matrix
        const mesh = this.engine.instancedMeshes.get(voxel.material);
        if (mesh) {
          const key = this.engine._gridKey(voxelPos);
          const instMap = this.engine.keyToInstance.get(voxel.material);
          const instanceId = instMap?.get(key);
          if (instanceId !== undefined) {
            this.engine._setInstanceMatrix(
              mesh, instanceId, this.engine._worldPos(voxelPos),
              new THREE.Vector3(params.size.x, params.size.y, params.size.z)
            );
          }
        }
      }
    }
    
    return brick;
  }

  // ── Scale Brick ───────────────────────────────────────────

  scaleBrick(brickId, newSize) {
    const brick = this.bricks.get(brickId);
    if (!brick) return false;
    
    const oldSize = { ...brick.size };
    brick.size = { ...newSize };
    
    // Update voxelEngine
    const voxelPos = { 
      x: Math.round(brick.position.x), 
      y: Math.round(brick.position.y), 
      z: Math.round(brick.position.z) 
    };
    const voxel = this.engine.getVoxelAt(voxelPos.x, voxelPos.y, voxelPos.z);
    if (voxel) {
      voxel.scale = [newSize.x, newSize.y, newSize.z];
      const materialName = voxel.material;
      const mesh = this.engine.instancedMeshes.get(materialName);
      if (mesh) {
        const key = this.engine._gridKey(voxelPos);
        const instMap = this.engine.keyToInstance.get(materialName);
        const instanceId = instMap?.get(key);
        if (instanceId !== undefined) {
          this.engine._setInstanceMatrix(
            mesh, instanceId, this.engine._worldPos(voxelPos),
            new THREE.Vector3(newSize.x, newSize.y, newSize.z)
          );
        }
      }
    }
    
    return true;
  }

  // ── Remove Brick ──────────────────────────────────────────

  removeBrick(brickId) {
    const brick = this.bricks.get(brickId);
    if (!brick) return false;
    
    const voxelPos = {
      x: Math.round(brick.position.x),
      y: Math.round(brick.position.y),
      z: Math.round(brick.position.z)
    };
    this.engine.removeVoxel(voxelPos.x, voxelPos.y, voxelPos.z);
    this.bricks.delete(brickId);
    
    if (this.selectedBrickId === brickId) {
      this.selectedBrickId = null;
    }
    
    return true;
  }

  // ── Statistics ────────────────────────────────────────────

  getTotalVolume() {
    let total = 0;
    for (const brick of this.bricks.values()) {
      total += brick.volume_mm3;
    }
    return total;
  }

  getMaterialBreakdown() {
    const breakdown = {};
    for (const brick of this.bricks.values()) {
      if (!breakdown[brick.material]) {
        breakdown[brick.material] = { count: 0, volume_mm3: 0 };
      }
      breakdown[brick.material].count++;
      breakdown[brick.material].volume_mm3 += brick.volume_mm3;
    }
    return breakdown;
  }

  toJSON() {
    const bricks = this.getAll().map(b => ({
      id: b.id,
      name: b.name,
      position: { x: b.position.x, y: b.position.y, z: b.position.z },
      size: { x: b.size.x, y: b.size.y, z: b.size.z },
      material: b.material,
      isVisible: b.isVisible
    }));
    return { 
      version: '0.4.0-bricks', 
      bricks,
      brickCount: bricks.length
    };
  }

  destroy() {
    window.removeEventListener('voxels-updated', this._boundOnVoxelsUpdated);
    this.bricks.clear();
  }
}

export default BrickAdapter;