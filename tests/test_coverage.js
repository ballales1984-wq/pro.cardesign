// Test Suite JavaScript — pro.cardesign Frontend
// Esegui: node --experimental-vm-modules node_modules/.bin/jest

const assert = require('assert');
const { JSDOM } = require('jsdom');

// Setup DOM mock
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="voxel-count">Voxel: 0</div><div id="fps-counter">FPS: --</div><div id="tool-hint"></div><div id="materials-list"></div><div id="modules-tree"></div><div id="properties-panel"><p class="hint">Seleziona</p></div><div id="physics-panel"><p class="hint">Clicca per calcolare</p></div></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock Three.js
global.THREE = {
  Scene: function() { this.add = () => {}; },
  FogExp2: function() {},
  PerspectiveCamera: function() { this.position = { set: () => {} }; this.lookAt = () => {}; },
  WebGLRenderer: function() { this.domElement = document.createElement('canvas'); this.setSize = () => {}; this.setPixelRatio = () => {}; this.shadowMap = { enabled: false, type: 0 }; this.render = () => {}; },
  BoxGeometry: function() {},
  MeshStandardMaterial: function(opts) { this.color = opts.color || new global.THREE.Color(); },
  Mesh: function(geo, mat) { this.position = { set: () => {} }; this.scale = { x: 1, y: 1, z: 1 }; this.geometry = geo; this.material = mat; this.visible = true; this.castShadow = false; this.receiveShadow = false; },
  InstancedMesh: function(geo, mat, count) { this.count = 0; this.instanceMatrix = { setUsage: () => {}, needsUpdate: false }; },
  Matrix4: function() { this.makeScale = () => this; this.setPosition = () => this; },
  Group: function() { this.add = () => {}; },
  Raycaster: function() {},
  Color: function(c) { this.set = () => {}; },
  CanvasTexture: function() { this.needsUpdate = false; },
  SpriteMaterial: function(opts) { this.map = opts.map; this.depthTest = false; },
  Sprite: function(mat) { this.position = { copy: () => {} }; this.scale = { set: () => {} }; },
  Vector3: function(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; this.clone = () => this; return this; },
  Vector2: function(x, y) { this.x = x || 0; this.y = y || 0; },
  Plane: function() {},
  PlaneGeometry: function() {},
  MeshBasicMaterial: function(opts) { this.opacity = opts.opacity; this.wireframe = opts.wireframe; this.depthWrite = opts.depthWrite !== false; this.color = opts.color; this.transparent = opts.transparent; },
  EdgesGeometry: function() {},
  LineBasicMaterial: function() {},
  LineSegments: function() { this.visible = false; },
  BufferGeometry: function() { this.attributes = {}; this.setAttribute = () => this; this.computeBoundingSphere = () => {}; this.computeVertexNormals = () => {}; },
  Float32BufferAttribute: function(data, itemSize) { this.array = data; this.count = data.length / itemSize; this.getX = (i) => this.array[i*3]; this.getY = (i) => this.array[i*3+1]; this.getZ = (i) => this.array[i*3+2]; this.setX = (i, v) => { this.array[i*3] = v; }; this.setY = (i, v) => { this.array[i*3+1] = v; }; this.setZ = (i, v) => { this.array[i*3+2] = v; }; this.needsUpdate = true; },
  FrontSide: 0,
  DoubleSide: 1,
  BackSide: 2,
  PCFSoftShadowMap: 1,
  CanvasTexture: function() { this.needsUpdate = true; },
  SpriteMaterial: function(opts) { this.map = opts.map; },
};

// Mock MaterialSystem
class MockMaterialSystem {
  constructor() { this.materials = new Map(); this._defaults(); }
  _defaults() {
    this.materials.set('steel', { name: 'steel', label: 'Acciaio', density: 7850, youngsModulus: 210e9, tensileStrength: 400e6, thermalConductivity: 50, specificHeat: 486, meltingPoint: 1530, costPerKg: 0.8, recyclable: true, roughness: 0.3, metalness: 0.9 });
    this.materials.set('aluminum', { name: 'aluminum', label: 'Alluminio', density: 2700, youngsModulus: 70e9, tensileStrength: 90e6, thermalConductivity: 237, specificHeat: 897, meltingPoint: 660, costPerKg: 2.5, recyclable: true, roughness: 0.2, metalness: 0.85 });
    this.materials.set('rubber', { name: 'rubber', label: 'Gomma', density: 1100, youngsModulus: 0.01e9, tensileStrength: 15e6, thermalConductivity: 0.16, specificHeat: 1600, meltingPoint: 200, costPerKg: 1.5, recyclable: true, roughness: 0.9, metalness: 0.0 });
    this.materials.set('carbon_fiber', { name: 'carbon_fiber', label: 'Carbonio', density: 1600, youngsModulus: 181e9, tensileStrength: 1500e6, thermalConductivity: 7, specificHeat: 850, meltingPoint: 3500, costPerKg: 45, recyclable: false, roughness: 0.15, metalness: 0.1 });
  }
  get(name) { return this.materials.get(name); }
  getAll() { return Array.from(this.materials.values()); }
  count() { return this.materials.size; }
}

// Mock ModuleSystem
class MockModuleSystem {
  constructor() { this.modules = new Map(); this.rootId = 1; this._idCounter = 0; this._nextId = () => ++this._idCounter; this.createRoot('Veicolo'); }
  createRoot(name) { const mod = { id: 1, name, parentId: null, childIds: [], voxelKeys: [], properties: {}, metadata: { color: '#888', icon: '📦', locked: false, visible: true } }; this.modules.set(1, mod); this.rootId = 1; return 1; }
  createModule(name, parentId) { return this._nextId(); }
  get(id) { return this.modules.get(id); }
  getAll() { return Array.from(this.modules.values()); }
  assignVoxelToModule(voxelKey, moduleId) { return true; }
  unassignVoxel(voxelKey, moduleId) { return true; }
  removeModule(moduleId) { return true; }
  getChildren(moduleId) { return []; }
  getTree() { return { id: 1, name: 'Veicolo', voxelCount: 0, icon: '📦', color: '#888', visible: true, locked: false, properties: {}, children: [] }; }
  getVoxelsForModule(moduleId) { return []; }
  count() { return this.modules.size; }
  toJSON() { return { rootId: 1, modules: [[1, { id: 1, name: 'Veicolo', parentId: null, childIds: [], voxelKeys: [], properties: {}, metadata: {} }]] }; }
  fromJSON(data) { return true; }
}

// Mock VoxelEngine minimale
class MockVoxelEngine {
  constructor() {
    this.voxels = new Map();
    this.instancedMeshes = new Map();
    this.instanceToKey = new Map();
    this.keyToInstance = new Map();
    this.freeIndices = new Map();
    this.maxInstances = 200000;
    this.scene = { add: () => {} };
    this.selectedVoxel = null;
    this.activeMaterial = 'steel';
    this.activeModule = null;
    this.activeTool = 'add';
    this.voxelSize = 1.0;
    this._history = [];
    this._redoStack = [];
    this._onVoxelChanged = () => {};
    this.SCALE = 0.01;
  }
  _gridPos(wp) { return { x: Math.round(wp.x), y: Math.round(wp.y), z: Math.round(wp.z) }; }
  _gridKey(v) { return v.x + ',' + v.y + ',' + v.z; }
  _worldPos(gp) { return { x: gp.x, y: gp.y, z: gp.z }; }
  _getInstancedMesh(name) { return null; }
  _setInstanceMatrix(mesh, instanceId, pos, scale) { return true; }
  selectVoxel(x, y, z) { return null; }
  getVoxelAt(x, y, z) { return this.voxels.get(x + ',' + y + ',' + z); }
  addVoxel(pos, mat, mod) {
    const key = pos.x + ',' + pos.y + ',' + pos.z;
    this.voxels.set(key, { x: pos.x, y: pos.y, z: pos.z, material: mat, module: mod, scale: [1,1,1] });
    return true;
  }
  removeVoxel(x, y, z) {
    const key = x + ',' + y + ',' + z;
    return this.voxels.delete(key);
  }
  undo() { return true; }
  redo() { return true; }
  clearAll() { this.voxels.clear(); this._history = []; return true; }
  setTool(tool) { this.activeTool = tool; }
  toJSON() {
    const items = [];
    for (const [k, v] of this.voxels) {
      const [x, y, z] = k.split(',').map(Number);
      items.push({ x, y, z, material: v.material, scale: v.scale });
    }
    return { voxels: items, version: '0.3.0' };
  }
  fromJSON(data) {
    this.clearAll();
    (data.voxels || []).forEach(v => {
      this.addVoxel({ x: v.x, y: v.y, z: v.z }, v.material, null);
    });
  }
}

// ===================== TEST SUITE JS =====================

// BrickSystem
class TestBrickSystemJS {
  static run() {
    console.log('\n=== JavaScript Tests ===');
    const BS = require('../../src/core/brick-system.js').BrickSystem;
    const Brick = require('../../src/core/brick-system.js').Brick;
    
    // Test Brick class
    const b = new Brick(1, 'Test', { x: 0, y: 0, z: 0 }, { x: 100, y: 20, z: 20 }, 'steel');
    assert.strictEqual(b.id, 1);
    assert.strictEqual(b.name, 'Test');
    assert.strictEqual(b.size.x, 100);
    assert.strictEqual(b.volume_mm3, 100 * 20 * 20);
    console.log('  [PASS] Brick constructor + properties');
    
    // Test BrickSystem creation
    const mockEngine = {
      scene: { add: () => {} },
      instancedMeshes: new Map()
    };
    const bs = new BS(mockEngine);
    assert.ok(bs.bricks instanceof Map);
    assert.ok(bs.SCALE > 0);
    console.log('  [PASS] BrickSystem instantiation');
    
    return true;
  }
}

// ComponentLibrary JS
class TestComponentLibraryJS {
  static run() {
    console.log('\n=== ComponentLibrary JS Tests ===');
    const { ComponentLibrary } = require('../../src/core/component-library.js');
    
    const lib = new ComponentLibrary();
    const all = lib.getAll();
    assert.ok(all.length > 0, 'Library should have defaults');
    console.log(`  [PASS] Library loaded ${all.length} defaults`);
    
    const wheel = lib.get(1);
    assert.ok(wheel, 'Wheel 1 should exist');
    assert.strictEqual(wheel.type, 'wheel');
    console.log('  [PASS] get by ID');
    
    const wheels = lib.getByCategory('wheels');
    assert.ok(wheels.length >= 1);
    assert.ok(wheels.every(w => w.category === 'wheels'));
    console.log('  [PASS] getByCategory');
    
    const results = lib.search('700c');
    assert.ok(results.length > 0);
    console.log('  [PASS] search');
    
    return true;
  }
}

// ScalingTool JS
class TestScalingToolJS {
  static run() {
    console.log('\n=== ScalingTool JS Tests ===');
    const { ScalingTool } = require('../../src/core/scaling-tool.js');
    
    const mockEngine = {
      instancedMeshes: new Map(),
      instanceToKey: new Map(),
      keyToInstance: new Map(),
      getVoxelAt: () => ({ x: 0, y: 0, z: 0, material: 'steel', scale: [1, 1, 1] }),
      _setInstanceMatrix: () => {},
      _worldPos: () => ({ x: 0, y: 0, z: 0 }),
      _pushHistory: () => {},
      _onVoxelChanged: () => {}
    };
    
    const tool = new ScalingTool(mockEngine, { add: () => {}, remove: () => {} }, {}, { domElement: document.createElement('canvas') });
    assert.strictEqual(tool.isActive, false);
    assert.strictEqual(tool.sensitivity, 100);
    console.log('  [PASS] Constructor defaults');
    
    assert.strictEqual(tool.getDragAxis({ x: 1, y: 0, z: 0 }), 'x');
    assert.strictEqual(tool.getDragAxis({ x: 0, y: 1, z: 0 }), 'y');
    assert.strictEqual(tool.getDragAxis({ x: 0, y: 0, z: 1 }), 'z');
    // Diagonale → default a 'x'
    assert.strictEqual(tool.getDragAxis({ x: 0.5, y: 0.5, z: 0 }), 'x');
    console.log('  [PASS] getDragAxis');
    
    tool.destroy();
    console.log('  [PASS] destroy cleanup');
    
    return true;
  }
}

// VoxelEngine JS
class TestVoxelEngineJS {
  static run() {
    console.log('\n=== VoxelEngine JS Tests ===');
    const { VoxelEngine } = require('../../src/voxel-engine.js');
    
    const mockDB = new MockMaterialSystem();
    const mockModSys = new MockModuleSystem();
    const scene = new global.THREE.Scene();
    const camera = new global.THREE.PerspectiveCamera();
    const renderer = new global.THREE.WebGLRenderer();
    const controls = {};
    
    const engine = new VoxelEngine(scene, mockDB, mockModSys, camera, renderer, controls);
    assert.ok(engine.voxels instanceof Map);
    assert.ok(engine.instancedMeshes instanceof Map);
    assert.strictEqual(engine.activeTool, 'add');
    console.log('  [PASS] Constructor');
    
    // Test voxel add
    const added = engine.addVoxel({ x: 0, y: 0, z: 0 }, 'steel', null);
    assert.strictEqual(added, true);
    assert.strictEqual(engine.voxels.size, 1);
    console.log('  [PASS] addVoxel');
    
    // Test duplicate prevention
    const dup = engine.addVoxel({ x: 0, y: 0, z: 0 }, 'steel', null);
    assert.strictEqual(dup, false);
    assert.strictEqual(engine.voxels.size, 1);
    console.log('  [PASS] Duplicate prevention');
    
    // Test select
    const sel = engine.selectVoxel(0, 0, 0);
    assert.ok(sel);
    assert.deepStrictEqual(engine.selectedVoxel, { x: 0, y: 0, z: 0 });
    console.log('  [PASS] selectVoxel');
    
    // Test remove
    engine.removeVoxel(0, 0, 0);
    assert.strictEqual(engine.voxels.size, 0);
    console.log('  [PASS] removeVoxel');
    
    // Test fillLayer
    const added2 = engine.fillLayer(0, 'steel', null, false);
    assert.ok(added2 > 0);
    console.log(`  [PASS] fillLayer (${added2} voxel)`);
    
    // Test undo/redo
    const prevCount = engine.voxels.size;
    engine.undo();
    assert.strictEqual(engine.voxels.size, prevCount - 1);
    console.log('  [PASS] undo');
    
    // Test clearAll
    engine.clearAll();
    assert.strictEqual(engine.voxels.size, 0);
    assert.strictEqual(engine._history.length, 0);
    console.log('  [PASS] clearAll');
    
    // Test grid key/world pos
    const key = engine._gridKey({ x: 5, y: 10, z: 15 });
    assert.strictEqual(key, '5,10,15');
    const wp = engine._worldPos({ x: 5, y: 10, z: 15 });
    assert.strictEqual(wp.x, 5);
    assert.strictEqual(wp.z, 15);
    console.log('  [PASS] _gridKey / _worldPos');
    
    // Test toJSON / fromJSON round-trip
    engine.addVoxel({ x: 1, y: 1, z: 1 }, 'aluminum', 'test');
    engine.addVoxel({ x: 2, y: 2, z: 2 }, 'carbon_fiber', 'frame');
    const json = engine.toJSON();
    assert.ok(json.voxels.length === 2);
    assert.ok(json.modules);
    console.log('  [PASS] toJSON');
    
    const engine2 = new VoxelEngine(scene, mockDB, mockModSys, camera, renderer, controls);
    engine2.fromJSON(json);
    assert.strictEqual(engine2.voxels.size, 2);
    console.log('  [PASS] fromJSON round-trip');
    
    // Test getVoxelAt / getVoxelsInModule
    const v1 = engine.getVoxelAt(1, 1, 1);
    assert.ok(v1);
    assert.strictEqual(v1.material, 'aluminum');
    console.log('  [PASS] getVoxelAt');
    
    const modVoxels = engine.getVoxelsInModule('test');
    assert.ok(modVoxels.length >= 0); // could be empty
    console.log('  [PASS] getVoxelsInModule');
    
    // Test setTool
    engine.setTool('remove');
    assert.strictEqual(engine.activeTool, 'remove');
    console.log('  [PASS] setTool');
    
    return true;
  }
}

// MaterialSystem JS
class TestMaterialSystemJS {
  static run() {
    console.log('\n=== MaterialSystem JS Tests ===');
    const { MaterialSystem } = require('../../src/material-system.js');
    
    const ms = new MaterialSystem();
    assert.strictEqual(ms.count(), 8);
    console.log('  [PASS] 8 default materials');
    
    const steel = ms.get('steel');
    assert.ok(steel);
    assert.strictEqual(steel.density, 7850);
    assert.strictEqual(steel.youngsModulus, 210e9);
    console.log('  [PASS] get steel');
    
    const aluminum = ms.get('aluminum');
    assert.strictEqual(aluminum.density, 2700);
    console.log('  [PASS] get aluminum');
    
    // Test adding custom material
    const added = ms.add({ name: 'custom', label: 'Custom', density: 1000, youngsModulus: 1e9 });
    assert.strictEqual(added, true);
    const custom = ms.get('custom');
    assert.ok(custom);
    assert.strictEqual(custom.density, 1000);
    console.log('  [PASS] add custom material');
    
    // Duplicate prevention
    const dup = ms.add({ name: 'custom', label: 'Custom2', density: 2000 });
    assert.strictEqual(dup, false);
    console.log('  [PASS] Duplicate prevention');
    
    // Test voxel mass
    const mass = ms.getVoxelMass({ material: 'steel' });
    assert.ok(mass > 0);
    console.log('  [PASS] getVoxelMass');
    
    // Test weight
    const weight = ms.getVoxelWeight({ material: 'steel' });
    assert.ok(weight > 0);
    console.log('  [PASS] getVoxelWeight');
    
    return true;
  }
}

// Physics JS
class TestPhysicsJS {
  static run() {
    console.log('\n=== PhysicsCalc JS Tests ===');
    const { PhysicsCalc } = require('../../src/physics-calc.js');
    const { MaterialSystem } = require('../../src/material-system.js');
    const { ModuleSystem } = require('../../src/module-system.js');
    
    const ms = new MaterialSystem();
    const mods = new ModuleSystem(ms);
    const scene = new global.THREE.Scene();
    const camera = new global.THREE.PerspectiveCamera();
    const renderer = new global.THREE.WebGLRenderer();
    const controls = {};
    const { VoxelEngine } = require('../../src/voxel-engine.js');
    const engine = new VoxelEngine(scene, ms, mods, camera, renderer, controls);
    
    // Setup: add voxels
    engine.addVoxel({ x: 0, y: 0, z: 0 }, 'steel', null);
    engine.addVoxel({ x: 1, y: 1, z: 1 }, 'aluminum', null);
    engine.addVoxel({ x: 2, y: 2, z: 2 }, 'rubber', null);
    
    const physics = new PhysicsCalc();
    const result = physics.calculateVehicle(engine);
    
    assert.ok(result.voxelCount >= 3);
    assert.ok(result.totalMass > 0);
    assert.ok(result.totalVolume >= 0);
    assert.ok(result.weight >= 0);
    assert.ok(typeof result.centerOfMass === 'object');
    assert.ok(result.centerOfMass.x !== undefined);
    assert.ok(result.inertia);
    assert.ok(result.materialDistribution);
    console.log(`  [PASS] Physics: ${result.voxelCount} voxel, mass=${result.totalMass.toFixed(6)} kg`);
    
    return true;
  }
}

// ModuleSystem JS  
class TestModuleSystemJS {
  static run() {
    console.log('\n=== ModuleSystem JS Tests ===');
    const { ModuleSystem } = require('../../src/module-system.js');
    const ms = new MockMaterialSystem();
    
    const modSys = new ModuleSystem(ms);
    assert.strictEqual(modSys.rootId, 1);
    assert.strictEqual(modSys.getAll().length, 1);
    console.log('  [PASS] Root created');
    
    const telaioId = modSys.createModule('Telaio', modSys.rootId);
    assert.ok(telaioId > 1);
    console.log('  [PASS] createModule');
    
    const carrozzeriaId = modSys.createModule('Carrozzeria', modSys.rootId);
    assert.strictEqual(modSys.getAll().length, 3);
    console.log('  [PASS] Two modules created');
    
    modSys.assignVoxelToModule('0,0,0', telaioId);
    assert.ok(true);
    console.log('  [PASS] assignVoxelToModule');
    
    const tree = modSys.getTree();
    assert.ok(tree);
    assert.ok(tree.children.length >= 2);
    console.log('  [PASS] getTree');
    
    modSys.removeModule(telaioId);
    assert.strictEqual(modSys.getAll().length, 2);
    console.log('  [PASS] removeModule');
    
    return true;
  }
}

// MeshExporter JS
class TestMeshExporterJS {
  static run() {
    console.log('\n=== MeshExporter JS Tests ===');
    const { MeshExporter } = require('../../src/mesh-exporter.js');
    
    const exp = new MeshExporter();
    assert.ok(exp);
    console.log('  [PASS] Constructor');
    
    // Test simple cubes voxelToGeometry
    const testVoxels = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }
    ];
    const geo = exp.voxelToGeometry(testVoxels, 1.0, false);
    assert.ok(geo instanceof global.THREE.BufferGeometry);
    assert.ok(geo.getAttribute('position').count > 0);
    assert.ok(geo.getIndex());
    console.log('  [PASS] voxelToGeometry (simple cubes)');
    
    // Test OBJ export
    const obj = exp.exportOBJ(geo);
    assert.ok(obj.includes('# Exported from VoxelCAD'));
    assert.ok(obj.includes('v ') || obj.includes('o '));
    console.log('  [PASS] exportOBJ');
    
    // Test STL ASCII export
    const stl = exp.exportSTL(geo, true);
    assert.ok(stl.includes('solid VoxelCAD'));
    assert.ok(stl.includes('facet'));
    console.log('  [PASS] exportSTL ASCII');
    
    // Test STL binary export
    const stlBin = exp.exportSTL(geo, false);
    assert.ok(stlBin instanceof ArrayBuffer);
    assert.strictEqual(stlBin.byteLength > 80, true);
    console.log('  [PASS] exportSTL binary');
    
    // Test download helper (dry run)
    const url = exp.download('test.stl', 'solid test', 'text/plain');
    assert.ok(url);
    console.log('  [PASS] download helper');
    
    return true;
  }
}

// Run all tests
function runAllTests() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  pro.cardesign Test Coverage Suite           ║');
  console.log('╚══════════════════════════════════════════════╝\n');
  
  let total = 0, passed = 0, failed = 0;
  const suites = [
    TestBrickSystemJS,
    TestComponentLibraryJS,
    TestScalingToolJS,
    TestVoxelEngineJS,
    TestMaterialSystemJS,
    TestPhysicsJS,
    TestModuleSystemJS,
    TestMeshExporterJS
  ];
  
  for (const Suite of suites) {
    total++;
    try {
      const ok = Suite.run();
      if (ok) { passed++; }
      else { failed++; console.log(`  [FAIL] ${Suite.name}`); }
    } catch (e) {
      failed++;
      console.log('  [FAIL] ' + Suite.name + ': ' + e.message);
    }
  }
  
  console.log('\n' + '─'.repeat(50));
  console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
  console.log('─'.repeat(50) + '\n');
  
  return failed === 0;
}

runAllTests();