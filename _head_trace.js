// Analyze _head_ve_current.js (the HEAD commit to restore from)
const fs = require('fs');
const c = fs.readFileSync('_head_ve_current.js', 'utf8').replace(/\r/g, '');
const l = c.split('\n');

let depth = 0;
const events = [];

for (let i = 0; i < l.length; i++) {
  const ts = l[i].trim();
  const o = (ts.match(/\{/g) || []).length;
  const cl = (ts.match(/}/g) || []).length;
  const prev = depth;
  depth += o - cl;

  if (ts.startsWith('export class VoxelEngine')) {
    events.push({ type: 'CLASS_OPEN', i: i + 1, depth: prev });
  }
  if (prev === 1 && depth === 0 && ts === '}') {
    events.push({ type: 'CLASS_CLOSE', i: i + 1, depth: prev });
  }
  if (ts.startsWith('addVoxel') || ts.startsWith('_addVoxelInternal') || ts.startsWith('removeVoxel') || ts.startsWith('fillLayer')) {
    const sp = (l[i].match(/^[ \t]*/) || [''])[0].length;
    events.push({ type: 'METHOD', i: i + 1, depth: prev, sp, name: ts.substring(0, 55) });
  }
}

console.log(JSON.stringify(events, null, 2));
console.log('\nFinal depth:', depth);
