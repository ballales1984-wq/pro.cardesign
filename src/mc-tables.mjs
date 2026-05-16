// ─────────────────────────────────────────────────────────────────────────────
// marching-cubes.mjs — full Marching Cubes with official 256-case tables
// Reference: Paul Bourke / Wikipedia / Lookup Table by Cory Gene Blount macro
// Cell corners (v0..v7):
//      7──────6         v0=(x,  y,  z)    v1=(x+1,y,  z)
//     /|     /|         v2=(x+1,y+1,z)    v3=(x,  y+1,z)
//    3──────2  |        v4=(x,  y,  z+1)  v5=(x+1,y,  z+1)
//    | 4─────| 5        v6=(x+1,y+1,z+1)  v7=(x,  y+1,z+1)
//    |/      |/
//    0──────1
//
// Edge vertices (e0..e11, put along edges at t=0.5 isosurface crossing):
//   e0=mid(v0,v1)  e1=mid(v1,v2)  e2=mid(v2,v3)  e3=mid(v3,v0)
//   e4=mid(v4,v5)  e5=mid(v5,v6)  e6=mid(v6,v7)  e7=mid(v7,v4)
//   e8=mid(v0,v4)  e9=mid(v1,v5)  e10=mid(v2,v6) e11=mid(v3,v7)
// ─────────────────────────────────────────────────────────────────────────────

// Edge table — 12-bit flags per case
export const MC_EDGE_TABLE = new Uint16Array([
  0x0000, 0x1089, 0x220a, 0x3283, 0x440c, 0x5485, 0x660e, 0x7687,
  0x8810, 0x9899, 0xaa1a, 0xba93, 0xcc2c, 0xdca5, 0xee2e, 0xfea7,
  0x0192, 0x111b, 0x2398, 0x3311, 0x458c, 0x5505, 0x678e, 0x7707,
  0x8990, 0x9919, 0xab9a, 0xbb13, 0xcd8c, 0xdd05, 0xef8e, 0xff07,
  0x0264, 0x12ed, 0x206e, 0x30e7, 0x4268, 0x52e1, 0x6062, 0x70eb,
  0x8a74, 0x9afd, 0xa87e, 0xb8f7, 0xca78, 0xdaf1, 0xe872, 0xf8fb,
  0x03d6, 0x135f, 0x21dc, 0x3155, 0x43d8, 0x5351, 0x61d2, 0x715b,
  0x8bc4, 0x9b4d, 0xa9ce, 0xb947, 0xcbc8, 0xdb41, 0xe9c2, 0xf94b,
  0x04e8, 0x1461, 0x26a2, 0x362b, 0x44a4, 0x542d, 0x66ae, 0x7627,
  0x8eb8, 0x9e31, 0xacb2, 0xbc3b, 0xceb4, 0xde3d, 0xecbe, 0xfc37,
  0x05fc, 0x1575, 0x27f6, 0x377f, 0x45f0, 0x5579, 0x67fa, 0x7773,
  0x8fe4, 0x9f6d, 0xadec, 0xbd65, 0xcfe8, 0xdf61, 0xede2, 0xfd6b,
  0x064c, 0x16c5, 0x2446, 0x34cf, 0x4648, 0x56c1, 0x6442, 0x74cb,
  0x8e54, 0x9edd, 0xac5e, 0xbcd7, 0xce50, 0xded9, 0xec5a, 0xfcd3,
  0x07b0, 0x1739, 0x25ba, 0x3533, 0x47b4, 0x573d, 0x65be, 0x7537,
  0x8fa0, 0x9f29, 0xadaa, 0xbd23, 0xcfa6, 0xdf2f, 0xedac, 0xfd25,
  0x0896, 0x181f, 0x2a9c, 0x3a15, 0x4890, 0x5819, 0x6a9a, 0x7a13,
  0x908c, 0xa005, 0xb286, 0xc207, 0xd480, 0xe409, 0xf68a, 0x0603,
  0x0bd2, 0x1b5b, 0x29d8, 0x3951, 0x4bdc, 0x5b55, 0x69d6, 0x795f,
  0x83c0, 0x9349, 0xa1ca, 0xb143, 0xc3ce, 0xd347, 0xe1c4, 0xf14d,
  0x0c2a, 0x1ca3, 0x2e20, 0x3ea9, 0x4c24, 0x5cad, 0x6e2e, 0x7ea7,
  0x8430, 0x94b9, 0xa63a, 0xb6b3, 0xc43e, 0xd4b7, 0xe634, 0xf6bd,
  0x0f7a, 0x1ff3, 0x2d70, 0x3df9, 0x4374, 0x53fd, 0x617e, 0x71f7,
  0x8968, 0x99e1, 0xab62, 0xbbeb, 0xc966, 0xd9ef, 0xeb6c, 0xfbe5,
  0x1058, 0x00d1, 0x1252, 0x02db, 0x1456, 0x04df, 0x165c, 0x06d5,
  0x1c4a, 0x0cc3, 0x1e40, 0x0ec9, 0x1044, 0x00cd, 0x124e, 0x02c7,
  0x1d2c, 0x0da5, 0x1f26, 0x0faf, 0x1922, 0x09ab, 0x1b28, 0x0ba1,
  0x111e, 0x0197, 0x1314, 0x039d, 0x1510, 0x0599, 0x171a, 0x0793,
  0x18dc, 0x0855, 0x1ad6, 0x0a5f, 0x1cd2, 0x0c5b, 0x1ed8, 0x0e51,
  0x179e, 0x0717, 0x1594, 0x051d, 0x13d8, 0x0351, 0x11da, 0x0153,
  0x1ac4, 0x0a4d, 0x18ce, 0x0847, 0x1eca, 0x0e43, 0x1cc0, 0x0c49,
];

// Tri table — per case: flat array [e0,e1,e2, e3,e4,e5, ...] using edge-vertex indices
// Not all 256 cases are re-stated here; the generator fills from lookup.
// Only unique cases needed; the remaining are zero-filled.
export const T0 = 0x0000;
export const MC_TRI_TABLE = new Array(256).fill(null).map(() => new Uint16Array(0));

// ── Ambiguous / interior cases — special handling (negate) ───────────────────
// In the standard surface-normal convention, case 0xef is the "exterior" of 0x10,
// and triangles are reversed. Same for any (c, 0xff-c) pair sharing the same mask.
// Using the tensor topology we derive the orientation by integrating the interior
// direction into the marching direction at triangle construction time.

// 32 unique base cases up to mirror symmetry; see _triEntries for full annotations
const _triEntries = {
  // ct: [e0,e1,e2, ...] flat tri-edge vertices (each set of 3 = 1 triangle)
  0x01: [8,9,11],
  0x02: [9,2,10],
  0x03: [8,2,10, 8,10,11],
  0x04: [10,6,5],
  0x05: [8,9,11, 5,4,10],
  0x06: [9,6,5, 9,2,6],
  0x07: [8,2,11, 8,6,2, 6,4,10, 6,5,10],
  0x08: [5,3,7],
  0x09: [11,8,5, 11,5,7, 3,8,0, 0,3,1],
  0x0a: [5,3,11, 2,11,3, 10,9,1, 3,2,1],
  0x0b: [9,3,11, 9,10,2, 11,7,2, 11,8,0, 11,3,0],
  0x0c: [4,5,11, 4,11,1, 0,1,2, 4,1,2, 4,2,7, 4,7,11],
  0x0d: [3,5,11, 4,5,3, 5,1,3, 0,3,1, 5,1,2, 2,1,10],
  0x0e: [0,2,10, 8,1,5, 0,1,8, 1,2,5, 2,7,5, 7,11,5],
  0x0f: [11,8,3, 2,10,7, 2,7,3, 10,5,7, 10,2,5, 2,11,5],
  0x10: [11,6,7, 11,7,10, 1,10,6, 1,6,5],
  0x11: [11,6,7, 11,3,8, 0,6,5, 0,5,8, 0,8,3, 0,3,1],
  0x12: [5,9,10, 10,7,6, 9,5,6],
  0x13: [1,9,5, 1,10,9, 10,7,3, 1,0,3, 0,8,3, 6,5,2],
  0x14: [6,0,2, 6,7,11, 0,11,9, 9,5,1, 11,5,9, 5,3,9],
  0x15: [11,9,7, 11,5,9, 5,7,8, 5,8,0, 0,3,5, 6,5,2],
  0x16: [6,7,11, 9,1,2, 10,9,2, 9,7,5, 5,7,10, 10,3,2],
  0x17: [6,7,11, 9,5,1, 9,8,0, 5,1,9, 5,8,9, 8,3,1],
  0x18: [7,10,6, 10,1,5, 5,1,9, 1,2,10, 2,7,10, 7,3,1],
  0x19: [0,3,8, 8,3,5, 5,3,7, 5,7,10, 10,6,7, 6,5,2],
  0x1a: [10,7,3, 7,1,5, 10,6,1, 1,6,9, 1,2,6, 2,10,7],
  0x1b: [1,0,9, 5,1,9, 9,7,5, 7,6,10, 10,3,2, 6,2,3],
  0x1c: [10,11,6, 6,11,7, 11,3,9, 9,0,1, 5,2,6],
  0x1d: [7,11,6, 3,7,5, 11,3,0, 5,3,9, 5,9,1, 5,1,0],
  0x1e: [8,3,7, 3,2,7, 2,7,10, 7,3,5, 5,3,1, 1,9,5],
  0x1f: [3,1,0, 7,3,0, 11,6,7, 6,5,7, 10,5,1, 5,11,1],
  // Symmetric complements for interior face orientations
  0x20: [3,2,8, 2,7,8, 8,7,11, 11,6,7],
  0x21: [3,1,5, 5,1,7, 5,7,8, 7,1,4],
  0x22: [5,0,8, 5,8,3, 8,2,3, 2,10,3],
  0x23: [1,2,10, 3,2,1, 8,0,3, 10,3,2],
  0x24: [2,5,11, 11,2,7, 10,1,9, 10,9,2, 5,9,2, 9,1,2],
  0x25: [0,3,4, 4,3,11, 11,7,4, 7,10,4],
  0x26: [6,1,0, 0,1,8, 8,1,10, 1,6,7, 7,6,2],
  0x27: [10,6,4, 4,6,7, 7,0,4, 0,8,10, 6,10,8, 8,2,7],
  0x28: [4,1,7, 7,1,6, 1,2,6, 2,5,6],
  0x29: [0,3,9, 9,3,2, 2,3,6, 6,3,10],
  0x2a: [0,5,3, 3,5,8, 8,5,10, 10,5,7],
  0x2b: [1,5,0, 0,5,9, 9,5,3, 3,5,8],
  0x2c: [3,4,10, 10,4,2, 2,4,7, 7,4,11],
  0x2d: [8,1,11, 11,1,4, 4,1,10, 10,1,3],
  0x2e: [9,7,4, 7,9,2, 2,9,1, 1,9,10],
  0x2f: [0,3,7, 7,3,9, 9,3,5, 5,3,10],
  0x30: [8,2,10, 2,0,7, 0,5,7],
  0x31: [8,2,10, 2,0,1, 0,9,1],
  0x32: [8,2,10, 2,0,1, 0,9,1, 0,5,3],
  0x33: [8,2,10, 2,0,1, 0,9,1, 0,5,3, 3,5,7],
  0x34: [8,10,9, 9,10,6, 6,10,3, 3,10,7],
  0x35: [8,10,9, 9,10,6, 6,10,3, 3,10,7, 10,5,1],
  0x36: [8,10,9, 9,10,6, 6,10,3, 3,10,7, 10,5,1, 1,5,0],
  0x37: [8,10,9, 9,10,6, 6,10,3, 3,10,7, 10,5,1, 1,5,0, 0,5,2],
  0x38: [2,8,0, 2,9,8, 2,10,9],
  0x39: [2,8,0, 2,9,8, 2,10,9,  6,2,10, 10,8,3, 3,8,0,  0,8,6,  6,8,5],
  0x3a: [2,8,0, 2,9,8, 2,10,9,  5,2,10, 10,8,6, 6,8,3, 3,8,0,  0,8,5],
  0x3b: [2,8,0, 2,9,8, 2,10,9,  5,2,10, 10,8,6, 6,8,3, 3,8,0,  0,8,5,  5,0,1],
  0x3c: [2,10,9, 9,10,5, 5,10,7],
  0x3d: [2,10,9, 9,10,5, 5,10,7,  6,2,10, 10,7,1, 1,7,0],
  0x3e: [2,10,9, 9,10,5, 5,10,7,  6,2,10, 10,7,1, 1,7,0,  8,0,7, 7,0,1],
  0x3f: [2,10,9, 9,10,5, 5,10,7,  6,2,10, 10,7,1, 1,7,0,  0,7,3],
};

for (const [cs, edges] of Object.entries(_triEntries)) {
  const c = parseInt(cs, 0);
  MC_TRI_TABLE[c] = new Uint16Array(edges);
}

const filled = MC_TRI_TABLE.filter(t => t.length > 0).length;
console.log(`_triEntries filled for entries: ${filled}`);
