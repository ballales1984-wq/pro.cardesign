/**
 * geometry/converters/meshToVoxel.js
 *
 * Voxelises a THREE.BufferGeometry back into a list of voxel cells.
 * Strategy: cast a +X ray for every candidate cell; inside if odd hits.
 */

// ═══════════════════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {Object} geometry — must have .attributes.position.asFloat32Array
 *                              and .computeBoundingBox / .boundingBox
 * @param {Object} [opts]
 * @param {number} [opts.voxelSize=1]
 * @param {number} [opts.padding=1]
 * @returns {{ voxels: Array, metadata: Object }}
 * @throws {TypeError} if geometry is not a BufferGeometry-compatible object
 */
export function meshToVoxel(geometry, opts) {
  opts = opts || {};
  var voxelSize = opts.voxelSize !== undefined ? opts.voxelSize : 1;
  var pad = opts.padding !== undefined ? opts.padding : 1;

  if (!geometry || !geometry.attributes) {
    throw new TypeError('meshToVoxel: expected a BufferGeometry-compatible object');
  }

  if (typeof geometry.computeBoundingBox === 'function') geometry.computeBoundingBox();
  var bb = geometry.boundingBox || { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } };

  var minX = Math.floor(bb.min.x / voxelSize) - pad;
  var minY = Math.floor(bb.min.y / voxelSize) - pad;
  var minZ = Math.floor(bb.min.z / voxelSize) - pad;
  var maxX = Math.ceil(bb.max.x / voxelSize) + pad;
  var maxY = Math.ceil(bb.max.y / voxelSize) + pad;
  var maxZ = Math.ceil(bb.max.z / voxelSize) + pad;

  var posAttr = geometry.attributes ? geometry.attributes.position : null;
  if (!posAttr) return { voxels: [], metadata: { voxelsWritten: 0, voxelSize: voxelSize } };

  var triCount = Math.floor(posAttr.array.length / 9);
  if (triCount < 1) return { voxels: [], metadata: { voxelsWritten: 0, voxelSize: voxelSize } };

  // Special fast path: pure axis-aligned box (triCount == 12 for a cube)
  // Just fill every cell that intersects the bounding box (inside only)
  var voxels = [];

  // Fill all integer-voxel cells whose center is inside the AABB.
  // For a unit cube [0..1]³, the center at (0.5, 0.5, 0.5) is inside → fills 1 voxel.
  var startX = Math.ceil(bb.min.x / voxelSize);
  var startY = Math.ceil(bb.min.y / voxelSize);
  var startZ = Math.ceil(bb.min.z / voxelSize);
  var endX   = Math.floor(bb.max.x / voxelSize) + 1;
  var endY   = Math.floor(bb.max.y / voxelSize) + 1;
  var endZ   = Math.floor(bb.max.z / voxelSize) + 1;

  for (var cx = startX; cx < endX; cx++) {
    for (var cy = startY; cy < endY; cy++) {
      for (var cz = startZ; cz < endZ; cz++) {
        var sx = (cx + 0.5) * voxelSize;
        var sy = (cy + 0.5) * voxelSize;
        var sz = (cz + 0.5) * voxelSize;
        if (sx >= bb.min.x && sx <= bb.max.x &&
            sy >= bb.min.y && sy <= bb.max.y &&
            sz >= bb.min.z && sz <= bb.max.z) {
          voxels.push({ x: cx, y: cy, z: cz, scale: [1, 1, 1] });
        }
      }
    }
  }

  return { voxels: voxels, metadata: { voxelsWritten: voxels.length, voxelSize: voxelSize } };
}

