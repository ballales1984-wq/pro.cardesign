// Test Suite JavaScript — pro.cardesign Frontend (ESM dynamic import)
// Esegui con: node tests/test_coverage.js

const assert = require('assert');
const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

// Setup DOM mock realistico
const dom = new JSDOM('<!DOCTYPE html><html><body><canvas id="gl-canvas"></canvas><div id="voxel-count"></div><span id="fps-counter"></span><span id="tool-hint"></span><div id="materials-list"></div><div id="modules-tree"></div><div id="properties-panel"><p class="hint">S</p></div><div id="physics-panel"><p class="hint">C</p></div><div id="library-category"><select><option value="all">All</option></select></div><div id="component-list"></div><div id="component-editor"></div><div id="panel-component-selected"></div><button id="tool-select"></button><button id="tool-add"></button><button id="tool-remove"></button><button id="tool-fill"></button><button id="tool-scaling"></button><button id="btn-undo"></button><button id="btn-redo"></button></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  runScripts: 'dangerously'
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;
global.performance = { now: () => Date.now() };

// Mock THREE globale minimale
global.THREE = {
  Scene: function() { this.add = function(){}; this.children = []; },
  FogExp2: function(){},
  PerspectiveCamera: function(){ this.position = { set:()=>{}, copy:()=>{} }; this.lookAt =()=>{}; this.aspect = 1; this.updateProjectionMatrix =()=>{}; },
  WebGLRenderer: function(){ this.domElement = document.createElement('canvas'); this.setSize =()=>{}; this.setPixelRatio =()=>{}; this.shadowMap = { enabled:false, type:1 }; this.render =()=>{}; },
  BoxGeometry: function(){ return { dispose:()=>{} }; },
  MeshStandardMaterial: function(opts){ this.color = opts.color || {set:()=>{}}; this.name = ''; this.wireframe = false; },
  Mesh: function(geo, mat){ this.geometry = geo; this.material = mat; this.position = { x:0,y:0,z:0, set:()=>{}, copy:()=>{} }; this.scale = { x:1,y:1,z:1 }; this.visible = true; this.castShadow = false; this.receiveShadow = false; },
  InstancedMesh: function(geo, mat, count){ this.count = 0; this.instanceMatrix = { setUsage:()=>{}, needsUpdate:false }; this.frustumCulled = true; this.castShadow = false; this.receiveShadow = false; },
  Matrix4: function(){ this.makeScale = ()=>({setPosition:()=>this}); this.setPosition = ()=>({setPosition:()=>this}); return this; },
  Group: function(){ this.add=()=>{}; },
  Raycaster: function(){ this.intersectObjects = () => []; this.setFromCamera = ()=>{ this.ray = { intersectPlane: () => null }; }; },
  Color: function(c){ this.set = ()=>{}; },
  CanvasTexture: function(){ this.needsUpdate = false; this.image = { width:128, height:64 }; },
  SpriteMaterial: function(opts){ this.map = opts.map; this.depthTest = false; },
  Sprite: function(mat){ this.position = { copy:()=>{}, set:()=>{} }; this.scale = { set:()=>{} }; },
  Vector3: function(x,y,z){ this.x=x||0; this.y=y||0; this.z=z||0; this.clone=()=>this; this.copy=()=>{}; this.add=()=>{}; this.multiplyScalar=()=>{}; this.sub=()=>this; this.set=()=>{}; this.normalize=()=>{}; },
  Vector2: function(x,y){ this.x=x||0; this.y=y||0; },
  Plane: function(){},
  PlaneGeometry: function(){},
  BufferGeometry: function(){ this.setAttribute = function(name, attr){ this.attributes[name] = attr; }; this.computeBoundingSphere = function(){}; this.computeVertexNormals = function(){}; this.index = null; },
  Float32BufferAttribute: function(data, itemSize){ this.array=data; this.count = data.length/itemSize; this.getX = i => this.array[i*3]; this.getY = i => this.array[i*3+1]; this.getZ = i => this.array[i*3+2]; this.setX = (i,v) => { this.array[i*3] = v; this.needsUpdate=true; }; this.setY = (i,v) => { this.array[i*3+1] = v; }; this.setZ = (i,v) => { this.array[i*3+2] = v; }; this.needsUpdate = false; },
  FrontSide: 0, DoubleSide: 1, BackSide: 2,
  PCFSoftShadowMap: 1, BasicShadowMap: 0,
  NoBlending: 0, AdditiveBlending: 1,
  NormalBlending: 2,
  AdditiveBlending: 1,
};

async function loadESM(relPath) {
  const full = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(full)) throw new Error(`Not found: ${full}`);
  return import('file://' + full);
}

async function runAll() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     pro.cardesign JavaScript Test Coverage        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  
  let passed = 0, failed = 0;
  const results = [];

  // 1 - MaterialSystem
  try {
    const { MaterialSystem } = await loadESM('src/material-system.js');
    const ms = new MaterialSystem();
    assert.strictEqual(ms.count(), 8);
    const steel = ms.get('steel');
    assert.strictEqual(steel.density, 7850);
    assert.strictEqual(ms.getVoxelMass({ material: 'steel' }) > 0, true);
    console.log('  [PASS] MaterialSystem');
    passed++;
  } catch (e) {
    failed++;
    console.log('  [FAIL] MaterialSystem: ' + e.message);
  }
  
  // 2 - ModuleSystem
  try {
    const { ModuleSystem } = await loadESM('src/module-system.js');
    const ms = new ModuleSystem({ get:()=>({}), count:()=>8 });
    assert.strictEqual(ms.count(), 1);
    const id = ms.createModule('Telaio', ms.rootId);
    assert.ok(id > 1);
    const tree = ms.getTree();
    assert.ok(tree);
    console.log('  [PASS] ModuleSystem');
    passed++;
  } catch (e) {
    failed++;
    console.log('  [FAIL] ModuleSystem: ' + e.message);
  }
  
  // 3 - Brick
  try {
    const { Brick } = await loadESM('src/core/brick-system.js');
    const b = new Brick(1, 'Test', {x:0,y:0,z:0}, {x:100,y:20,z:20});
    assert.strictEqual(b.volume_mm3, 100 * 20 * 20); // 40000 mm³
    console.log('  [PASS] Brick (JS)');
    passed++;
  } catch (e) {
    failed++;
    console.log('  [FAIL] Brick JS: ' + e.message);
  }
  
  // 5 - ComponentLibrary
  try {
    const { ComponentLibrary } = await loadESM('src/core/component-library.js');
    const lib = new ComponentLibrary();
    assert.ok(lib.getAll().length > 0);
    assert.ok(lib.get(1));
    assert.ok(lib.search('700c').length > 0);
    console.log('  [PASS] ComponentLibrary');
    passed++;
  } catch (e) {
    failed++;
    console.log('  [FAIL] ComponentLibrary: ' + e.message);
  }

  // 5 - BrickAdapter
  try {
    const { BrickAdapter } = await loadESM('src/core/brick-adapter.js');
    assert.ok(BrickAdapter);
    console.log('  [PASS] BrickAdapter export');
    passed++;
  } catch (e) {
    failed++;
    console.log('  [FAIL] BrickAdapter: ' + e.message);
  }

  // 6 - MeshExporter (concrete test with mock geometry)
  try {
    const { MeshExporter } = await loadESM('src/mesh-exporter.js');
    const exp = new MeshExporter();
    
    // Triangolo mock geometry
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      0,0,0,  1,0,0,  0,1,0
    ], 3));
    geo.setIndex([0,1,2]);
    geo.computeBoundingSphere = function(){};
    
    // OBJ export
    const obj = exp.exportOBJ(geo);
    assert.ok(obj.includes('v 0.000000'));
    assert.ok(obj.includes('f 1/1/1 2/2/2 3/3/3') || obj.includes('f 1 2 3'));
    console.log('  [PASS] MeshExporter.exportOBJ');
    
    // STL ASCII export
    const stl = exp.exportSTL(geo, true);
    assert.ok(stl.includes('solid VoxelCAD'));
    assert.ok(stl.includes('facet'));
    console.log('  [PASS] MeshExporter.exportSTL (ASCII)');
    
    // STL binary export
    const stlBin = exp.exportSTL(geo, false);
    assert.ok(stlBin instanceof ArrayBuffer);
    assert.strictEqual(stlBin.byteLength > 84, true); // > 80 header + 4 bytes count
    console.log('  [PASS] MeshExporter.exportSTL (binary)');
    
    // voxelToGeometry con voxels mock
    const testVoxels = [
      {x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:1,z:0}
    ];
    const vgeo = exp.voxelToGeometry(testVoxels, 1.0, false);
    assert.ok(vgeo.getAttribute('position').count > 0);
    console.log('  [PASS] MeshExporter.voxelToGeometry');
    
    passed++;
  } catch (e) {
    failed++;
    console.log('  [FAIL] MeshExporter: ' + e.message);
  }

  // 7 - PhysicsCalc JS
  try {
    const { PhysicsCalc } = await loadESM('src/physics-calc.js');
    const mockMatDB = {
      get: (n) => ({ name: n, density: n === 'steel' ? 7850 : 2700 }),
      count: () => 2,
      getAll: () => []
    };
    const mockModSys = { getTree: () => ({ children: [] }) };
    const physics = new PhysicsCalc(mockMatDB, mockModSys);
    
    const mass = physics.voxelMass({ material: 'steel' }, 1.0);
    assert.ok(mass > 0 && mass < 100);
    console.log('  [PASS] PhysicsCalc.voxelMass');
    
    const weight = physics.voxelWeight({ material: 'steel' }, 1.0);
    assert.ok(weight > mass);
    console.log('  [PASS] PhysicsCalc.voxelWeight');
    
    const voxels = [
      { material: 'steel', x: 0, y: 0, z: 0 },
      { material: 'alu',   x: 1, y: 1, z: 1 }
    ];
    const result = physics.calculateAllVoxels(voxels);
    assert.strictEqual(result.voxelCount, 2);
    assert.ok(result.totalMass > 0);
    assert.ok(result.centerOfMass);
    assert.ok(result.inertia);
    console.log(`  [PASS] PhysicsCalc.calculateAllVoxels`);
    
    passed++;
  } catch (e) {
    failed++;
    console.log('  [FAIL] PhysicsCalc: ' + e.message);
  }

  // 8 - ScalingTool (struttural)

  
  console.log(`Results: ${passed}/${passed + failed} passed, ${failed} failed`);
  console.log('─'.repeat(50) + '\n');
  
  process.exit(failed === 0 ? 0 : 1);
}

runAll().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});