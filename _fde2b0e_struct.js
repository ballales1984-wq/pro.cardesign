const fs = require('fs');
const c = fs.readFileSync('_fde2b0e_ve.js', 'utf8').replace(/\r?\n/g, '\n');
const l = c.split('\n');
let d = 0;
const events = [];
for (let i = 0; i < l.length; i++) {
  const ts = (l[i] || '').trim();
  const o = (ts.match(/\{/g) || []).length;
  const cl = (ts.match(/}/g) || []).length;
  const prev = d;
  d += o - cl;
  if (ts.startsWith('export class VoxelEngine')) events.push({ type: 'OPEN', i: i + 1, d });
  if (ts.startsWith('addVoxel') || ts.startsWith('_addVoxelInternal') || ts.startsWith('removeVoxel')) {
    const sp = (l[i].match(/^[ \t]*/) || [''])[0].length;
    events.push({ type: 'METHOD', i: i + 1, d, sp, name: ts.substring(0, 55) });
  }
  if (prev === 1 && d === 0 && ts === '}') events.push({ type: 'CLASS_CLOSE', i: i + 1 });
}
console.log('fde2b0e structure:');
events.forEach(e => console.log(`  ${e.type.padEnd(15)} L${e.i} d:${e.d || '-'}${e.sp !== undefined ? ' SP:' + e.sp : ''}  ${e.name || ''}`));
console.log('Final depth:', d);
console.log('Total lines:', l.length);
