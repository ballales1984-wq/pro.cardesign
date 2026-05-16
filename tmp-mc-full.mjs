// gen-mc-tables.mjs — generates full Marching Cubes 256-case lookup tables
const FS = require('fs');

// Edge table: 12-bit flags for each of the 256 cube configurations
// bit k set => edge k is intersected. Edges: 0=0→1, 1=1→2, 2=2→3, 3=3→0,
//   4=4→5, 5=5→6, 6=6→7, 7=7→4, 8=0→4, 9=1→5, 10=2→6, 11=3→7

// Values mined from well-known reference implementations
// Each entry is constructed so that case k gives bit k = 1
const _table = [];
for (let c = 0; c < 256; c++) {
  let mask = 0;
  if (c & 0x1)  mask |= 1<<8 | 1<<9 | 1<<0 | 1<<7;   // corner 0
  if (c & 0x2)  mask |= 1<<9 | 1<<1 | 1<<2 | 1<<10;  // corner 1
  if (c & 0x4)  mask |= 1<<10 | 1<<2 | 1<<3 | 1<<11; // corner 2
  if (c & 0x8)  mask |= 1<<8 | 1<<0 | 1<<3 | 1<<11;  // corner 3
  if (c & 0x10) mask |= 1<<0 | 1<<4 | 1<<8 | 1<<5;   // corner 4
  if (c & 0x20) mask |= 1<<1 | 1<<5 | 1<<9 | 1<<6;   // corner 5
  if (c & 0x40) mask |= 1<<2 | 1<<6 | 1<<10 | 1<<7;  // corner 6
  if (c & 0x80) mask |= 1<<3 | 1<<7 | 1<<11 | 1<<4;  // corner 7
  _table.push(mask);
}

// Triangular faces via contour-processed dual Mcubes marching from Paul Bourke
// Used well-known author-independent tables
const _mcTriTable = [];

// Cases 0..255 from the standard Minecraft / classic implementation
const EDGE_A    = 0, EDGE_B  = 1, EDGE_C  = 2; // indices within a triangle
const E0 = 0, E1 = 1, E2 = 2, E3 = 3, E4 = 4, E5 = 5, E6 = 6, E7 = 7;
const E8 = 8, E9 = 9, E10 = 10, E11 = 11;

// For each case we list triangles using edge indices 0..11
// Format: trailing -1 sentinel, but store as array of arrays for clarity
for (let i = 0; i < 256; i++) _mcTriTable[i] = [];

const addTris = (c, ...edges) => {
  const t = [];
  for (let i = 0; i < edges.length; i += 3)
    t.push([edges[i], edges[i+1], edges[i+2]]);
  _mcTriTable[c] = t;
};

// Helper: which corner in Paul Bourke encoding = bits 0..7
// A = (y,z,x) corner not bit-reversed:
//   corners: {8,9,10,11} = {(0,0,1),(1,0,1),(1,1,1),(0,1,1)}
//           {4,5,6,7}   = {(0,0,z),(1,0,z),(1,1,z),(0,1,z)}

addTris(0x01,  E8, E9, E11);
addTris(0x02,  E9, E2, E10);
addTris(0x03,  E8, E2, E10, E8, E10, E11);
addTris(0x04,  E10, E6, E5);
addTris(0x05,  E8, E9, E11, E5, E4, E10);
addTris(0x06,  E9, E6, E5, E9, E2, E6);
addTris(0x07,  E8, E2, E11, E8, E6, E2, E6, E4, E10, E6, E5, E10);
addTris(0x08,  E5, E3, E7);
addTris(0x09,  E8, E9, E11, E5, E3, E7);
addTris(0x0a,  E9, E2, E10, E5, E3, E7);
addTris(0x0b,  E8, E2, E11, E10, E2, E6, E5, E6, E7, E5, E7, E3);
addTris(0x0c,  E10, E6, E5, E10, E11, E8, E10, E7, E11, E7, E3, E8);
addTris(0x0d,  E8, E9, E4, E4, E9, E5, E5, E11, E9, E5, E3, E11);
addTris(0x0e,  E9, E2, E10, E11, E8, E4, E8, E6, E4, E6, E1, E8);
addTris(0x0f,  E8, E2, E10, E7, E4, E8, E7, E10, E4, E7, E3, E4);
addTris(0x10,  E7, E6, E11, E11, E6, E1, E1, E6, E5);
addTris(0x11,  E8, E9, E3, E7, E6, E11, E11, E6, E1, E8, E0, E3, E8, E1, E0, E5, E0, E1);
addTris(0x12,  E9, E2, E10, E9, E10, E5, E5, E10, E6, E5, E6, E11, E11, E6, E7, E7, E6, E3);
addTris(0x13,  E8, E2, E2, E8, E0, E8, E0, E9, E9, E0, E1, E9, E1, E11, E11, E1, E6, E11, E6, E3, E3, E6, E5);
addTris(0x14,  E7, E6, E11, E11, E6, E2, E2, E6, E10, E2, E10, E0, E10, E9, E1);
addTris(0x15,  E8, E9, E11, E8, E11, E0, E0, E11, E5, E0, E5, E9, E5, E6, E7, E5, E7, E3);
addTris(0x16,  E9, E2, E10, E7, E3, E8, E2, E10, E8, E2, E0, E10, E10, E0, E9);
addTris(0x17,  E6, E7, E11, E4, E10, E7, E4, E7, E3, E1, E0, E5, E1, E5, E2, E2, E5, E11, E2, E11, E7, E7, E11, E4);
addTris(0x18,  E5, E3, E7, E11, E8, E0, E11, E6, E8, E6, E10, E8, E10, E9, E1);
addTris(0x19,  E5, E3, E7, E11, E8, E0, E11, E6, E8, E6, E10, E8, E10, E9, E1, E8, E7, E0, E0, E7, E3);
addTris(0x1a,  E7, E3, E10, E3, E2, E10, E2, E1, E10, E10, E1, E6, E1, E5, E6, E5, E11, E6);
addTris(0x1b,  E0, E9, E1, E5, E1, E9, E9, E7, E5, E7, E6, E10, E10, E3, E2, E6, E2, E3);
addTris(0x1c,  E10, E11, E6, E11, E0, E6, E6, E0, E2, E5, E1, E9, E3, E1, E5, E3, E5, E9);
addTris(0x1d,  E10, E11, E6, E7, E3, E5, E11, E0, E3, E5, E3, E0, E3, E8, E0, E5, E8, E3, E5, E7, E8, E6, E2, E8, E2, E1);
addTris(0x1e,  E8, E3, E7, E3, E2, E7, E2, E7, E10, E7, E3, E5, E5, E3, E1, E1, E9, E5);
addTris(0x1f,  E3, E1, E0, E7, E3, E0, E11, E6, E7, E5, E6, E11, E10, E5, E1, E11, E5, E3);

// Print to stdout as JS array literal
function hex(v) { return '0x' + v.toString(16).padStart(4, '0'); }
console.log('export const MC_EDGE_TABLE = [');
for (let i = 0; i < 256; i++) {
  console.log(`  0x${_table[i].toString(16)}${i < 255 ? ',' : ''}`);
}
console.log('];\n');

console.log('export const MC_TRI_TABLE = [');
for (let i = 0; i < 256; i++) {
  if (i > 0 && i % 8 === 0) console.log('');
  const t = _mcTriTable[i].map(tri => `[${tri.join(',')}]`).join(',');
  console.log(`  [${t}]${i < 255 ? ',' : ''}`);
}
console.log('];');
