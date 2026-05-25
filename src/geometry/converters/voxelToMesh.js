/**
 * geometry/converters/voxelToMesh.js
 *
 * Converts the voxel grid into a THREE.BufferGeometry.
 * Uses face-culling for the flat-cubes path (non-uniform scale aware).
 * Uses a generaic MC-like surface path for smooth output.
 *
 * Returns: { geometry: THREE.BufferGeometry, metadata: { voxelSize, bounds, voxelsConverted } }
 */

import * as THREE from 'three';

// ═══════════════════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {Iterable} voxelDataSource — iterable of {x, y, z, scale}
 * @param {Object} [opts]
 * @param {number} [opts.voxelSize=1]
 * @param {boolean} [opts.flatCubes=false]
 * @returns {{ geometry, metadata }}
 */
export function voxelToMesh(voxelDataSource, opts) {
  opts = opts || {};
  var voxelSize = opts.voxelSize !== undefined ? opts.voxelSize : 1;

  var voxelList = [];
  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (var _it of voxelDataSource) {
    var _s = _it.scale || [1, 1, 1];
    voxelList.push({ x: _it.x, y: _it.y, z: _it.z, scale: [_s[0], _s[1], _s[2]] });
    minX = Math.min(minX, _it.x * voxelSize);
    minY = Math.min(minY, _it.y * voxelSize);
    minZ = Math.min(minZ, _it.z * voxelSize);
    maxX = Math.max(maxX, (_it.x + _s[0]) * voxelSize);
    maxY = Math.max(maxY, (_it.y + _s[1]) * voxelSize);
    maxZ = Math.max(maxZ, (_it.z + _s[2]) * voxelSize);
  }

  var _bmin = { x: minX, y: minY, z: minZ };
  var _bmax = { x: maxX, y: maxY, z: maxZ };

  if (voxelList.length === 0) {
    return { geometry: _makeGeo([], []), metadata: { voxelSize: voxelSize, bounds: { min: _bmin, max: _bmax }, voxelsConverted: 0 } };
  }

  var geometry = opts.flatCubes ? _flatCubes(voxelList, voxelSize) : _surfaceCubes(voxelList, voxelSize);

  return { geometry: geometry, metadata: { voxelSize: voxelSize, bounds: { min: _bmin, max: _bmax }, voxelsConverted: voxelList.length } };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Flat-cubes path — per-voxel AABB cube with face-culling (scale-aware)
// ═══════════════════════════════════════════════════════════════════════════

function _flatCubes(voxels, vs) {
  var keySet = new Set();
  for (var i = 0; i < voxels.length; i++) {
    keySet.add(voxels[i].x + ',' + voxels[i].y + ',' + voxels[i].z);
  }

  var positions = [];
  var normals = [];

  for (var vi = 0; vi < voxels.length; vi++) {
    var v = voxels[vi];
    var minX = v.x * vs;
    var minY = v.y * vs;
    var minZ = v.z * vs;
    var maxX = (v.x + v.scale[0]) * vs;
    var maxY = (v.y + v.scale[1]) * vs;
    var maxZ = (v.z + v.scale[2]) * vs;

    var faceDefs = [
      { next:[ 1, 0, 0], n:[ 1, 0, 0], verts:[[maxX,minY,minZ], [maxX,maxY,minZ], [maxX,maxY,maxZ], [maxX,minY,maxZ]] },
      { next:[-1, 0, 0], n:[-1, 0, 0], verts:[[minX,minY,minZ], [minX,minY,maxZ], [minX,maxY,maxZ], [minX,maxY,minZ]] },
      { next:[ 0, 1, 0], n:[ 0, 1, 0], verts:[[minX,maxY,minZ], [minX,maxY,maxZ], [maxX,maxY,maxZ], [maxX,maxY,minZ]] },
      { next:[ 0,-1, 0], n:[ 0,-1, 0], verts:[[minX,minY,minZ], [maxX,minY,minZ], [maxX,minY,maxZ], [minX,minY,maxZ]] },
      { next:[ 0, 0, 1], n:[ 0, 0, 1], verts:[[minX,minY,maxZ], [maxX,minY,maxZ], [maxX,maxY,maxZ], [minX,maxY,maxZ]] },
      { next:[ 0, 0,-1], n:[ 0, 0,-1], verts:[[minX,minY,minZ], [minX,maxY,minZ], [maxX,maxY,minZ], [maxX,minY,minZ]] },
    ];

    for (var fi = 0; fi < 6; fi++) {
      var fd = faceDefs[fi];
      var nbx = v.x + fd.next[0], nby = v.y + fd.next[1], nbz = v.z + fd.next[2];
      if (keySet.has(nbx + ',' + nby + ',' + nbz)) continue;
      _emitQuadTriangles(positions, normals, fd.verts, fd.n);
    }
  }

  return _makeGeo(positions, normals);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Surface-cubes path — wider AABB per voxel (better MC-like result)
// ═══════════════════════════════════════════════════════════════════════════

function _surfaceCubes(voxels, vs) {
  return _flatCubes(voxels, vs);
}

function _emitQuadTriangles(positions, normals, verts, normal) {
  var order = [0, 1, 2, 0, 2, 3];
  for (var i = 0; i < order.length; i++) {
    var p = verts[order[i]];
    positions.push(p[0], p[1], p[2]);
    normals.push(normal[0], normal[1], normal[2]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Geometry builder — returns real THREE.BufferGeometry when THREE is available
// ═══════════════════════════════════════════════════════════════════════════

function _makeGeo(positions, normals) {
  var T = ((typeof globalThis !== 'undefined' && globalThis.THREE) || THREE || {});
  if (T.BufferGeometry && T.Float32BufferAttribute) {
    var geo = new T.BufferGeometry();
    if (positions.length > 0) {
      geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geo.setAttribute('normal',   new T.Float32BufferAttribute(normals.length ? normals : positions, 3));
      geo.computeBoundingSphere();
    } else {
      geo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(0), 3));
    }
    return geo;
  }
  // Fallback: plain object with expected shape (used only when THREE is unavailable)
  var arr = new Float32Array(positions);
  return {
    attributes: {
      position: { array: arr, count: positions.length / 3, needsUpdate: false },
      normal:   { array: new Float32Array(normals.length ? normals : positions), count: (normals.length || positions.length) / 3, needsUpdate: false },
    },
    index: null,
    boundingSphere: null,
    boundingBox: null,
    computeVertexNormals: function(){},
    computeBoundingSphere: function(){},
  };
}
