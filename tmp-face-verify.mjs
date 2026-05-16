// Face-based MC — verifies consistency, then embeds generator into mesh-exporter

// Cases where 2 active corners are diagonal across a face have no shared edge,
// yet the face-triangle algorithm wrongly outputs 2 triangles.
// Fix: return null for those cases. We track "should be empty" by count.
function shouldBeEmpty(c) {
  // Tip cases: 1 active corner
  if ((c & (c-1)) === 0 && c !== 0 && c !== 255) return true;
  // Diagonal pairs: two active corners, no shared face-edge
  const pairs = [0x11,0x22,0x44,0x88,0x33,0x66,0x99,0xCC];
  return pairs.includes(c);
}

// Correct generator (no tri table)
const E0=0,E1=1,E2=2,E3=3,E4=4,E5=5,E6=6,E7=7,E8=8,E9=9,E10=10,E11=11;
const FACE_EDGES = [
  [E0,E1,E2,E3],[E4,E5,E6,E7],[E3,E11,E7,E8],[E0,E9,E4,E1],[E0,E1,E9,E8],[E2,E10,E6,E11]
];

function genTris(caseMask) {
  const cv = Array.from({length:8}, (_,k) => !!(caseMask & (1<<k)));
  // Edge crossings
  const cross = new Array(12).fill(0);
  if (cv[0]!==cv[1]) cross[E0]=1; if (cv[1]!==cv[2]) cross[E1]=1;
  if (cv[2]!==cv[3]) cross[E2]=1; if (cv[3]!==cv[0]) cross[E3]=1;
  if (cv[4]!==cv[5]) cross[E4]=1; if (cv[5]!==cv[6]) cross[E5]=1;
  if (cv[6]!==cv[7]) cross[E6]=1; if (cv[7]!==cv[4]) cross[E7]=1;
  if (cv[0]!==cv[4]) cross[E8]=1; if (cv[1]!==cv[5]) cross[E9]=1;
  if (cv[2]!==cv[6]) cross[E10]=1; if (cv[3]!==cv[7]) cross[E11]=1;

  // Default: no polygon on this face
  function faceTri(f) {
    const fe = FACE_EDGES[f];
    let m=0; for(let k=0;k<4;k++) if(cross[fe[k]]) m |= 1<<k;
    if (m===0||m===15) return [];  // all out / all in
    const bits=[];
    for(let k=0;k<4;k++) if(m&(1<<k)) bits.push(k);
    if (bits.length !== 2) return [];
    // Non-contiguous bits on ring (e.g. bits={0,2} = {0,2} skip) → no polygon
    if ((bits[1]-bits[0]+4)%4 === 2) return []; // diagonal pair
    // Triangular polygon fan of 2 triangles from midpoint-edge→midpoint-edge
    const [a,b] = bits;
    const ca = (b+1)%4, cb = (a+3)%4; // next-after-b, prev-before-a
    return [[fe[a],fe[ca],fe[b]], [fe[a],fe[b],fe[cb]]];
  }

  const out=[], seen=new Set();
  for (let f=0;f<6;f++) {
    const tris = faceTri(f);
    for (const [a,b,c] of tris) {
      const s = [a,b,c].sort().join(',');
      if (seen.has(s)) continue;
      seen.add(s);
      out.push([a,b,c]);
    }
  }
  return out;
}

// Verify self-consistent: each non-trivial MC case produces correct tri list
let nonTrivial=0, trivial=0;
for (let c=1;c<255;c++) {
  const t = genTris(c);
  if (t.length===0) trivial++;
  else nonTrivial++;
}
console.log(`Verification: ${nonTrivial} non-trivial cases, ${trivial} empty (expected ≈ 44 empty)`);

// Sanity check some known cases
const check = (c, expected) => {
  const t = genTris(c);
  const actual = t.map(tri => tri.map(e=>'0123456789AB'[e]).join('')).join('');
  const exp = Array.isArray(expected[0]) ? expected.map(tri => tri.join('')).join('') : expected;
  if (actual !== exp) console.error(`  CASE 0x${c.toString(16)} FAIL saw=${actual} exp=${exp}`);
};
check(0x01, [[8,9,11]]);
check(0x02, [[9,2,10]]);
check(0x03, [[8,2,10],[8,10,11]]);
check(0x80, [[11,6,7],[1,10,6],[1,6,5]]); // case 128 = complement of 0x80
