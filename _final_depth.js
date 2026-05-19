const fs = require('fs');
const c = fs.readFileSync('_head_ve_current.js', 'utf8').replace(/\r?\n/g, '\n');
const l = c.split('\n');
let d = 0;

// Conteggio indentazioni CANCELLATE (cambi solo 1-3 righe alla volta)
const FIX = {
  empty: n => 0,
  toString: n => '',
  _addVoxelInternal: n => 8,
  removeVoxel: n   => 8,
  fillLayer: n     => 8,
  selectVoxel: n   => 8,
  getVoxelAt: n    => 8,
  getVoxelsInModule: n   => 8,
  _removeVoxelSilently: n => 8,
  voxelsIterator: n  => 8,
  _notify: n        => 8,
  update: n         => 8,
  toJSON: n         => 8,
  fromJSON: n       => 8,
  setVoxelMaterial: n => 8,
  setVoxelModule: n   => 8,
  optimize: n          => 8,
  resetCamera: n       => 8,
  getVoxelCount: n     => 8,
  onVoxelChanged: n    => 8,
};

console.log(`=== BRACE-only depth trace for _head_ve_current.js ===\n`);

for (let i = 0; i < l.length; i++) {
  const ts = l[i].trim();
  const o = (ts.match(/\{/g) || []).length;
  const cl = (ts.match(/}/g) || []).length;

  // DEBUG: Show class-open + a sample of key transitions
  if (ts === 'export class VoxelEngine {' || ts === '_addVoxelInternal(' || ts === 'removeVoxel(' || ts === 'fillLayer(' || ts === '}') {
    const prev_d = d;
    d += o - cl;
    console.log('L' + (i + 1), 'd:' + prev_d + '->' + d, 'o:' + o, 'c:' + cl, JSON.stringify(ts.substring(0, 55)));
  } else {
    d += o - cl;
  }
}
console.log('\nFinal depth:', d);
