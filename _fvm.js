// Indentation fixer for voxel-engine.js
// Problem: _addVoxelInternal, removeVoxel, fillLayer are at module level
// Solution: re-indent them to be inside VoxelEngine class body (8 spaces like addVoxel)
const fs = require('fs');
const path = 'src/voxel-engine.js';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Method signatures that need fixing (trimmed, exact match)
const methodsToCheck = [
  '_addVoxelInternal(pos, materialName, moduleId)',
  'removeVoxel(x, y, z)',
  'fillLayer(y, materialName, moduleId, solid = false)',
  'selectVoxel(x, y, z)',
  'getVoxelAt(x, y, z)',
  'getVoxelsInModule(moduleId)',
  'clearAll()',
  'setTool(tool)',
  'undo()',
  'redo()',
  'toJSON()',
  'update(deltaTime)',
  'resetCamera()',
  'getVoxelCount()',
  'setVoxelMaterial(x, y, z, materialName)',
  'setVoxelModule(x, y, z, moduleId)',
  'scaleSelectedVoxel(scaleX, scaleY, scaleZ)'
];

// Show each method header with its current core indent level
let found = [];
lines.forEach((line, i) => {
  const ts = line.trim();
  if (methodsToCheck.some(m => ts === m + ' {')) {
    // Find what this method is nested inside: count the depth relative to class
    let depth = 0;
    let classSeen = false;
    for (let j = 0; j < i; j++) {
      const tl = (lines[j] || '').trim();
      const o = (tl.match(/\{/g)||[]).length;
      const c = (tl.match(/}/g)||[]).length;
      const prev = depth;
      depth += o - c;
      if (tl === 'export class VoxelEngine {' || tl === 'export class VoxelEngine {') {
        classSeen = true;
        depth = 1;
      }
    }
    found.push({ line: i + 1, method: ts, indent: (line.match(/^[ \t]*/) || [''])[0].length, depth });
  }
});

console.log('Methods requiring fix:');
found.forEach(f => console.log(f.line, '| depth:' + f.depth, '| indent:' + f.indent, '|', f.method.substring(0, 55)));
