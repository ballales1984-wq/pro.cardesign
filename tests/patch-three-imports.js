const fs = require('fs');
const path = require('path');

const FILES = [
  'src/core/brick-system.js',
  'src/core/scaling-tool.js',
  'src/voxel-engine.js',
  'src/main.js',
  'src/mesh-exporter.js',
  'src/core/stl-import.js',
  'src/core/tetrahedral-mesh.js',
  'src/core/brick-adapter.js',
  'src/core/component-library.js',
  'src/core/sphere-system.js',
  'src/model/VoxelModel.js',
  'src/model/EditableMeshModel.js',
  'src/model/HybridModel.js',
  'src/geometry/converters/voxelToMesh.js',
  'src/geometry/converters/meshToVoxel.js',
  'src/geometry/primitives/index.js',
];

const OLD = "import * as THREE from 'three'";
const NEW = [
  "// Import dinamico: permette al test runner di iniettare un mock prima del caricamento",
  "const THREE = await import('three');",
  "",
].join("\n");

for (const rel of FILES) {
  const full = path.resolve(rel);
  if (!fs.existsSync(full)) { console.log('SKIP (not found):', rel); continue; }
  const code = fs.readFileSync(full, 'utf8');
  if (!code.includes(OLD)) { console.log('SKIP (no match):', rel); continue; }
  const patched = code.replace(OLD, NEW);
  fs.writeFileSync(full, patched, 'utf8');
  console.log('OK:', rel);
}
