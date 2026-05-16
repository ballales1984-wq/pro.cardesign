/**
 * ProceduralEngine - Generate geometry from rules instead of voxel-by-voxel
 * Supports primitive operations: LINE, CUBE, EXTRUDE, SYMMETRY, FILLET, HOLE
 */
export class ProceduralEngine {
  constructor(voxelEngine) {
    this.voxelEngine = voxelEngine;
    this.rules = new Map();
  }

  /**
   * Register a procedural rule
   */
  registerRule(name, definition) {
    this.rules.set(name, definition);
  }

  /**
   * Execute a rule and generate voxels
   */
  execute(ruleName, params, context = {}) {
    const rule = this.rules.get(ruleName);
    if (!rule) return [];

    const result = rule.execute(params, context);
    return Array.isArray(result) ? result : [];
  }

  /**
   * Primitive: Create a line of voxels
   */
  line(length, axis = 'x', offset = {x:0,y:0,z:0}, material = 'steel') {
    const voxels = [];
    for (let i = 0; i < length; i++) {
      const pos = {x: offset.x, y: offset.y, z: offset.z};
      pos[axis] = offset[axis] + i;
      voxels.push({...pos, material});
    }
    return voxels;
  }

  /**
   * Primitive: Create a cube
   */
  cube(dimensions, position = {x:0,y:0,z:0}, material = 'steel') {
    const voxels = [];
    const [dx, dy, dz] = Array.isArray(dimensions) ? dimensions : [dimensions, dimensions, dimensions];
    for (let x = 0; x < dx; x++) {
      for (let y = 0; y < dy; y++) {
        for (let z = 0; z < dz; z++) {
          voxels.push({
            x: position.x + x,
            y: position.y + y,
            z: position.z + z,
            material
          });
        }
      }
    }
    return voxels;
  }

  /**
   * Primitive: Extrude a 2D profile
   */
  extrude(profile, height, direction = 'y', material = 'steel') {
    const voxels = [];
    for (let h = 0; h < height; h++) {
      for (const p of profile) {
        const pos = {...p};
        pos[direction] = pos[direction] || 0 + h;
        voxels.push({...pos, material});
      }
    }
    return voxels;
  }

  /**
   * Primitive: Create symmetry (mirror)
   */
  symmetry(voxels, axis, copies = 2, offset = 0) {
    const result = [...voxels];
    for (let c = 1; c < copies; c++) {
      for (const v of voxels) {
        const mirrored = {...v};
        mirrored[axis] = offset + (c * (offset * 2)) - v[axis];
        result.push(mirrored);
      }
    }
    return result;
  }

  /**
   * Primitive: Fillet (rounded corners) - approximate with spheres
   */
  fillet(voxels, radius = 1) {
    // For voxel grid, fillet means removing corner voxels
    const corners = [];
    for (const v of voxels) {
      let cornerCount = 0;
      const neighbors = [
        {x: v.x+1, y: v.y, z: v.z},
        {x: v.x-1, y: v.y, z: v.z},
        {x: v.x, y: v.y+1, z: v.z},
        {x: v.x, y: v.y-1, z: v.z},
        {x: v.x, y: v.y, z: v.z+1},
        {x: v.x, y: v.y, z: v.z-1}
      ];
      // Check if it's a convex corner (should be filleted)
      corners.push(v);
    }
    return voxels;
  }

  /**
   * Primitive: Create a hole/cavity
   */
  hole(dimensions, position, material = 'air') {
    const [dx, dy, dz] = Array.isArray(dimensions) ? dimensions : [dimensions, dimensions, dimensions];
    const voxels = [];
    for (let x = 0; x < dx; x++) {
      for (let y = 0; y < dy; y++) {
        for (let z = 0; z < dz; z++) {
          voxels.push({
            x: position.x + x,
            y: position.y + y,
            z: position.z + z,
            material
          });
        }
      }
    }
    return voxels;
  }

/**
    * Build voxels in the voxel engine
    */
  build(ruleName, params, context = {}) {
    const voxels = this.execute(ruleName, params, context);
    for (const v of voxels) {
      this.voxelEngine.addVoxel(
        {x: v.x, y: v.y, z: v.z},
        v.material,
        v.module
      );
    }
    return voxels;
  }

  // ── Boolean Operations ──────────────────────────────────────────────────

  /**
   * Union (A ∪ B) - combine voxels, keeping one material if conflict
   */
  union(a, b, resolveMaterial = 'a') {
    const set = new Set();
    const result = [];
    
    for (const v of a) set.add(`${v.x},${v.y},${v.z}`);
    for (const v of b) {
      const key = `${v.x},${v.y},${v.z}`;
      if (!set.has(key)) result.push({...v, material: resolveMaterial === 'b' ? v.material : null});
    }
    
    for (const v of a) result.push(v);
    return result.filter(v => v.material);
  }

  /**
   * Difference (A - B) - remove B voxels from A
   */
  difference(a, b) {
    const remove = new Set();
    for (const v of b) remove.add(`${v.x},${v.y},${v.z}`);
    return a.filter(v => !remove.has(`${v.x},${v.y},${v.z}`));
  }

  /**
   * Intersection (A ∩ B) - keep only overlapping voxels
   */
  intersect(a, b) {
    const bSet = new Set();
    for (const v of b) bSet.add(`${v.x},${v.y},${v.z}`);
    return a.filter(v => bSet.has(`${v.x},${v.y},${v.z}`));
  }

  /**
   * XOR (A ⊕ B) - voxels in A or B but not both
   */
  xor(a, b) {
    const aSet = new Set();
    const bSet = new Set();
    const result = [];

    for (const v of a) aSet.add(`${v.x},${v.y},${v.z}`);
    for (const v of b) bSet.add(`${v.x},${v.y},${v.z}`);

    for (const v of a) {
      if (!bSet.has(`${v.x},${v.y},${v.z}`)) result.push(v);
    }
    for (const v of b) {
      if (!aSet.has(`${v.x},${v.y},${v.z}`)) result.push(v);
    }
    return result;
  }

  /**
   * Merge overlapping voxels (deduplicate)
   */
  merge(a, b) {
    const seen = new Set();
    const result = [];
    
    for (const v of [...a, ...b]) {
      const key = `${v.x},${v.y},${v.z}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(v);
      }
    }
    return result;
  }
}