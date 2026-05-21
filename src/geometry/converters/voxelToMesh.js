/**
 * geometry/converters/voxelToMesh.js
 *
 * Converts the voxel grid into a THREE.BufferGeometry.
 * Uses face-culling for the flat-cubes path (non-uniform scale aware).
 * Uses a generaic MC-like surface path for smooth output.
 *
 * Returns: { geometry: THREE.BufferGeometry, metadata: { voxelSize, bounds, voxelsConverted } }
 */

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
  var vsHalf = vs * 0.5;

  for (var vi = 0; vi < voxels.length; vi++) {
    var v = voxels[vi];
    var cx = v.x * vs, cy = v.y * vs, cz = v.z * vs;
    var hx = v.scale[0] * vsHalf;
    var hy = v.scale[1] * vsHalf;
    var hz = v.scale[2] * vsHalf;

    // 6 faces: [nx,ny,nz, half-offset-x, half-offset-y, half-offset-z]
    var faceDefs = [
      [ 1,  0,  0, +hx, 0,    0    ],
      [-1,  0,  0, -hx, 0,    0    ],
      [ 0,  1,  0, 0,   +hy,  0    ],
      [ 0, -1,  0, 0,   -hy,  0    ],
      [ 0,  0,  1, 0,   0,    +hz  ],
      [ 0,  0, -1, 0,   0,    -hz  ],
    ];

    for (var fi = 0; fi < 6; fi++) {
      var fd = faceDefs[fi];
      var nx = fd[0], ny = fd[1], nz = fd[2];
      var ox = fd[3], oy = fd[4], oz = fd[5];
      var nbx = v.x + Math.round(nx), nby = v.y + Math.round(ny), nbz = v.z + Math.round(nz);
      if (keySet.has(nbx + ',' + nby + ',' + nbz)) continue;

      // 4 corner offsets from the face center
      // Determine which 2 axes form this face plane
      var uSign = 1, vSign = 1;
      var uAx = 0, uAy = 0, uAz = 0;   // U axis of the face quad
      var vAx = 0, vAy = 0, vAz = 0;   // V axis of the face quad

      if (Math.abs(nx) > 0.5) {           // X ± face
        uAx = 0; uAy = 0; uAz = hz * 2;   // Z becomes U
        vAx = 0; vAy = hy * 2; vAz = 0;   // Y becomes V
      } else if (Math.abs(ny) > 0.5) {    // Y ± face
        uAx = hx * 2; uAy = 0; uAz = 0;   // X becomes U
        vAx = 0; vAy = 0; vAz = hz * 2;   // Z becomes V
      } else {                             // Z ± face
        uAx = hx * 2; uAy = 0; uAz = 0;   // X becomes U
        vAx = 0; vAy = hy * 2; vAz = 0;   // Y becomes V
      }

      // Flip U/V for negative normals to keep CCW outward winding
      if (nx < 0 || ny < 0 || nz < 0) {
        uAx = -uAx; uAy = -uAy; uAz = -uAz;
        vAx = -vAx; vAy = -vAy; vAz = -vAz;
      }

      // 4 quad vertices
      // (center) + (±u/2 ± v/2) + normal * half
      var halfU = 0.5, halfV = 0.5;
      var verts = [
        [cx+ox - uAx*halfU - vAx*halfV + nx*vsHalf, cy+oy - uAy*halfU - vAy*halfV + ny*vsHalf, cz+oz - uAz*halfU - vAz*halfV + nz*vsHalf],
        [cx+ox + uAx*halfU - vAx*halfV + nx*vsHalf, cy+oy + uAy*halfU - vAy*halfV + ny*vsHalf, cz+oz + uAz*halfU - vAz*halfV + nz*vsHalf],
        [cx+ox + uAx*halfU + vAx*halfV + nx*vsHalf, cy+oy + uAy*halfU + vAy*halfV + ny*vsHalf, cz+oz + uAz*halfU + vAz*halfV + nz*vsHalf],
        [cx+ox - uAx*halfU + vAx*halfV + nx*vsHalf, cy+oy - uAy*halfU + vAy*halfV + ny*vsHalf, cz+oz - uAz*halfU + vAz*halfV + nz*vsHalf],
      ];
      for (var k = 0; k < 4; k++) {
        positions.push(verts[k][0], verts[k][1], verts[k][2]);
        normals.push(nx, ny, nz);
      }
    }
  }

  return _makeGeo(positions, normals);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Surface-cubes path — wider AABB per voxel (better MC-like result)
// ═══════════════════════════════════════════════════════════════════════════

function _surfaceCubes(voxels, vs) {
  var keySet = new Set();
  for (var i = 0; i < voxels.length; i++) {
    keySet.add(voxels[i].x + ',' + voxels[i].y + ',' + voxels[i].z);
  }

  var positions = [];
  var normals = [];
  var half = vs * 0.5;

  for (var vi = 0; vi < voxels.length; vi++) {
    var v = voxels[vi];
    var cx = v.x * vs, cy = v.y * vs, cz = v.z * vs;
    var hx = v.scale[0] * half, hy = v.scale[1] * half, hz = v.scale[2] * half;

    // Build 3D cell corners (+-x, +-y, +-z)
    var corners = [
      [cx-hx, cy-hy, cz-hz], [cx+hx, cy-hy, cz-hz],
      [cx-hx, cy+hy, cz-hz], [cx+hx, cy+hy, cz-hz],
      [cx-hx, cy-hy, cz+hz], [cx+hx, cy-hy, cz+hz],
      [cx-hx, cy+hy, cz+hz], [cx+hx, cy+hy, cz+hz],
    ];

    // Check each of the 12 edges — if the neighbour in that direction is
    // empty, emit a quad perpendicular to the edge normal.
    var edgeChecks = [
      { a:1,  b:3,  n:[1,  0,  0], o:[+hx, 0, 0] },
      { a:0,  b:2,  n:[-1, 0,  0], o:[-hx, 0, 0] },
      { a:2,  b:3,  n:[0,  1,  0], o:[0, +hy, 0] },
      { a:0,  b:1,  n:[0, -1,  0], o:[0, -hy, 0] },
      { a:4,  b:5,  n:[0,  0,  1], o:[0, 0, +hz] },
      { a:0,  b:4,  n:[0,  0, -1], o:[0, 0, -hz] },
      { a:0,  b:6,  n:[-1, 0,  0], o:[-hx, 0, 0] },
      { a:1,  b:5,  n:[1,  0,  0], o:[+hx, 0, 0] },
      { a:2,  b:6,  n:[0,  1,  0], o:[0, +hy, 0] },
      { a:3,  b:7,  n:[0,  1,  0], o:[0, +hy, 0] },
      { a:4,  b:6,  n:[0,  0,  1], o:[0, 0, +hz] },
      { a:5,  b:7,  n:[0,  0,  1], o:[0, 0, +hz] },
    ];

    // Simpler — just build 6 cube faces with correct world-space offsets.
    // Based on _simpleCubes from mesh-exporter but scale-aware.
    var faceData = [
      { n:[1,0,0],   next:[+1, 0, 0],  dir1:[0,0,-vs],  dir2:[0,vs,0] },
      { n:[-1,0,0],  next:[-1,0,0],   dir1:[0,0,+vs],  dir2:[0,vs,0] },
      { n:[0,1,0],   next:[0,+1,0],   dir1:[vs,0,0],   dir2:[0,0,vs] },
      { n:[0,-1,0],  next:[0,-1,0],   dir1:[vs,0,0],   dir2:[0,0,-vs] },
      { n:[0,0,1],   next:[0,0,+1],   dir1:[-vs,vs,0], dir2:[0,0,0] },
      { n:[0,0,-1],  next:[0,0,-1],   dir1:[+vs,vs,0], dir2:[0,0,0] },
    ];

    for (var fi = 0; fi < 6; fi++) {
      var fd = faceData[fi];
      var nbKey = (v.x + fd.next[0]) + ',' + (v.y + fd.next[1]) + ',' + (v.z + fd.next[2]);
      if (keySet.has(nbKey)) continue;

      var nx2 = fd.n[0], ny2 = fd.n[1], nz2 = fd.n[2];
      var ox = v.x * vs, oy = v.y * vs, oz = v.z * vs; // corner offset

      // Build quad parallel to face normal; dimensions use voxel scale
      var u1 = fd.dir1[0] * 0.5, u2 = fd.dir1[1] * 0.5, u3 = fd.dir1[2] * 0.5;
      var v1 = fd.dir2[0] * 0.5, v2 = fd.dir2[1] * 0.5, v3 = fd.dir2[2] * 0.5;

      // Skip zero-length-face guards
      if (Math.abs(u1) < 1e-9 && Math.abs(u2) < 1e-9 && Math.abs(u3) < 1e-9) continue;
      if (Math.abs(v1) < 1e-9 && Math.abs(v2) < 1e-9 && Math.abs(v3) < 1e-9) continue;

      var verts = [
        [ox + nx2*half - u1 - v1, oy + ny2*half - u2 - v2, oz + nz2*half - u3 - v3],
        [ox + nx2*half + u1 - v1, oy + ny2*half + u2 - v2, oz + nz2*half + u3 - v3],
        [ox + nx2*half + u1 + v1, oy + ny2*half + u2 + v2, oz + nz2*half + u3 + v3],
        [ox + nx2*half - u1 + v1, oy + ny2*half - u2 + v2, oz + nz2*half - u3 + v3],
      ];
      for (var k = 0; k < 4; k++) {
        positions.push(verts[k][0], verts[k][1], verts[k][2]);
        normals.push(nx2, ny2, nz2);
      }
    }
  }

  return _makeGeo(positions, normals);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Geometry builder — returns real THREE.BufferGeometry when THREE is available
// ═══════════════════════════════════════════════════════════════════════════

function _makeGeo(positions, normals) {
  var T = (typeof globalThis !== 'undefined' && globalThis.THREE) || {};
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
