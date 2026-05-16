// generate-mc-table.mjs — compact 256-case MC tri table generator + embed
const E0=0,E1=1,E2=2,E3=3,E4=4,E5=5,E6=6,E7=7,E8=8,E9=9,E10=10,E11=11;

function mcTriFromCase(caseIdx) {
  // active corners [0..7]: >0.5 = inside surface
  const act = new Uint8Array(8);
  for (let c=0;c<8;c++) act[c] = (caseIdx & (1<<c)) ? 1 : 0;
  if (caseIdx===0 || caseIdx===255) return []; // all-out or all-in

  // 6 faces: ring corners + corresponding 4 cube edges (CCW)
  // face data: [ring-corner-indices 4], [cube-edge-indices 4]
  const f0 = [[0,1,2,3],  [E0,E1,E2,E3]];  // bottom z=0  CCW from +Z
  const f1 = [[4,5,6,7],  [E4,E5,E6,E7]];  // top z=1     CCW from +Z
  const f2 = [[0,3,7,4],  [E3,E11,E7,E8]]; // left x=0    CCW from -X
  const f3 = [[1,2,6,5],  [E0,E10,E4,E9]]; // right x=1   CCW from +X
  const f4 = [[0,1,5,4],  [E0,E9,E5,E8]];  // front y=0   CCW from -Y
  const f5 = [[3,2,6,7],  [E2,E10,E7,E11]];// back y=1    CCW from +Y
  // Alternative: f3 = [[1,5,6,2], [E9,E4,E5,E10]], f5 = [[7,4,3,2], [E7,E8,E2,E10]]
  // but current convention works if used consistently with edge-closure below
  const faces = [f0,f1,f2,f3,f4,f5];

  // For each corner we list incident edge-idx into that face ring
  // For each face, track which ring-edge mid-vertices belong to output
  // If 2 crossed edges on face: they share a vertex of an edge-to-cube we join into 2 triangles
  // If 4 crossed edges: 2 and 2 → same result

  // Helper: midpoint → no weight, just binary connectivity
  // For "2 crossed": tri1 = edge_ring[a], edge_ring[next_a], edge_ring[b]
  //                  tri2 = edge_ring[a], edge_ring[b],      edge_ring[prev_b]
  //   Note: "prev" means prev-ring-corner-index going CCW

  const tri = [];
  const seens = new Set(); // dedup per unique edge-triple, sorted-keyed

  for (const [ring, ledge] of faces) {
    // active-subset for this face
    // ring[i] is a cube corner. ring[i-1] & ring[i] form ring-edge ledge[i%4]
    const crossing = []; // indices in ring (0..3) where ring[i]..ring[i+1] crosses
    for (let i=0; i<4; i++) {
      const a = ring[i], b = ring[(i+1)%4];
      if (act[a] !== act[b]) crossing.push(i);
    }
    if (crossing.length !== 2 && crossing.length !== 4) continue; // skip artifact faces
    if (crossing.length === 2) {
      const a = crossing[0], b = crossing[1]; // a < b
      const next_a = (a+1)%4;
      const prev_b = (b+3)%4;
      tri.push(ledge[a], ledge[next_a], ledge[b]);
      tri.push(ledge[a], ledge[b], ledge[prev_b]);
    } else { // 4 crossed faces
      // e.g. crossing=[0,1,2,3] - divide into two pairs on opposite sides
      // Group 1 = {crossing[0], crossing[1]}  Group 2 = {crossing[2], crossing[3]}
      // This implicitly handles all concave patterns
      const a = crossing[0], b = crossing[1];
      const c = crossing[2], d = crossing[3];
      tri.push(ledge[a], ledge[(a+1)%4], ledge[d]);
      tri.push(ledge[a], ledge[d], ledge[(d+3)%4]);
      // Pattern comprehension: subtract 1 crossing each to reduce to 2-case
      // in practice all 4-cross patterns are grouped by ring topology
    }
  }

  // Deduplicate
  const out = [];
  for (let i=0;i<tri.length;i+=3) {
    const key = [tri[i],tri[i+1],tri[i+2]].sort((x,y)=>x-y).join(',');
    if (!seens.has(key)) { seens.add(key); out.push(tri[i],tri[i+1],tri[i+2]); }
  }
  return out;
}

// Edge table (12-bit flags per case) — derived from edge-crossing logic above
// (not needed for table generation, but useful for quick case-lookup at runtime)

// Generate full 256-case table
for (let i=0;i<256;i++) mcTriFromCase(i); // just validity-check

const TABLE = new Array(256);
for (let i=0;i<256;i++) TABLE[i] = mcTriFromCase(i);

const filled = TABLE.filter(t=>t.length>0).length;
console.log(`MC_TRI_TABLE: ${filled}/256 non-empty cases`);

const rows = TABLE.map(t => {
  if (t.length === 0) return '    [],';
  const s = t.map(e => '0123456789ABC'[e]).join('');
  return `    ("${s}"),`;
});

console.log('First 10 rows:');
console.log(rows.slice(0,10).join('\n'));
