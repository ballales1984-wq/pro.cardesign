// Preciso tracer: trova davvero metodi della classe VoxelEngine
// Criterio: dentro class body (depth >= 1), riga inizia con indentation + nome + '('
const fs = require('fs');
const c = fs.readFileSync('src/voxel-engine.js', 'utf8').replace(/\r/g, '');
const l = c.split('\n');

let depth = 0;
let classLine = -1;
const methods = [];
const transitions = [];

for (let i = 0; i < l.length; i++) {
  const raw = l[i];
  const ts = raw.trim();

  // Depth tracking for entire file
  const o = (ts.match(/\{/g) || []).length;
  const cl = (ts.match(/}/g) || []).length;

  if (i === 0 && ts.startsWith('export class VoxelEngine')) classLine = 0;

  const prev = depth;
  depth += o - cl;

  // After class open, track all method defs that are at class body depth
  // Class body depth = 1 (between outer opening { of class and closing })
  if (classLine >= 0 && i > classLine) {
    // Find lines like: indent  + ident + '('  (class method pattern)
    const rawIndent = raw.match(/^([ \t]*)/)[1];
    const sp = rawIndent.length;

    // A class method: indent at 8+, followed by identifier word chars + open paren
    // Pattern: spaces + ([a-zA-Z_][a-zA-Z0-9_]*)  (
    const methodHeader = ts.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
    if (methodHeader && !ts.includes('=>')) {
      const name = methodHeader[1];
      const inBody = depth >= 1; // inside class body
      methods.push({ line: i + 1, sp, name, depth, inBody, snippet: ts.substring(0, 50) });
    }

    // Show where class depth transitions happen (class boundary)
    if (prev === 1 && depth === 0 && ts === '}') {
      transitions.push(`L${i + 1}: class body boundary (depth 1->0): "${ts.substring(0, 40)}"`);
    }
  }
}

console.log('=== CLASS BODY BOUNDARIES (class closes on }) ===');
transitions.forEach(t => console.log('  ' + t));

console.log('\n=== CLASS METHODS (depth >= 1 = inside class) ===');
const inClass = methods.filter(m => m.inBody);
const outClass = methods.filter(m => !m.inBody);
console.log(`In-class: ${inClass.length} | Out-of-class (depth < 1): ${outClass.length}\n`);

inClass.forEach(m => console.log(`  L${m.line}  SP:${String(m.sp).padStart(2)}  IN [OK]  ${m.name}()`));
outClass.forEach(m => console.log(`  L${m.line}  SP:${String(m.sp).padStart(2)}  OUT [BUG]  ${m.name}()  depth=${m.depth}`));

console.log(`\nFinal depth: ${depth}`);
console.log(`Total methods found: ${methods.length}`);
