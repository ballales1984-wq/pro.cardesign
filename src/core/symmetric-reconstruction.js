export class SymmetricReconstruction {
  constructor(options = {}) {
    this.axis = options.axis || 'x';
    this.axisIdx = { x: 0, y: 1, z: 2 }[this.axis] ?? 0;
    this.tolerance = options.tolerance ?? 1e-3;
  }

  reconstruct(voxels) {
    if (!voxels || voxels.length < 3) {
      return { voxels, mirrorQuality: 0, symmetryAxis: 0, kept: voxels ? voxels.length : 0 };
    }

    const axis = this.axis;
    const posKey = (v) => `${v.x},${v.y},${v.z}`;

    const seen = new Set();
    const deduped = [];
    for (const v of voxels) {
      const key = posKey(v);
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(v);
      }
    }

    const coords = deduped.map(v => v[axis]);
    const minC = Math.min(...coords);
    const maxC = Math.max(...coords);
    const center = (minC + maxC) / 2;

    const left = deduped.filter(v => v[axis] <= center);
    const right = deduped.filter(v => v[axis] > center);

    const baseSide = left.length >= right.length ? left : right;
    const mirrorSide = left.length >= right.length ? right : left;

    const baseSet = new Set(baseSide.map(posKey));
    const mirrored = [];
    for (const v of mirrorSide) {
      const candidate = { ...v };
      candidate[axis] = Math.round(2 * center - v[axis]);
      const key = posKey(candidate);
      if (!baseSet.has(key)) {
        mirrored.push(candidate);
        baseSet.add(key);
      }
    }

    const fullVoxels = [...baseSide, ...mirrored];
    const quality = this._computeQuality(left, right, center);

    return {
      voxels: fullVoxels,
      mirrorQuality: quality,
      symmetryAxis: center,
      kept: fullVoxels.length,
      leftCount: left.length,
      rightCount: right.length,
      mirroredCount: mirrored.length
    };
  }

  _computeQuality(left, right, center) {
    if (left.length === 0 || right.length === 0) return 0;

    const axis = this.axis;
    const mirrorRight = right.map(v => {
      const m = { ...v };
      m[axis] = 2 * center - v[axis];
      return m;
    });

    const leftMean = this._avgCoord(left);
    const rightMean = this._avgCoord(mirrorRight);
    const maxDim = this._maxDimension([...left, ...right]);

    if (maxDim < 1e-6) return 0;

    const dx = leftMean.x - rightMean.x;
    const dy = leftMean.y - rightMean.y;
    const dz = leftMean.z - rightMean.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return Math.max(0, Math.min(1, 1 - dist / maxDim));
  }

  _avgCoord(voxels) {
    if (voxels.length === 0) return { x: 0, y: 0, z: 0 };
    const sum = { x: 0, y: 0, z: 0 };
    for (const v of voxels) {
      sum.x += v.x;
      sum.y += v.y;
      sum.z += v.z;
    }
    const n = voxels.length;
    return { x: sum.x / n, y: sum.y / n, z: sum.z / n };
  }

  _maxDimension(voxels) {
    if (voxels.length === 0) return 0;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const v of voxels) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    return Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  }

  mirrorVoxels(voxels, copies = 2) {
    if (voxels.length === 0) return voxels;
    const axis = this.axis;
    const posKey = (v) => `${v.x},${v.y},${v.z}`;
    const seen = new Set(voxels.map(posKey));
    const result = [...voxels];

    const coords = voxels.map(v => v[axis]);
    const minC = Math.min(...coords);
    const maxC = Math.max(...coords);
    const center = (minC + maxC) / 2;

    for (let c = 1; c < copies; c++) {
      for (const v of voxels) {
        const mirrored = { ...v };
        mirrored[axis] = Math.round(2 * center - v[axis]);
        const key = posKey(mirrored);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(mirrored);
        }
      }
    }
    return result;
  }

  analyzeSymmetry(voxels) {
    if (!voxels || voxels.length === 0) {
      return { isSymmetric: false, quality: 0, recommendation: 'no-voxels' };
    }
    const result = this.reconstruct(voxels);
    const quality = result.mirrorQuality;
    if (quality > 0.8) {
      return { isSymmetric: true, quality, recommendation: 'symmetric-reconstruction-applicable' };
    } else if (quality > 0.5) {
      return { isSymmetric: false, quality, recommendation: 'partial-symmetry-use-with-caution' };
    } else {
      return { isSymmetric: false, quality, recommendation: 'not-symmetric-avoid-reconstruction' };
    }
  }
}

export function reconstructSymmetric(voxels, options = {}) {
  return new SymmetricReconstruction(options).reconstruct(voxels);
}

export function analyzeSymmetry(voxels, options = {}) {
  return new SymmetricReconstruction(options).analyzeSymmetry(voxels);
}
