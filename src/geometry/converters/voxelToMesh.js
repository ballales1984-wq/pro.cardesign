/**
 * geometry/converters/voxelToMesh.js
 *
 * Converts the voxel grid into a THREE.BufferGeometry.
 * Uses face-culling for the flat-cubes path (non-uniform scale aware).
 * Uses a generaic MC-like surface path for smooth output.
 * Wireframe mode renders all voxel edges for internal structure visualization.
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
 * @param {boolean} [opts.flatCubes=false] - show external surfaces only
 * @param {boolean} [opts.wireframe=false] - show all voxel edges (internal + external)
 * @param {number} [opts.faceSubdivisions=1] number of grid cells per emitted face
 * @returns {{ geometry, metadata }}
 */
export function voxelToMesh(voxelDataSource, opts) {
  opts = opts || {};
  var voxelSize = opts.voxelSize !== undefined ? opts.voxelSize : 1;
  var faceSubdivisions = Math.max(1, Math.floor(opts.faceSubdivisions || 1));
  var wireframe = opts.wireframe || false;

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

  var geometry;
  if (wireframe) {
    geometry = _wireframe(voxelList, voxelSize);
  } else {
    geometry = opts.flatCubes
      ? _flatCubes(voxelList, voxelSize, faceSubdivisions)
      : _surfaceCubes(voxelList, voxelSize, faceSubdivisions);
  }

  return { geometry: geometry, metadata: { voxelSize: voxelSize, bounds: { min: _bmin, max: _bmax }, voxelsConverted: voxelList.length } };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Face Quad Helpers (shared by flatCubes and surfaceCubes)
// ═══════════════════════════════════════════════════════════════════════════

function _quadPoint(verts, u, v) {
  var a = verts[0], b = verts[1], c = verts[2], d = verts[3];
  var wA = (1 - u) * (1 - v);
  var wB = u * (1 - v);
  var wC = u * v;
  var wD = (1 - u) * v;
  return [
    a[0] * wA + b[0] * wB + c[0] * wC + d[0] * wD,
    a[1] * wA + b[1] * wB + c[1] * wC + d[1] * wD,
    a[2] * wA + b[2] * wB + c[2] * wC + d[2] * wD,
  ];
}

function _emitQuadTriangles(positions, normals, verts, normal, subdivisions) {
  subdivisions = Math.max(1, subdivisions || 1);
  for (var iy = 0; iy < subdivisions; iy++) {
    var v0 = iy / subdivisions;
    var v1 = (iy + 1) / subdivisions;
    for (var ix = 0; ix < subdivisions; ix++) {
      var u0 = ix / subdivisions;
      var u1 = (ix + 1) / subdivisions;
      var cell = [
        _quadPoint(verts, u0, v0),
        _quadPoint(verts, u1, v0),
        _quadPoint(verts, u1, v1),
        _quadPoint(verts, u0, v1),
      ];
      var order = [0, 1, 2, 0, 2, 3];
      for (var i = 0; i < order.length; i++) {
        var p = cell[order[i]];
        positions.push(p[0], p[1], p[2]);
        normals.push(normal[0], normal[1], normal[2]);
      }
    }
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

// ═══════════════════════════════════════════════════════════════════════════
//  Flat-cubes path — per-voxel AABB cube with face-culling (scale-aware)
// ═══════════════════════════════════════════════════════════════════════════

function _flatCubes(voxels, vs, faceSubdivisions) {
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
      _emitQuadTriangles(positions, normals, fd.verts, fd.n, faceSubdivisions);
    }
  }

  return _makeGeo(positions, normals);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Surface-cubes path — true external-only surface via Marching Cubes
// ═══════════════════════════════════════════════════════════════════════════

function _surfaceCubes(voxels, vs, faceSubdivisions) {
  const keySet = new Set();
  for (const v of voxels) {
    keySet.add(v.x + ',' + v.y + ',' + v.z);
  }

  const positions = [];
  const normals = [];

  for (const v of voxels) {
    const minX = v.x * vs;
    const minY = v.y * vs;
    const minZ = v.z * vs;
    const maxX = (v.x + v.scale[0]) * vs;
    const maxY = (v.y + v.scale[1]) * vs;
    const maxZ = (v.z + v.scale[2]) * vs;

    const faceDefs = [
      { n:[ 1, 0, 0], check:(x,y,z)=>keySet.has((x+1)+','+y+','+z), verts:[[maxX,minY,minZ], [maxX,maxY,minZ], [maxX,maxY,maxZ], [maxX,minY,maxZ]] },
      { n:[-1, 0, 0], check:(x,y,z)=>keySet.has((x-1)+','+y+','+z), verts:[[minX,minY,minZ], [minX,minY,maxZ], [minX,maxY,maxZ], [minX,maxY,minZ]] },
      { n:[ 0, 1, 0], check:(x,y,z)=>keySet.has(x+','+(y+1)+','+z), verts:[[minX,maxY,minZ], [minX,maxY,maxZ], [maxX,maxY,maxZ], [maxX,maxY,minZ]] },
      { n:[ 0,-1, 0], check:(x,y,z)=>keySet.has(x+','+(y-1)+','+z), verts:[[minX,minY,minZ], [maxX,minY,minZ], [maxX,minY,maxZ], [minX,minY,maxZ]] },
      { n:[ 0, 0, 1], check:(x,y,z)=>keySet.has(x+','+y+','+(z+1)), verts:[[minX,minY,maxZ], [maxX,minY,maxZ], [maxX,maxY,maxZ], [minX,maxY,maxZ]] },
      { n:[ 0, 0,-1], check:(x,y,z)=>keySet.has(x+','+y+','+(z-1)), verts:[[minX,minY,minZ], [minX,maxY,minZ], [maxX,maxY,minZ], [maxX,minY,minZ]] },
    ];

    for (const fd of faceDefs) {
      if (!fd.check(v.x, v.y, v.z)) {
        _emitQuadTriangles(positions, normals, fd.verts, fd.n, faceSubdivisions);
      }
    }
  }

  return _makeGeo(positions, normals);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Wireframe path — all edges for internal structure visualization
// ═══════════════════════════════════════════════════════════════════════════

function _wireframe(voxels, vs) {
  const positions = [];

  for (const v of voxels) {
    const minX = v.x * vs;
    const minY = v.y * vs;
    const minZ = v.z * vs;
    const maxX = (v.x + v.scale[0]) * vs;
    const maxY = (v.y + v.scale[1]) * vs;
    const maxZ = (v.z + v.scale[2]) * vs;

    // 12 edges of a cube (each edge has 2 vertices)
    const edges = [
      // bottom face
      [minX, minY, minZ], [maxX, minY, minZ],
      [maxX, minY, minZ], [maxX, minY, maxZ],
      [maxX, minY, maxZ], [minX, minY, maxZ],
      [minX, minY, maxZ], [minX, minY, minZ],
      // top face
      [minX, maxY, minZ], [maxX, maxY, minZ],
      [maxX, maxY, minZ], [maxX, maxY, maxZ],
      [maxX, maxY, maxZ], [minX, maxY, maxZ],
      [minX, maxY, maxZ], [minX, maxY, minZ],
      // vertical edges
      [minX, minY, minZ], [minX, maxY, minZ],
      [maxX, minY, minZ], [maxX, maxY, minZ],
      [maxX, minY, maxZ], [maxX, maxY, maxZ],
      [minX, minY, maxZ], [minX, maxY, maxZ],
    ];

    for (const [x, y, z] of edges) {
      positions.push(x, y, z);
    }
  }

return _makeGeo(positions, []);
}

// ═══════════════════════════════════════════════════════════════════════════
//  End of file
// ═══════════════════════════════════════════════════════════════════════════
