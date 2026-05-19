const fs = require('fs');
const path = 'src/voxel-engine.js';
const OLD_PATH = '_4c42e13_ve.js';

// Ensure we have the old file (re-extract from git)
const { execSync } = require('child_process');
try { fs.accessSync(OLD_PATH); } catch (_) {
  execSync('git show 4c42e13:src/voxel-engine.js > ' + OLD_PATH);
  console.log('Extracted old file');
}

const old = fs.readFileSync(OLD_PATH, 'utf8').replace(/\r?\n/g, '\n');
const curr = fs.readFileSync(path, 'utf8').replace(/\r\rn/g, '\n');

const oldL = old.split('\n');
const currL = curr.split('\n');

// Find all line differences that are structural (indentation changes on class methods)
const diffs = [];
for (let i = 0; i < Math.max(oldL.length, currL.length); i++) {
  if (oldL[i] !== currL[i]) {
    diffs.push({ line: i + 1, old: (oldL[i] || '').trim(), curr: (currL[i] || '').trim() });
  }
}

console.log(`Total different lines: ${diffs.length}`);
diffs.forEach(d => {
  // Show leading whitespace count
  const oldSp = ((oldL[d.line - 1] || '').match(/^[ \t]*/) || [''])[0].length;
  const currSp = ((currL[d.line - 1] || '').match(/^[ \t]*/) || [''])[0].length;
  // Only show if it's an indentation change or a method/statement
  if (oldSp !== currSp || !d.old.match(/^[\/\*]/)) {
    const indentChange = `[OLD SP:${oldSp} → CURR SP:${currSp}]`;
    console.log(`L${d.line} ${indentChange}\n  OLD: ${d.old.substring(0, 55)}\n  NEW: ${d.curr.substring(0, 55)}\n`);
  }
});
