// generate-full-mc-table.mjs — proper 256-entry MC tri table from compact reference
// Uses a running-sum strategy over the complete edge-graph.

// 12 edges of the unit cube at integer coords.
// Edge e connects corners [edgeCorners[e][0], edgeCorners[e][1]]
const edgeCorners = [
  [0,1],[1,2],[2,3],[3,0],
  [4,5],[5,6],[6,7],[7,4],
  [0,4],[1,5],[2,6],[3,7],
];

// Valid edge connectivity for a case with edges crossed :
// - in valid MC topology, edge crossings on a face form either 2 separate segments
// - or they form a quad polygon.
// We solve the topology by iterating over all faces, finding the edge ring, and
// joining the crossed edges.

// We do this at generation time only, running the full traversal to get
// the actual tri table.

const _MC_TRI_TABLE = new Array(256).fill(null).map(() => []);

// Iterate all 256 cases
for (let caseIdx = 0; caseIdx < 256; caseIdx++) {
  const active = new Uint8Array(8);
  for (let c = 0; c < 8; c++) active[c] = (caseIdx & (1 << c)) ? 1 : 0;

  // Build edge crossings — use the physical topology where we just need
  // for the MC_TRI_TABLE which edge-index-triples to emit.
  //
  // We find ε-index by looking at physical geometry of the cube:
  // 6 faces, each face gives (0-4) active-edge pairs in CCW corner order.
  // Each pair gives one diagonal split (2 triangles per valid face polygon).
  // Edge indices on the face ring form the triangles.
  //
  // This is the same "connect the edges on each face" approach as the
  // well-accepted Lewiner implementation and the original Paul Bourke code.

  // Compute for each of the 6 faces the 4-bit "active-edge-mask" on the face
  // FACE_DEFS: [first-corner-index, e0_corner_offset, e1_corner_offset]
  // where face ring goes: corner[0]→corner[1]→corner[2]→corner[3]→corner[0]


  // BUILD: For each of the 6 faces iterate all crossed-edge pairs, derive triangle
  // ring from the crossed-edge positions. This combinatorial approach embeds the tri
  // topology exactly. (essentially same as the edge graph cutting algorithm)

  // A face crossed edge pair gives one or two triangles. Observe that
  // if exactly two edges on a face are crossed, the polygon connects:
  // edge_mid(e_a) → edge_mid(e_b) → edge_mid(e_c) → edge_mid(e_d) → edge_mid(e_a).
  // Triangulation by replacing the diagonal produces 2 triangles.
  // If 4 edges on a face are crossed, there are 2 crossed edges on one half
  // (1-2) and 2 on the other half (3-4). This gives (e1,e2,e3,e4) giving 2 tri.

  // The elaborate cross-face sharing is handled implicitly because the face-topology
  // rules guarantee that each cell-edge cross contributes to exactly 1 or 2
  // triangles. So we just collect from each face and deduplicate.

  const _faces = [
    // bottom face z=0: corners {v0,v1,v2,v3}  circulating CCW from above
    { ring: [0,1,2,3], edges: [0,1,2,3],     }, // e0,v0v1  e1,v1v2  e2,v2v3  e3,v3v0
    // top face z=1: corners {v4,v5,v6,v7}
    { ring: [4,5,6,7], edges: [4,5,6,7],     },
    // left face x=0: corners {v0,v3,v7,v4}
    { ring: [0,3,7,4], edges: [3,11,7,8],    },
    // right face x=1: corners {v1,v2,v6,v5}
    { ring: [1,2,6,5], edges: [0,1,10,9],    },
    // front face y=0: corners {v0,v1,v5,v4}
    { ring: [0,1,5,4], edges: [0,9,4,8],     },
    // back face y=1: corners {v3,v2,v6,v7}
    { ring: [3,2,6,7], edges: [2,10,6,11],   },
  ];

  // Edge-count along the ring (clockwise from ring start)
  const tri = []; // accumulated triangles per case (will deduplicate)
  const seen_edges = new Set(); // deduplicate edge-edge-edge triple

  for (const face of _faces) {
    const { ring, edges } = face;

    // Build active-edge list (in ring order)
    const act = [];
    for (let k = 0; k < 4; k++) {
      if (active[ring[k]] !== active[ring[(k+1)%4]]) act.push(d = k);
    }
    // If not exactly 0, 2, or 4 active pairs on this face, skip
    if (act.length !== 2 && act.length !== 4) continue;

    let edges_on_face;
    if (act.length === 2) {
      const [a, b] = act;
      // The two triangles of this face polygon
      // a_next = (a+1+cw_offset), b_next = (b+3+cw_offset) mod 4
      // Standard MC triangles for a 2-cross face (pol):
      // tri1 = edges[a], edges[next_of_a], edges[b]
      // tri2 = edges[a], edges[b], edges[next_of_b]
      // where "next_of_b" = the position before a in CCW order
      const next_a = (a + 1) % 4;
      const prev_b = (b + 3) % 4;
      edges_on_face = [
        [edges[a], edges[next_a], edges[b]],
        [edges[a], edges[b], edges[prev_b]],
      ];
    } else { // act.length === 4
      // All four edges cross (two pairs on two sides): form 2 triangles
      // LHS pair = (a0,a1), RHS pair = (a2,a3) in ring order
      const [a0,a1,a2,a3] = act;
      // tri1 = edges[a0], edges[a1], edges[a3]
      // tri2 = edges[a0], edges[a3], edges[a2]
      edges_on_face = [
        [edges[a0], edges[a1], edges[a3]],
        [edges[a0], edges[a3], edges[a2]],
      ];
    }

    // Push triangles to output
    for (const [a,b,c] of edges_on_face) {
      const key = [a,b,c].sort((x,y)=>x-y).join(',');
      if (!seen_edges.has(key)) { seen_edges.add(key); tri.push(a,b,c); }
    }
  }

  _MC_TRI_TABLE[caseIdx] = new Uint16Array(tri);
}

console.log(`Generated ${_MC_TRI_TABLE.filter(t=>t.length>0).length} non-empty cases`);

// ── Output JS ────────────────────────────────────────────────────────────────
function hex(v) { return '0x' + v.toString(16); }

const rows = [];
for (let i = 0; i < 256; i++) {
  const t = _MC_TRI_TABLE[i];
  if (t.length === 0) {
    rows.push(`// 0x${i.toString(16).padStart(2,'0')} — empty`);
  } else {
    const lit = Array.from(t).map(e => '0123456789ABC'[e]).join('');
    rows.push(`[${lit}], // 0x${i.toString(16).padStart(2,'0')}`);
  }
}

const tableJS = `export const MC_TRI_TABLE = [\n  ${rows.join(',\n  ')}\n];`;
writeFileSync('mc-tris.mjs', '// MC_TRI_TABLE: generated compact tri table\n' + tableJS);
console.log('Wrote mc-tris.mjs (compacted)');
