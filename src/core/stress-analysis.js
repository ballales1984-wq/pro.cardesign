/**
 * StressAnalysis - FEM-based stress analysis for voxel structures
 * Calculates stress distribution, identifies critical zones
 */
export class StressAnalysis {
  constructor(voxelEngine, materialDB) {
    this.voxelEngine = voxelEngine;
    this.materialDB = materialDB;
    this.results = new Map();
  }

  /**
   * Calculate stress for all voxels
   * Simple finite difference approach
   */
  analyze(voxels) {
    const results = [];
    
    for (const voxel of voxels) {
      const stress = this._calculateVoxelStress(voxel, voxels);
      results.push({
        x: voxel.x,
        y: voxel.y,
        z: voxel.z,
        material: voxel.material,
        stress,
        strain: stress / this._getYoungsModulus(voxel.material)
      });
    }
    
    this.results = new Map(results.map(r => [`${r.x},${r.y},${r.z}`, r]));
    return results;
  }

  _calculateVoxelStress(voxel, allVoxels) {
    const material = this.materialDB.get(voxel.material);
    if (!material) return 0;
    
    // Simplified stress calculation based on boundary conditions
    // In real FEM, this would solve the equilibrium equations
    const boundaryForce = this._estimateBoundaryForce(voxel, allVoxels);
    const area = 1.0; // voxel face area
    
    return boundaryForce / area;
  }

  _estimateBoundaryForce(voxel, allVoxels) {
    const neighbors = this._getNeighbors(voxel, allVoxels);
    const exposedFaces = 6 - neighbors.length;
    
    // External force approximation
    return exposedFaces * 1000; // Pa approximation
  }

  _getNeighbors(voxel, allVoxels) {
    const set = new Set(allVoxels.map(v => `${v.x},${v.y},${v.z}`));
    const neighbors = [];
    
    for (const [dx, dy, dz] of [
      [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]
    ]) {
      if (set.has(`${voxel.x+dx},${voxel.y+dy},${voxel.z+dz}`)) {
        neighbors.push({x: voxel.x+dx, y: voxel.y+dy, z: voxel.z+dz});
      }
    }
    return neighbors;
  }

  _getYoungsModulus(materialName) {
    const material = this.materialDB.get(materialName);
    return material?.youngsModulus ?? 70e9;
  }

  /**
   * Identify critical zones (stress > yield/2)
   */
  getCriticalZones() {
    const critical = [];
    const keys = Array.from(this.results.keys());
    
    for (const key of keys) {
      const r = this.results.get(key);
      const yieldStrength = this.materialDB.get(r.material)?.tensileStrength ?? 400e6;
      
      if (r.stress > yieldStrength * 0.5) {
        critical.push(r);
      }
    }
    
    return critical.sort((a, b) => b.stress - a.stress);
  }

  /**
   * Calculate safety factor
   */
  getSafetyFactor() {
    const results = Array.from(this.results.values());
    if (results.length === 0) return 1;
    
    const maxStress = Math.max(...results.map(r => r.stress));
    const minYield = Math.min(...results.map(r => 
      this.materialDB.get(r.material)?.tensileStrength ?? 1
    ));
    
    return minYield / maxStress;
  }

  /**
   * Export results as JSON
   */
  toJSON() {
    return {
      results: Array.from(this.results.values()),
      criticalZones: this.getCriticalZones(),
      safetyFactor: this.getSafetyFactor(),
      timestamp: Date.now()
    };
  }
}