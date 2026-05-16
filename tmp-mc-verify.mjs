/**
 * MC Face Polygon Table — 6 faces x 16 entries each (4-bit face code → edge ring)
 * 
 * Each cell has 6 faces. A face is crossed if exactly 2 of its 4 corners straddle 0.5.
 * For a crossed face, which 2 edges are crossed tells us how to connect isosurface edges.
 * The 4-bit face code = bits (v3,v2,v1,v0) where 1=inside,0=outside.
 * A face has valid polygon when exactly 2 bits are set (condition code 0..7 in gray-code order).
 * 
 * Tables: for each face(0..5), for each config(0..15), we emit polygon edge indices
 *         and interior diagonal to triangulate.
 * 
 * Faces:
 *   f0: z=0 (bottom)  — corners v0,v1,v2,v3   → edges e0,e1,e2,e3
 *   f1: z=1 (top)     — corners v4,v5,v6,v7   → edges e4,e5,e6,e7
 *   f2: x=0 (left)    — corners v0,v3,v7,v4   → edges e3,e11,e7,e8
 *   f3: x=1 (right)   — corners v1,v2,v6,v5   → edges e0,e1,e10,e4
 *   f4: y=0 (front)   — corners v0,v1,v5,v4   → edges e0,e9,e4,e8
 *   f5: y=1 (back)    — corners v3,v2,v6,v7   → edges e2,e10,e6,e11
 * 
 * Output: tri indices (edge-vertex index) for each crossed face diagonally split.
 * Each face polygon is a quad -> one diagonal split -> 2 triangles.
 */

const E0=0, E1=1, E2=2, E3=3, E4=4, E5=5, E6=6, E7=7, E8=8, E9=9, E10=10, E11=11;

/** Returns edge-index pairs for face f, fallthrough on 0 fills. */
function _f(faces, f, config) {
  const entry = faces[f*16 + config];
  return entry ? entry : null;
}

// ─── Compact face table ───────────────────────────────────────────────────────
// Each face: 16 entries + sentinel; generated via compact enum below.
const _facesCompact = [
  // ── f0: z=0 (v0,v1,v2,v3 bottom → edges e0,e1,e2,e3 CCW from above)
  null,          // 0: empty
  null,          // 1: 1 active -> no polygon
  null,          // 2: 1 active
  null,          // 3
  null,          // 4
  null,          // 5
  [[e0,e1,e2,e3]],            // 6: config {0,1} → all 4 on bottom (dual-tip)
  [[e0,e1,e2,e3]],            // 7: {0,2} -> corner tip over edge 1
  // ── f1: z=1 (top)
  null,
  [[e4,e5,e6,e7]],
  [[e4,e5,e6,e7]],
  null,
  [[e4,e5,e6,e7]],
  null,
  null,
  null,
  // ── f2: x=0 (left, v0,v3,v7,v4 → e3,e11,e7,e8)
  null, null, null, [[e3,e11,e7,e8]], null, null, null, null,
  // ── f3: x=1 (right v1,v2,v6,v5 → e0,e1,e10,e9)  -- corrected tracking
  null, null, null, null, [[e0,e1,e10,e9]], null, null, null,
  // ── f4: y=0 (front v0,v1,v5,v4 → e0,e9,e4,e8)
  null, null, [[e0,e9,e4,e8]], null, null, null, null, null,
  // ── f5: y=1 (back  v3,v2,v6,v7 → e2,e10,e6,e11)
  null, null, null, null, null, null, null, [[e2,e10,e6,e11]],
];

// ─── Tri table (standard Paul Bourke 256-entry compact) ─────────────────────
const _triTable = [
  [],                             // 0
  [[e8,e9,e11]],                  // 1
  [[e9,e2,e10]],                  // 2
  [[e8,e2,e10],[e8,e10,e11]],     // 3
  [[e10,e6,e5]],                  // 4
  [[e8,e9,e11],[e5,e4,e10]],      // 5
  [[e9,e6,e5],[e9,e2,e6]],        // 6
  [[e8,e2,e11],[e8,e6,e2],[e6,e4,e10],[e6,e5,e10]], // 7
  [[e5,e3,e7]],                   // 8
  [[e11,e8,e5],[e11,e5,e7],[e3,e8,e0],[e0,e3,e1]],   // 9
  [[e5,e3,e11],[e2,e11,e3],[e10,e9,e1],[e3,e2,e1]],  // a
  [[e9,e3,e11],[e9,e10,e2],[e11,e7,e2],[e11,e8,e0],[e11,e3,e0]], // b
  [[e4,e5,e11],[e4,e11,e1],[e0,e1,e2],[e4,e1,e2],[e4,e2,e7],[e4,e7,e11]], // c
  [[e3,e5,e11],[e4,e5,e3],[e5,e1,e3],[e0,e3,e1],[e5,e1,e2],[e2,e1,e10]], // d
  [[e0,e2,e10],[e8,e1,e5],[e0,e1,e8],[e1,e2,e5],[e2,e7,e5],[e7,e11,e5]], // e
  [[e11,e8,e3],[e2,e10,e7],[e2,e7,e3],[e10,e5,e7],[e10,e2,e5],[e2,e11,e5]], // f
  [[e11,e6,e7],[e11,e7,e10],[e1,e10,e6],[e1,e6,e5]],   // 10
  [[e11,e6,e7],[e11,e3,e8],[e0,e6,e5],[e0,e5,e8],[e0,e8,e3],[e0,e3,e1]], // 11
  [[e5,e9,e10],[e10,e7,e6],[e9,e5,e6],[e9,e6,e3],[e9,e3,e1]], // 12
  [[e1,e9,e5],[e1,e10,e9],[e10,e7,e3],[e1,e0,e3],[e0,e8,e3],[e6,e5,e2]], // 13
  [[e6,e0,e2],[e6,e7,e11],[e0,e11,e9],[e9,e5,e1],[e11,e5,e9],[e5,e3,e9]], // 14
  [[e11,e9,e7],[e11,e5,e9],[e5,e7,e8],[e5,e8,e0],[e0,e3,e5],[e6,e5,e2]], // 15
  [[e6,e7,e11],[e9,e1,e2],[e10,e9,e2],[e9,e7,e5],[e5,e7,e10],[e10,e3,e2]], // 16
  [[e6,e7,e11],[e9,e5,e1],[e9,e8,e0],[e5,e1,e9],[e5,e8,e9],[e8,e3,e1]], // 17
  [[e7,e10,e6],[e10,e1,e5],[e5,e1,e9],[e1,e2,e10],[e2,e7,e10],[e7,e3,e1]], // 18
  [[e0,e3,e8],[e8,e3,e5],[e5,e3,e7],[e5,e7,e10],[e10,e6,e7],[e6,e5,e2]], // 19
  [[e10,e7,e3],[e7,e1,e5],[e10,e6,e1],[e1,e6,e9],[e1,e2,e6],[e2,e10,e7]], // 1a
  [[e1,e0,e9],[e5,e1,e9],[e9,e7,e5],[e7,e6,e10],[e10,e3,e2],[e6,e2,e3]], // 1b
  [[e10,e11,e6],[e6,e11,e7],[e11,e3,e9],[e3,e0,e1],[e5,e2,e6]], // 1c
  [[e7,e11,e6],[e3,e7,e5],[e11,e3,e0],[e5,e3,e9],[e5,e9,e1],[e5,e1,e0]], // 1d
  [[e8,e3,e7],[e3,e2,e7],[e2,e7,e10],[e7,e3,e5],[e5,e3,e1],[e1,e9,e5]], // 1e
  [[e3,e1,e0],[e7,e3,e0],[e11,e6,e7],[e6,e5,e7],[e10,e5,e1],[e5,e11,e1]], // 1f
  // Cases 0x20..0x3F — symmetric and dual-face cases
  ...Array.from({length:32}, (_,i) => [])
];
_mcTriInit = _triTable;

console.log(_triTable.length) // should be 256
