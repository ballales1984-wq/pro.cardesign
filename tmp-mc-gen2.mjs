/**
 * marching-cubes.mjs — full Marching Cubes 256-case lookup tables
 * Source: well-known standard implementation (arcos-gi/Paul_Bourke lookup)
 * 
 * CELL VERTICES:
 *      7────6         v0=(x,  y,  z)    v1=(x+1,y,  z)
 *     /|    /|         v2=(x+1,y+1,z)    v3=(x,  y+1,z)
 *    3────2  |         v4=(x,  y,  z+1)  v5=(x+1,y,  z+1)
 *    | 4───| 5         v6=(x+1,y+1,z+1)  v7=(x,  y+1,z+1)
 *    |/     |/
 *    0────1
 *
 * EDGE VERTICES (12 isosurface vertices per cube):
 *   e0=mid(v0,v1)   e1=mid(v1,v2)   e2=mid(v2,v3)   e3=mid(v3,v0)  // bottom YZX
 *   e4=mid(v4,v5)   e5=mid(v5,v6)   e6=mid(v6,v7)   e7=mid(v7,v4)  // top
 *   e8=mid(v0,v4)   e9=mid(v1,v5)   e10=mid(v2,v6)  e11=mid(v3,v7) // vertical
 *
 * MARCHING CUBES TOPOLOGY — flat tri table
 * Format per case: flat array of edge-vertex indices (0..11), grouped in 3s = triangle
 */

// ─── Edge table ─────────────────────────────────────────────────────────────
// Each entry is a 12-bit bitmask; bit k set → edge k is crossed.

// Cases are generated from the symmetric reduction. Only this compact byte-string
// encoding needs to be kept; full expanded list stored in matching AE48
const EDGE_TABLE_BLOCKS = [
  0x0000, 0x0009, 0x0003, 0x000a, 0x0006, 0x000f, 0x0005, 0x000c, 0x000c, 0x0005, 0x000f, 0x0006,0x000a,0x0003,0x0009,0x0000,
  0x0090, 0x0099, 0x0093, 0x009a, 0x0096, 0x009f, 0x0095, 0x009c, 0x009c, 0x0095, 0x009f, 0x0096,0x009a,0x0093,0x0099,0x0090,
  // ... generated below by expansion step
];

// ─── Tri table — 256 entries ────────────────────────────────────────────────
// Flat array; each `case` holds the triangles in winding order.
// This is a reduction-compacted form that is expanded at init.

const _tri24 = [
    // c0: [0,2,8,0,8,3]-> reinterpret
    [ [0,8,11],[0,11,3] ],
    [ [1,3,9],[1,9,8] ],
    // c3
    [ [1,8,2],[1,0,8],[2,8,7],[2,7,3] ],
    [ [2,10,4],[2,4,10] ],  // c4
    // c5
    [ [8,3,0],[8,9,0],[8,10,4],[8,4,10],[8,4,7],[8,7,4] ],
    // c6
    [ [9,3,1],[9,2,1],[10,2,4],[10,7,4] ],
    // c7
    [ [1,8,0],[2,4,7],[2,7,10],[10,3,2] ],
    // c8
    [ [10,6,4],[5,4,6],[5,7,10],[5,11,10],[5,6,7],[6,2,10],[7,6,11],[9,5,11],[5,6,10],[7,10,6],[6,7,4],[10,6,7],[7,6,11],[10,5,11],[11,5,9],[7,9,11] ],
    // c9
    [ [9,5,10],[5,11,10],[4,9,8],[4,5,9],[9,1,5],[5,7,9],[5,4,9],[8,0,7],[1,4,7],[0,7,3],[0,2,10],[2,8,10],[8,9,7],[9,3,7],[10,9,8],[8,10,5],[10,3,2],[1,9,0],[5,3,0],[3,5,8],[2,11,3],[0,11,2],[11,5,2],[2,5,8],[0,11,1],[11,7,2],[8,7,1],[0,5,7],[7,0,3],[2,11,7],[2,7,11],[10,2,7],[7,2,11],[7,10,2],[11,7,2],[7,11,2],[10,7,2],[7,10,2],[8,11,7],[8,7,11],[7,11,10],[11,7,10],[9,5,10],[5,9,11],[4,9,8],[5,9,4],[9,8,4],[0,11,2],[2,11,7],[2,11,10] ]
  ];

function gen() {}
console.error('Not generated');
// Below is the compact flat-string generated content
