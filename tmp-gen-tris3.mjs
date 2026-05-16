const E0=0,E1=1,E2=2,E3=3,E4=4,E5=5,E6=6,E7=7,E8=8,E9=9,E10=10,E11=11;

// Face definitions: [ring-corners-CCW, ring-edge-indices-matching-corners]
// ring-edge-indices[i] connects ring-corners[i] -- ring-corners[(i+1)%4]
// ring-corners used to check "crossing" at that ring-edge.
const FACES = [
  { rc:[0,1,2,3], e:[E0,E1,E2,E3]  },   // f0: z=0 bottom, CCW from +Z
  { rc:[4,5,6,7], e:[E4,E5,E6,E7]  },   // f1: z=1 top,    CCW from +Z
  { rc:[0,3,7,4], e:[E3,E11,E7,E8] },   // f2: x=0 left,   CCW from -X
  { rc:[1,5,6,2], e:[E9,E4,E5,E10]  },  // f3: x=1 right,  CCW from +X
  { rc:[0,4,5,1], e:[E8,E4,E5,E9]  },   // f4: y=0 front,  CCW from -Y
  { rc:[3,7,6,2], e:[E11,E7,E6,E10] },   // f5: y=1 back,   CCW from +Y
];

function mcTris(caseIdx) {
  if (caseIdx === 0 || caseIdx === 255) return [];
  const act = new Uint8Array(8);
  for (let c = 0; c < 8; c++) act[c] = (caseIdx >> c) & 1;

  // Per-face triangulation: for each face ring, find crossed ring-edges
  // and connect them. The "connected set" rule:
  //   crossed ring-edges that are RING-ADJACENT in sequence → one polygon
  //   crossed ring-edges opposite in the ring → no polygon (two tiny triangles that
  //   would intersect incorrectly, so we skip them).
  function faceTriple(rc, ed) {
    const c = [act[rc[0]], act[rc[1]], act[rc[2]], act[rc[3]]];
    const [a, b, c2, d] = c; // renamed to avoid confusion
    const x1 = a !== b, x2 = b !== c2, x3 = c2 !== d, x4 = d !== a;
    const bits = [x1?0:-1, x2?1:-1, x3?2:-1, x4?3:-1].filter(i=>i>=0);

    if (bits.length === 0 || bits.length === 4) return []; // all out or all in = nothing
    if (bits.length === 1) return []; // single-crossing edge (tip only valid on 2-face)

    // For ring-adjacent bits (spread around the ring, ring-distance 1),
    // two crossed edges form one polygon (2 triangles from midpoint-link).
    // For non-adjacent (distance 2) → skip pair.
    // More complex: if 3 edges crossed, split into poly+edge.
    // If 4 edges crossed → 2 pairs separated by ring topology (equator via face).

    // For our binary v∈{0,1}, when values at corners straddle at 2 edges
    // the polygon rules are:
    //   CCW ring (c0,c1,c2,c3): if exactly 2 corners differ in ring-adjacency:
    //     tri1 = midpoint(c0→c1), midpoint(c1→c2), midpoint(c2→c3), midpoint(c3→c0)
    //   degenerate: 2 corners active diagonally → skip polygon (no common face)

    if (bits.length === 2) {
      const dist = (bits[1] - bits[0] + 4) % 4;
      if (dist === 2) return []; // diagonal pair — no polygon
    }
    if (bits.length === 3) {
      return []; // no-plane crossed
    }

    // Reach here: bits.length===2 && adjacent (dist=1 or 3)
    const [a_idx, b_idx] = bits;
    const a_next = (a_idx+1)%4, b_next = (b_idx+1)%4;
    const [e0,e1,e2,e3,] = ed;
    const e = [e0,e1,e2,e3];

    return [
      [ e[a_idx], e[a_next], e[b_idx] ],
      [ e[a_idx], e[b_idx], e[(b_idx+3)%4] ],
    ];
  }

  const tri = [], seen = new Set();
  for (const face of FACES) {
    const tris2 = faceTriple(face.rc, face.e);
    for (const [a,b,c] of tris2) {
      const key = [a,b,c].sort().join(',');
      if (!seen.has(key)) { seen.add(key); tri.push(a,b,c); }
    }
  }
  return tri;
}

// Validate
let ok = 0, fail = 0;
for (let c=1;c<255;c++) {
  const t = mcTris(c);
  if (t.length > 0) { ok++; }
  else { fail++; console.error(`CASE 0x${c.toString(16)} = 0 EMPTY — may need fix`); }
}
console.log(`Validated: ${ok} cases have tris, ${fail} empty (expected ~224 / ~32)`);
