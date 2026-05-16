/**
 * LODManager - Dynamic Level of Detail for voxel rendering
 * Adjusts detail based on camera distance
 */
export class LODManager {
  constructor(camera, voxelEngine, options = {}) {
    this.camera = camera;
    this.voxelEngine = voxelEngine;
    this.lodLevels = options.lodLevels || {
      near: { distance: 5, detail: 'full' },
      medium: { distance: 20, detail: 'reduced' },
      far: { distance: 50, detail: 'simple' }
    };
    this.currentLOD = 'full';
  }

  /**
   * Get LOD level for a voxel based on camera distance
   */
  getLODLevel(voxelPosition) {
    if (!this.camera || !this.camera.position) return 'full';
    
    const dx = voxelPosition.x - this.camera.position.x;
    const dy = voxelPosition.y - this.camera.position.y;
    const dz = voxelPosition.z - this.camera.position.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

    if (distance < this.lodLevels.near.distance) return 'full';
    if (distance < this.lodLevels.medium.distance) return 'reduced';
    if (distance < this.lodLevels.far.distance) return 'simple';
    return 'hidden';
  }

  /**
   * Update all voxel LODs
   */
  update() {
    const cameraPos = this.camera?.position;
    if (!cameraPos) return;

    for (const chunk of this.voxelEngine.chunks.values()) {
      for (const {x, y, z, voxelData} of chunk.voxelsIterator()) {
        const distance = Math.sqrt(
          (x - cameraPos.x)**2 + 
          (y - cameraPos.y)**2 + 
          (z - cameraPos.z)**2
        );

        if (distance > this.lodLevels.far.distance) {
          voxelData.lod = 'hidden';
        } else if (distance > this.lodLevels.medium.distance) {
          voxelData.lod = 'simple';
        } else if (distance > this.lodLevels.near.distance) {
          voxelData.lod = 'reduced';
        } else {
          voxelData.lod = 'full';
        }
      }
    }
  }

  /**
   * Get visible voxels for current LOD
   */
  getVisibleVoxels() {
    const visible = [];
    for (const chunk of this.voxelEngine.chunks.values()) {
      for (const {x, y, z, voxelData} of chunk.voxelsIterator()) {
        if (voxelData.lod !== 'hidden') {
          visible.push({x, y, z, ...voxelData});
        }
      }
    }
    return visible;
  }
}