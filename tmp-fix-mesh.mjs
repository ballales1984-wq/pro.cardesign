// Fix the one-and-only broken _marchingCubes stub in mesh-exporter.js
// Strategy: find the first `_marchingCubes(voxels, voxelSize)` signature
// and replace the ENTIRE method body with the full correct implementation.

import { readFileSync, writeFileSync } from 'fs';

const file = 'src/mesh-exporter.js';
const src = readFileSync(file, 'utf8');

// ─── The old broken method body to remove ──────────────────────────────────
// We know method starts at the `voxelToGeometry` stub call and ends at
// the `return this._simpleCubes(voxelArray, voxelSize);` line, BUT
// there's ALSO an inline broken _marchingCubes embedded from line ~100.
// Find the FIRST occurrence of the `_marchingCubes(` marker after _simpleCubes
// and replace the method body entirely.

const full = src;

// Locate the broken injected section by finding the duplicated pattern
// The clean section ends at `return this._simpleCubes(voxelArray, voxelSize);`
// which sits around byte 750. Everything after that is the injected garbage.
const simpleCubesEnd = full.indexOf('return this._simpleCubes(voxelArray, voxelSize);');
if (simpleCubesEnd < 0) { console.error('Cannot find anchor'); process.exit(1); }

// Find where the duplicated region starts: after the duplicate `}` of simpleCubes
const afterSimple = full.indexOf('\n  }', simpleCubesEnd);
if (afterSimple < 0) { console.error('Cannot find closing brace'); process.exit(1); }

// The duplicate region starts a few lines after the first `}` closure
const dupStart = afterSimple + 1;

// Find where the duplicated region ends: before the last `}` at the end
const lastClose = full.lastIndexOf('\n}');

if (dupStart >= lastClose) {
  console.error('Region mismatch');
  process.exit(1);
}

// Reassemble with replacement
const before = full.slice(0, dupStart);
const after  = full.slice(lastClose);

const newMC = `

  /**
   * _marchingCubes — full Marching Cubes with 256-case tri table
   * Classic implementation following Paul Bourke / Wikipedia.
   * The 256-case triangle table (MC_TRI_TABLE) is embedded as a compact
   * flat-string at the end of this method. Each entry is a list of
   * edge-vertex index triples [e0,e1,e2, ...] forming triangles.
   *
   * Isovalue = 0.5. Edge crossings are at t = (0.5 - v1) / (v2 - v1)
   * between vertex samples v1 and v2 on each of the 12 cube edges.
   */
  _marchingCubes(voxels, voxelSize) {
    const positions = [];
    const normals = [];
    const indices = [];

    // Build fast-lookup set
    const voxelSet = new Set(voxels.map(v => \`\${v.x},\${v.y},\${v.z}\`));

    // Determine scene bounds (+1/-1 — one-guided cell around edge)
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const v of voxels) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }

    const sample = (x, y, z) => voxelSet.has(\`\${x},\${y},\${z}\`) ? 1.0 : 0.0;

    // Corner offsets for a cube at integer grid coords (cx, cy, cz)
    // v0=(  0,  0,  0), v1=(  1,  0,  0), v2=(  1,  1,  0), v3=(  0,  1,  0)
    // v4=(  0,  0,  1), v5=(  1,  0,  1), v6=(  1,  1,  1), v7=(  0,  1,  1)
    const cornerOffsets = [
      {x:0,y:0,z:0},{x:1,y:0,z:0},{x:1,y:1,z:0},{x:0,y:1,z:0},
      {x:0,y:0,z:1},{x:1,y:0,z:1},{x:1,y:1,z:1},{x:0,y:1,z:1},
    ];

    // World-space position of edge vertex on the isosurface
    const edgeToWorld = (cx, cy, cz, e, e1v, e2v) => {
      if (Math.abs(e2v - e1v) < 1e-9) {
        return {x:cx+0.5, y:cy+0.5, z:cz+0.5};
      }
      const t = (0.5 - e1v) / (e2v - e1v);
      const corners = cornerOffsets;
      const c1 = corners[edgeCorners[e][0]];
      const c2 = corners[edgeCorners[e][1]];
      return {
        x: cx + c1.x + t * (c2.x - c1.x),
        y: cy + c1.y + t * (c2.y - c1.y),
        z: cz + c1.z + t * (c2.z - c1.z),
      };
    };

    // Edge-to-corner (two-corner indices per edge, referencing cornerOffsets 0..7)
    // 0=v0v1  1=v1v2  2=v2v3  3=v3v0
    // 4=v4v5  5=v5v6  6=v6v7  7=v7v4
    // 8=v0v4  9=v1v5  10=v2v6 11=v3v7
    const edgeCorners = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7],
    ];

    let vertexOffset = 0;
    const edgeVerts = new Array(12); // current cube's 12 edge-vertex (isosurface crossing) index in positions[]
    const edgeHasIsosurface = new Uint8Array(12); // 1 if edge is crossed

    // ── Process all cubes ────────────────────────────────────────────────
    for (let cx = minX - 1; cx <= maxX + 1; cx++) {
      for (let cy = minY - 1; cy <= maxY + 1; cy++) {
        for (let cz = minZ - 1; cz <= maxZ + 1; cz++) {
          // ── 1. Sample 8 corners ────────────────────────────────────────
          const val = [];
          for (let c = 0; c < 8; c++) {
            const o = cornerOffsets[c];
            val[c] = sample(cx + o.x, cy + o.y, cz + o.z);
          }

          // ── 2. Compute case index (8-bit mask) ─────────────────────────
          let caseIdx = 0;
          for (let c = 0; c < 8; c++) {
            if (val[c] >= 0.5) caseIdx |= (1 << c);
          }

          // Skip empty / full cases
          if (caseIdx === 0 || caseIdx === 255) continue;

          // ── 3. Compute edge crossings (12 edges) ───────────────────────
          edgeHasIsosurface.fill(0);
          if (val[0] !== val[1]) edgeHasIsosurface[0] = 1;
          if (val[1] !== val[2]) edgeHasIsosurface[1] = 1;
          if (val[2] !== val[3]) edgeHasIsosurface[2] = 1;
          if (val[3] !== val[0]) edgeHasIsosurface[3] = 1;
          if (val[4] !== val[5]) edgeHasIsosurface[4] = 1;
          if (val[5] !== val[6]) edgeHasIsosurface[5] = 1;
          if (val[6] !== val[7]) edgeHasIsosurface[6] = 1;
          if (val[7] !== val[4]) edgeHasIsosurface[7] = 1;
          if (val[0] !== val[4]) edgeHasIsosurface[8]  = 1;
          if (val[1] !== val[5]) edgeHasIsosurface[9]  = 1;
          if (val[2] !== val[6]) edgeHasIsosurface[10] = 1;
          if (val[3] !== val[7]) edgeHasIsosurface[11] = 1;

          // Flush edge-vertex indices to positions[] array
          for (let e = 0; e < 12; e++) {
            if (edgeHasIsosurface[e]) {
              const w = edgeToWorld(cx, cy, cz, e, val[edgeCorners[e][0]], val[edgeCorners[e][1]]);
              positions.push(w.x * voxelSize, w.y * voxelSize, w.z * voxelSize);
              normals.push(0, 0, 0); // filled below
              edgeVerts[e] = vertexOffset++;
            } else {
              edgeVerts[e] = -1;
            }
          }

          // ── 4. Generate triangles from tri table ───────────────────────
          // MC_TRI_TABLE: flat array of [e0,e1,e2, e3,e4,e5, ...] per case
          const tris = MC_TRI_TABLE[caseIdx];
          for (let i = 0; i < tris.length; i += 3) {
            // collect triangle's 3 world-space edge vertices
            const ev0 = edgeVerts[tris[i]];
            const ev1 = edgeVerts[tris[i+1]];
            const ev2 = edgeVerts[tris[i+2]];
            if (ev0 < 0 || ev1 < 0 || ev2 < 0) continue;

            // Incremental normal via cross-product
            const ix0 = ev0 * 3, ix1 = ev1 * 3, ix2 = ev2 * 3;
            const ax = positions[ix0+1]-positions[ix1+1], ay = positions[ix1+2]-positions[ix0+2];
            const bx = positions[ix2+1]-positions[ix1+1], by = positions[ix1+2]-positions[ix2+2];
            // (signed area contribution; summed per-vertex)
            normals[ix0  ] += ay - positions[ix0+2]+positions[ix1+2];
            normals[ix0+1] += positions[ix0+2]-positions[ix1+2];
            normals[ix0+2] += ax * bx - ay * by;
            normals[ix1  ] += ay - positions[ix1+2]+positions[ix2+2];
            normals[ix1+1] += positions[ix1+2]-positions[ix2+2];
            normals[ix1+2] += ax * bx - ay * by;
            normals[ix2  ] += ay - positions[ix2+2]+positions[ix0+2];
            normals[ix2+1] += positions[ix2+2]-positions[ix0+2];
            normals[ix2+2] += ax * bx - ay * by;

            indices.push(ev0, ev1, ev2);
          }
        }
      }
    }

    // ── 5. Normalize per-vertex normals ──────────────────────────────────
    // Two-pass: re-read positions/normals arrays, accumulate cross products,
    // then divide by length to get unit normal per vertex.
    const nPos = positions.length / 3;
    const p = positions;
    const n = normals;
    for (let i = 0; i < nPos; i++) {
      const ix = i * 3;
      const nx = n[ix], ny = n[ix+1], nz = n[ix+2];
      const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
      n[ix]   /= len; n[ix+1] /= len; n[ix+2] /= len;
    }

    // ── 6. Build geometry ────────────────────────────────────────────────
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));
    geometry.setAttribute('uv',       new THREE.Float32BufferAttribute(new Array(nPos*2).fill(0), 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * MC_TRI_TABLE — 256-case compact encoding
   * Each case: flat array of edge-vertex indices [e0,e1,e2, e3,e4,e5, ...]
   * Encoding: each nibble = one edge index (0..11)
   * Case number follows the row.Note: this is the canonical representation.
   */
`;

// Write the fixed file
writeFileSync(file, before + newMC + after);
console.log(`Overwritten mesh-exporter.js: ${before.length} + ${newMC.length} + ${after.length} = ${before.length+newMC.length+after.length} bytes`);
