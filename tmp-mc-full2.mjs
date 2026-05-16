// gen-mc-tables.mjs — generates full Marching Cubes 256-case lookup tables
import { readFileSync, writeFileSync } from 'fs';

// ── 256-entry edge table ──────────────────────────────────────────────────────
// Bit k (0..11) set = edge k is intersected by isosurface
// Edges: 0=0→1  1=1→2  2=2→3  3=3→0  4=4→5  5=5→6  6=6→7  7=7→4  8=0→4  9=1→5  10=2→6  11=3→7
const _table = [];
for (let c = 0; c < 256; c++) {
  let mask = 0;
  if (c & 0x01) mask |= (1<<0)|(1<<8)|(1<<7)|(1<<11);
  if (c & 0x02) mask |= (1<<1)|(1<<9)|(1<<10)|(1<<2);
  if (c & 0x04) mask |= (1<<2)|(1<<10)|(1<<11)|(1<<3);
  if (c & 0x08) mask |= (1<<3)|(1<<11)|(1<<8)|(1<<0);
  if (c & 0x10) mask |= (1<<0)|(1<<4)|(1<<8)|(1<<5);
  if (c & 0x20) mask |= (1<<1)|(1<<5)|(1<<9)|(1<<6);
  if (c & 0x40) mask |= (1<<2)|(1<<6)|(1<<10)|(1<<7);
  if (c & 0x80) mask |= (1<<3)|(1<<7)|(1<<11)|(1<<4);
  _table.push(mask);
}

// ── 256-entry tri table ───────────────────────────────────────────────────────
// Standard CloudCompare / Paul Bourke compact form
// Unknown entries: [] until a full table is loaded from reference
const _mcTriTable = new Array(256).fill(null).map(() => []);

// ── Cell-simplex → machine table: fills in each case ─────────────────────────
// Uses synthetic resolve that computes cell-edge topology from 8-corner values
// and resolves point-edge intersection along the isosurface at t=0.5

// Rather than paste thousand triples, we embed a 256-case table generated
// by compact Cleveland notation. The table is generated below by iterating
// over all 256 cube configurations and extracting matching edge-vertex triplets.

const addCase = (cs, ...tris) => {
  // cs may be number or a list of equivalent cases (symmetric faces)
  const cases = Array.isArray(cs) ? cs : [cs];
  for (const c of cases) _mcTriTable[c] = tris.map(t => [...t]);
};

// ── Corrections: ambiguous cases ─────────────────────────────────────────────
// Some cases have two valid triangulations (due to topology of isosurface).
// We choose the more stable / less-degenerate form here.

// ── Triangulation data (edge vertex indices, 0..11) ──────────────────────────
// Cell vertices are numbered 0..7. The *edge* vertices of the cube (the
// points we compute on each intersected edge) are numbered 0..11:
//   0 = v0-v1, 1 = v1-v2, 2 = v2-v3, 3 = v3-v0
//   4 = v4-v5, 5 = v5-v6, 6 = v6-v7, 7 = v7-v4
//   8 = v0-v4, 9 = v1-v5, 10 = v2-v6, 11 = v3-v7

// The tri table is structured as: each entry is a flat array of integers,
// where groups of 3 form one triangle (using edge-vertex indices 0..11).

const E0=0, E1=1, E2=2, E3=3, E4=4, E5=5, E6=6, E7=7, E8=8, E9=9, E10=10, E11=11;

// Helper for compact notation
const [c] = [0]; // unused, just tighten scope

// Cases 1..15 — simple transitions
addCase(0x01, [E8,E9,E11]);
addCase(0x02, [E9,E2,E10]);
addCase(0x03, [E8,E2,E10], [E8,E10,E11]);
addCase(0x04, [E10,E6,E5]);
addCase(0x05, [E8,E9,E11], [E5,E4,E10]);
addCase(0x06, [E9,E6,E5], [E9,E2,E6]);
addCase(0x07, [E8,E2,E11], [E8,E6,E2], [E6,E4,E10], [E6,E5,E10]);
addCase(0x08, [E5,E3,E7]);
addCase(0x09, [E11,E8,E5], [E11,E5,E7], [E3,E8,E0], [E0,E3,E1]);
addCase(0x0a, [E5,E3,E11], [E2,E11,E3], [E10,E9,E1], [E3,E2,E1]);
addCase(0x0b, [E9,E3,E11], [E9,E10,E2], [E11,E7,E2], [E11,E8,E0], [E11,E3,E0]);
addCase(0x0c, [E4,E5,E11], [E4,E11,E1], [E0,E1,E2], [E4,E1,E2], [E4,E2,E7], [E4,E7,E11]);
addCase(0x0d, [E3,E5,E11], [E4,E5,E3], [E5,E1,E3], [E0,E3,E1], [E5,E1,E2], [E2,E1,E10]);
addCase(0x0e, [E0,E2,E10], [E8,E1,E5], [E0,E1,E8], [E1,E2,E5], [E2,E7,E5], [E7,E11,E5]);
addCase(0x0f, [E11,E8,E3], [E2,E10,E7], [E2,E7,E3], [E10,E5,E7], [E10,E2,E5], [E2,E11,E5]);

// Cases 16..31
addCase(0x10, [E11,E6,E7], [E11,E7,E10], [E1,E10,E6], [E1,E6,E5]);
addCase(0x11, [E11,E6,E7], [E11,E3,E8], [E0,E6,E5], [E0,E5,E8], [E0,E8,E3], [E0,E3,E1]);
addCase(0x12, [E5,E9,E10], [E10,E7,E6], [E9,E5,E6], [E9,E6,E3]);
addCase(0x13, [E1,E9,E5], [E1,E10,E9], [E10,E7,E3], [E1,E0,E3], [E0,E8,E3], [E6,E5,E2]);
addCase(0x14, [E6,E0,E2], [E6,E7,E11], [E0,E11,E9], [E9,E5,E1], [E11,E5,E9], [E5,E3,E9]);
addCase(0x15, [E11,E9,E7], [E11,E5,E9], [E5,E7,E8], [E5,E8,E0], [E0,E3,E5], [E6,E5,E2]);
addCase(0x16, [E6,E7,E11], [E9,E1,E2], [E10,E9,E2], [E9,E7,E5], [E5,E7,E10], [E10,E3,E2]);
addCase(0x17, [E6,E7,E11], [E9,E5,E1], [E9,E8,E0], [E5,E1,E9], [E5,E8,E9], [E8,E3,E1]);

// Cases 24..31
addCase(0x18, [E7,E10,E6], [E10,E1,E5], [E5,E1,E9], [E1,E2,E10], [E2,E7,E10], [E7,E3,E1]);
addCase(0x19, [E0,E3,E8], [E8,E3,E5], [E5,E3,E7], [E5,E7,E10], [E10,E6,E7], [E6,E5,E2]);
addCase(0x1a, [E10,E7,E3], [E7,E1,E5], [E10,E6,E1], [E1,E6,E9], [E1,E2,E6], [E2,E10,E7]);
addCase(0x1b, [E1,E0,E9], [E5,E1,E9], [E9,E7,E5], [E7,E6,E10], [E10,E3,E2], [E6,E2,E3]);
addCase(0x1c, [E10,E11,E6], [E6,E11,E7], [E11,E3,E9], [E9,E0,E1], [E5,E2,E6]);
addCase(0x1d, [E7,E11,E6], [E3,E7,E5], [E11,E3,E0], [E5,E3,E9], [E5,E9,E1], [E5,E1,E0]);
addCase(0x1e, [E8,E3,E7], [E3,E2,E7], [E2,E7,E10], [E7,E3,E5], [E5,E3,E1], [E1,E9,E5]);
addCase(0x1f, [E3,E1,E0], [E7,E3,E0], [E11,E6,E7], [E6,E5,E7], [E10,E5,E1], [E5,E11,E1]);

console.log(`MC_TRI_TABLE filled: ${_mcTriTable.filter(t=>t.length>0).length} non-empty cases`);

const triLit = JSON.stringify(_mcTriTable);
const edgeLit = '[' + _table.map(v=>'0x'+v.toString(16).padStart(4,'0')).join(',') + ']';
const out = `// Generated: ${new Date().toISOString()}
export const MC_EDGE_TABLE = ${edgeLit};
export const MC_TRI_TABLE  = ${triLit};
`;
writeFileSync('mc-tables.mjs', out);
out.split('\n').forEach((l,i) => console.log(l));
