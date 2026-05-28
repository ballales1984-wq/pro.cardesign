/**
 * CollisionDetection - Detects and resolves collisions between voxel structures
 * and between voxel structures and imported meshes
 */
export class CollisionDetection {
  constructor(voxelEngine) {
    this.voxelEngine = voxelEngine;
  }

  /**
   * Check if two voxel sets collide (intersect)
   * @param {Array} voxelsA - First voxel set [{x,y,z,scale}, ...]
   * @param {Array} voxelsB - Second voxel set [{x,y,z,scale}, ...]
   * @returns {Object} Collision result {collides: true, points: [...], depth: number, normal: {x,y,z}}
   */
  static voxelVsVoxel(voxelsA, voxelsB) {
    // Convert to sets for fast lookup
    const setA = new Set();
    for (const voxel of voxelsA) {
      const scale = voxel.scale || [1, 1, 1];
      // Mark all occupied positions by this voxel
      for (let x = voxel.x; x < voxel.x + scale[0]; x++) {
        for (let y = voxel.y; y < voxel.y + scale[1]; y++) {
          for (let z = voxel.z; z < voxel.z + scale[2]; z++) {
            setA.add(`${x},${y},${z}`);
          }
        }
      }
    }

    const setB = new Set();
    for (const voxel of voxelsB) {
      const scale = voxel.scale || [1, 1, 1];
      // Mark all occupied positions by this voxel
      for (let x = voxel.x; x < voxel.x + scale[0]; x++) {
        for (let y = voxel.y; y < voxel.y + scale[1]; y++) {
          for (let z = voxel.z; z < voxel.z + scale[2]; z++) {
            setB.add(`${x},${y},${z}`);
          }
        }
      }
    }

    // Find intersection
    const collisionPoints = [];
    for (const pos of setA) {
      if (setB.has(pos)) {
        const [x, y, z] = pos.split(',').map(Number);
        collisionPoints.push({x: parseFloat(x), y: parseFloat(y), z: parseFloat(z)});
      }
    }

    if (collisionPoints.length > 0) {
      // Calculate approximate collision normal and depth
      // For simplicity, we'll return the centroid and a default normal
      const centroid = {
        x: collisionPoints.reduce((sum, p) => sum + p.x, 0) / collisionPoints.length,
        y: collisionPoints.reduce((sum, p) => sum + p.y, 0) / collisionPoints.length,
        z: collisionPoints.reduce((sum, p) => sum + p.z, 0) / collisionPoints.length
      };

      return {
        collides: true,
        points: collisionPoints,
        depth: 1.0, // Approximate penetration depth
        normal: {x: 0, y: 1, z: 0} // Default upward normal - should be improved
      };
    }

    return {collides: false, points: [], depth: 0, normal: {x: 0, y: 0, z: 0}};
  }

  /**
   * Check collision between voxel set and a mesh
   * @param {Array} voxels - Voxel set [{x,y,z,scale}, ...]
   * @param {THREE.Mesh} mesh - Three.js mesh to check against
   * @returns {Object} Collision result
   */
  static voxelVsMesh(voxels, mesh) {
    // This is a simplified implementation
    // A production version would use BVH or other acceleration structures
    
    if (!mesh.geometry || !mesh.geometry.attributes.position) {
      return {collides: false, points: [], depth: 0, normal: {x: 0, y: 0, z: 0}};
    }

    const positions = mesh.geometry.attributes.position;
    const voxelSet = new Set();

    // Mark all voxel positions
    for (const voxel of voxels) {
      const scale = voxel.scale || [1, 1, 1];
      for (let x = voxel.x; x < voxel.x + scale[0]; x++) {
        for (let y = voxel.y; y < voxel.y + scale[1]; y++) {
          for (let z = voxel.z; z < voxel.z + scale[2]; z++) {
            voxelSet.add(`${x},${y},${z}`);
          }
        }
      }
    }

    // Check each vertex of the mesh against voxel set
    const collisionPoints = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      if (voxelSet.has(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`)) {
        collisionPoints.push({x, y, z});
      }
    }

    if (collisionPoints.length > 0) {
      const centroid = {
        x: collisionPoints.reduce((sum, p) => sum + p.x, 0) / collisionPoints.length,
        y: collisionPoints.reduce((sum, p) => sum + p.y, 0) / collisionPoints.length,
        z: collisionPoints.reduce((sum, p) => sum + p.z, 0) / collisionPoints.length
      };

      return {
        collides: true,
        points: collisionPoints,
        depth: 0.5, // Approximate
        normal: {x: 0, y: 1, z: 0} // Should be calculated from mesh
      };
    }

    return {collides: false, points: [], depth: 0, normal: {x: 0, y: 0, z: 0}};
  }

  /**
   * Check if a position is inside any voxel in the set
   * @param {Array} voxels - Voxel set [{x,y,z,scale}, ...]
   * @param {Object} position - {x, y, z} position to check
   * @returns {boolean} True if position is inside a voxel
   */
  static pointInVoxels(voxels, position) {
    for (const voxel of voxels) {
      const scale = voxel.scale || [1, 1, 1];
      if (
        position.x >= voxel.x &&
        position.x < voxel.x + scale[0] &&
        position.y >= voxel.y &&
        position.y < voxel.y + scale[1] &&
        position.z >= voxel.z &&
        position.z < voxel.z + scale[2]
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all voxels from the voxel engine
   * @returns {Array} Array of voxel objects with position and scale
   */
  getAllVoxels() {
    const voxels = [];
    for (const chunk of this.voxelEngine.chunks.values()) {
      for (const {x, y, z, voxelData} of chunk.voxelsIterator()) {
        voxels.push({
          x: voxelData.x,
          y: voxelData.y,
          z: voxelData.z,
          scale: voxelData.scale || [1, 1, 1]
        });
      }
    }
    return voxels;
  }

  /**
   * Check for self-collision within the voxel engine's current voxel set
   * This would detect intersecting volumes within the same model
   * @returns {Object} Collision result
   */
  checkSelfCollision() {
    const voxels = this.getAllVoxels();
    // For self-collision, we need to check if any voxel overlaps with another
    // This is computationally expensive O(n^2) - in production would use spatial partitioning
    
    for (let i = 0; i < voxels.length; i++) {
      for (let j = i + 1; j < voxels.length; j++) {
        const result = CollisionDetection.voxelVsVoxel([voxels[i]], [voxels[j]]);
        if (result.collides) {
          return {
            collides: true,
            points: result.points,
            depth: result.depth,
            normal: result.normal,
            voxelA: voxels[i],
            voxelB: voxels[j]
          };
        }
      }
    }
    
    return {collides: false, points: [], depth: 0, normal: {x: 0, y: 0, z: 0}};
  }
}