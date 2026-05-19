let d = 0;
const openBraceStack = [];

for (let i = 0; i < l.length; i++) {
  const ts = l[i].trim();

  // Track class open
  if (ts.startsWith('export class VoxelEngine {')) {
    console.log(`CLASS OPENS at L${i + 1}, depth before: ${d}`);
  }

  // Push braces
  for (let c = 0; c < ts.length; c++) {
    if (ts[c] === '{') { d++; openBraceStack.push(i + 1); }
    if (ts[c] === '}') { d--; openBraceStack.pop(); }
  }

  // Show round numbers
  if (i < 60 || i === 180 || i === 182) {
    console.log(`L${i + 1}  depth:${d}  ${ts.substring(0, 50)}`);
  }
}
