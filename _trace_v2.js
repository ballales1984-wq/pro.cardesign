const fs = require('fs');
const c = fs.readFileSync('_head_ve_current.js', 'utf8').replace(/\r?\n/g, '\n');
const l = c.split('\n');
let d = 0;
// focus on lines 13-510
for(let i=0; i<510; i++) {
  const ts = l[i].trim();
  const o = (ts.match(/\{/g) || []).length;
  const cl = (ts.match(/}/g) || []).length;
  const prev = d; d += o - cl;
  if((o > 0 || cl > 0 || ts.startsWith('export class') || ts.startsWith('_getChunkKey') || ts.startsWith('addVoxel') || ts.startsWith('_addVoxelInternal') || ts === '}' || ts === '') && (i < 90 || i === 498 || i === 499 || i === 500 || i === 501 || i === 510 || i === 519)) {
    console.log('L'+(i+1), 'dB:'+prev+'->'+d, ts.substring(0,55));
  }
}
