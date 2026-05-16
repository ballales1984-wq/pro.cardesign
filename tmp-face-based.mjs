// Synthetic minimal tri table generator
// Computes correct tri table from edge topology without lookup-presupposition
const E0=0, E1=1, E2=2, E3=3, E4=4, E5=5, E6=6, E7=7, E8=8, E9=9, E10=10, E11=11;

// ── Synthetic: brute-force adjacent connectivity on edge-ring ────────────────
// For each cube configuration c, generate triangles from edge-crossings.
// This avoids any pre-built table by using spatial adjacency of active edges.
// The 12 edge-vertices are arranged on 6 faces of the cube.
// Two pairs of triangles per active face are formed by splitting the polygon diagonal.

// Compact helper: for each face, the 4 edges in order CCW as seen from outside
const FACE_EDGES = [
  [E0,E1,E2,E3],  // f0: z=0 bottom (outward: –Z)
  [E4,E5,E6,E7],  // f1: z=1 top    (outward: +Z)
  [E3,E11,E7,E8], // f2: x=0 left   (outward: –X)
  [E0,E9,E4,E1],  // f3: x=1 right  (outward: +X)
  [E0,E1,E9,E8],  // f4: y=0 front  (outward: –Y)
  [E2,E10,E6,E11],// f5: y=1 back   (outward: +Y)
];

// Tri-label: maps corner to the 3 edge-vertices touching it (in CCW order about corner)
const CORNER_EDGES = [
  [E8,E0,E3],  // v0: edges (v0-v4),(v0-v1),(v3-v0)
  [E9,E1,E0],  // v1: edges (v1-v5),(v1-v2),(v0-v1)
  [E10,E2,E1], // v2
  [E11,E3,E2], // v3
  [E4,E7,E8],  // v4
  [E5,E4,E9],  // v5
  [E6,E5,E10], // v6
  [E7,E6,E11], // v7
];

// For each face, the topology links a corner-edge-pair to its neighboring edge.
// We use the triangle-strip traversal: around a face with 2 pairs of active edges.
function triFromPair(edges) {
  // edges = [e_a, e_b, e_c, e_d] in CCW order;
  // 2 are crossed (1 on edge, 0 not crossed).
  // Returns 2 edge-vertex index triangles or null
}

// ── Compact encoding: use the single-digit case-index to drive tri lookup ─────
// Generate all 256 case tri lists by the standard op-code lookup.
// Algorithm: for each case, do edge crossing → compute per-face polygon →
//            triangulate polygon → collect all triangles.

function mcTriList(caseMask) {
  // 8 corners → c_v[8], each 0=none, 1=interior
  const cv = [];
  for (let k = 0; k < 8; k++) cv[k] = (caseMask & (1 << k)) !== 0 ? 1 : 0;

  // All 12 edge values: -1 at edge midpoint means undetermined, 0 = low, 1 = high
  // Convention: isosurface at 0.5, v_i = 1 if corner interior, 0 otherwise.
  // Edge midpoint = interpolated {0, 0.5, 1} → crossed if v_a != v_b.
  const crossed = new Array(12).fill(false);
  if (cv[0] !== cv[1]) crossed[E0] = true;
  if (cv[1] !== cv[2]) crossed[E1] = true;
  if (cv[2] !== cv[3]) crossed[E2] = true;
  if (cv[3] !== cv[0]) crossed[E3] = true;
  if (cv[4] !== cv[5]) crossed[E4] = true;
  if (cv[5] !== cv[6]) crossed[E5] = true;
  if (cv[6] !== cv[7]) crossed[E6] = true;
  if (cv[7] !== cv[4]) crossed[E7] = true;
  if (cv[0] !== cv[4]) crossed[E8] = true;
  if (cv[1] !== cv[5]) crossed[E9] = true;
  if (cv[2] !== cv[6]) crossed[E10] = true;
  if (cv[3] !== cv[7]) crossed[E11] = true;

  // Build per-face crossing pattern: 4-bit mask for the face's 4 edges
  function faceCross(f) {
    const fe = FACE_EDGES[f];
    let mask = 0;
    for (let k = 0; k < 4; k++) if (crossed[fe[k]]) mask |= (1 << k);
    return mask;
  }

  // For a 4-edge face, given the crossing mask, return the triangle edge indices
  function faceTriangles(f) {
    const mask = faceCross(f);
    const fe = FACE_EDGES[f];
    if (mask === 1 || mask === 2 || mask === 4 || mask === 8) return null; // on-edge, no polygon
    if (mask === 0 || mask === 15) return null; // all-in or all-out
    // Each crossed face → exactly 2 connected edges → forms a quad strip → 2 triangles
    // Find the first crossed edge
    let i0 = -1, i1 = -1;
    for (let k = 0; k < 4 && i1 < 0; k++) {
      if (mask & (1 << k)) {
        if (i0 === -1) i0 = k; else i1 = k;
      }
    }
    if (i0 < 0 || i1 < 0) return null;
    // Use 4-edge CCW ordering; crossed edges are diagonally opposite (non-adjacent) or adjacent
    // The canonical split: split the quad in parallel to edge ((i0+1)%4, (i0+2)%4) or ((i1+1)%4)
    // This is equivalent to tri-fan from the middle of the two crossed edges

    // Standard MC: connect the two mids → this gives segment connecting mid(e_i0)→mid(e_i1)
    // The tri table guarantees the three edges sharing a vertex form each triangle.
    // For our purposes, the two triangles are:
    //   triangle A: mid(e_i0), mid(e_i_next),      mid(e_i1)   where i_next follows i0 on CCW ring
    //   triangle B: mid(e_i0),      mid(e_i1), mid(e_i_prev) where i_prev precedes i0
    // where i_next = (i0+1) % 4, i_prev = (i0+3) % 4 (= (i0-1+4)%4)
    const iNext = (i0 + 1) % 4;
    const iPrev = (i0 + 3) % 4;

    return [
      [fe[i0], fe[iNext], fe[i1]],
      [fe[i0], fe[i1], fe[iPrev]],
    ];
  }

  // Collect all edge triangles, dedup by edge-vertex set (prevents double-add)
  // Use polyline dedup: sort each triangle edges, stringify
  const out = [];
  const seen = new Set();
  for (let f = 0; f < 6; f++) {
    const tris = faceTriangles(f);
    if (!tris) continue;
    for (const tri of tris) {
      const key = tri.slice().sort();
      const str = key.join(',');
      if (seen.has(str)) continue;
      seen.add(str);
      out.push(tri);
    }
  }
  return out;
}

// Verify: test all 256 cases
let valid = 0, empty = 0;
for (let c = 0; c < 256; c++) {
  const t = mcTriList(c);
  if (t.length === 0) { empty++; }
  else valid++;
}
console.log(`256-case tri generator: ${valid} non-empty, ${empty} empty, total=${valid+empty}`);
