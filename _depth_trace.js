const fs = require('fs');
const c = fs.readFileSync('src/voxel-engine.js', 'utf8').replace(/\r/g, '');
const l = c.split('\n');

let depth = 0;
const events = [];

for (let i = 0; i < 100; i++) {
  const ts = l[i].trim();
  // Only count VALID braces that affect depth (not in strings/comments - but approximate)
  const opens = (ts.match(/\{/g) || []).length;
  const closes = (ts.match(/}/g) || []).length;
  const delta = opens - closes;
  events.push({ i: i + 1, before: depth, delta, after: depth + delta, ts: ts.substring(0, 50) });
  depth += delta;
}

console.log('Depth traces (first 100 lines):');
events.forEach(e => {
  if (e.i === 13 || e.delta !== 0 || e.before !== e.after) {
    console.log(`L${e.i}  d:${e.before}->${e.after}  delta:${e.delta > 0 ? '+' + e.delta : e.delta}  "${e.ts}"`);
  }
});

console.log('\nFinal depth after 100:', depth);
