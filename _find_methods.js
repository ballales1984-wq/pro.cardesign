const fs = require('fs');
const path = 'src/voxel-engine.js';
const c = fs.readFileSync(path, 'utf8').replace(/\r/g, '');
const lines = c.split('\n');

const results = [];
let depth = 0;
let classLine = -1;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const ts = line.trim();
  if (ts === 'export class VoxelEngine {') classLine = i;
  if (classLine >= 0 && i > classLine && i < lines.length) {
    // Track depth only inside class region
    const o = (ts.match(/\{/g) || []).length;
    const cl = (ts.match(/}/g) || []).length;
    const prev = depth;
    depth += o - cl;
    // Track every method/function definition INSIDE class body
    // Class body = depth >= 1
    const methodMatch = ts.match(/^((?:_[a-zA-Z_]|[_a-zA-Z])[a-zA-Z0-9_]*)\s*\(/);
    if (depth >= 1 && methodMatch && !ts.includes('=>') && !ts.includes('function')) {
      const sp = (line.match(/^[ \t]*/) || [''])[0].length;
      // Expected indent for class methods = 8
      const expected = 8;
      if (ts !== 'constructor(' && sp !== expected) {
        results.push({
          line: i + 1, method: methodMatch[1], sp, expected, tag: sp === expected ? 'OK' : `WRONG (want ${expected})`
        });
      }
    }
  }
}

console.log(`Found ${results.length} methods with non-standard indent:\n`);
results.forEach(r => console.log(`  L${r.line}  SP:${String(r.sp).padStart(2)} (expected ${r.expected})  [${r.tag}]  ${r.method}()`));
console.log(`\nFinal depth after entire file: ${depth}`);
