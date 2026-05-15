// Test Suite JavaScript — pro.cardesign Frontend (ESM dynamic import)
// Esegui con: node tests/test_coverage.js

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// ── Full DOM & browser-API Mock (no JSDOM needed) ───────────────────────────
function mockEl() {
  const handlers = {};
  return {
    addEventListener: (t, cb) => { if (cb) handlers[t] = cb; },
    removeEventListener: (t, cb) => { if (handlers[t] === cb) delete handlers[t]; },
    dispatchEvent: (e) => { const h = handlers[e.type] || handlers['*']; if (h) h(e); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    getPropertyValue: () => '',
    setProperty: () => {},
    style: { display: 'none', opacity: '' },
    textContent: '',
    value: '',
    href: '',
    appendChild: () => {},
    removeChild: () => {},
    children: [],
    parentElement: null,
    classList: { add: () => {}, remove: () => {} },
  };
}

function mockDocAndGlobals() {
  const canvas = Object.assign(mockEl(), {
    width: 800, height: 600,
    getContext: () => ({
      fillText: () => {},
      fillRect: () => {},
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    }),
  });
  const div = mockEl();

  global.document = {
    createElement: () => {
      const e = mockEl();
      e.getContext = () => ({
        font: '', fillStyle: '', textAlign: '', textBaseline: '',
        fillText: () => {}, fillRect: () => {},
      });
      return e;
    },
    getElementById: () => Object.assign({}, div, { textContent: '', style: { display: 'none' }, value: '', addEventListener: () => {} }),
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: Object.assign(mockEl(), { appendChild: () => {}, removeChild: () => {} }),
    createElementNS: () => canvas,
  };
  global.window = global;
  global.navigator = global.document.navigator || {};
  global.HTMLCanvasElement = function(){};
  global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  global.setTimeout = setTimeout;
  global.clearTimeout = clearTimeout;
  global.performance = { now: () => Date.now() };
}

mockDocAndGlobals();

// ── Minimal THREE.js mock (only what the tests touch) ────────────────────────
(function buildThreeMock() {
  const v3 = (x=0,y=0,z=0) => ({ x, y, z, set(){}, copy(){}, clone(){}, add(){}, multiplyScalar(){}, sub(){}, normalize(){}, cross(){}, dot(){}, length(){}, distanceTo(){}, applyMatrix4(){}, angleTo(){}, lerp(){} });
  const v2 = (x=0,y=0) => ({ x, y });

  function Vec3(x=0,y=0,z=0){ return v3(x,y,z); }
  function Vec2(x=0,y=0){ return v2(x,y); }

  global.THREE = {
    Scene: function(){ this.add=_=>{}; this.children=[]; },
    FogExp2: function(){},
    PerspectiveCamera: function(){ this.position={ set:_=>{}, copy:_=>{}, x:0,y:0,z:0 }; this.lookAt=_=>{}; this.aspect=1; this.updateProjectionMatrix=_=>{}; },
    WebGLRenderer: function(){ this.domElement=global.document.createElement('canvas'); this.setSize=_=>{}; this.setPixelRatio=_=>{}; this.shadowMap={ enabled:false, type:1 }; this.render=_=>{}; },
    BoxGeometry: function(){ this.dispose=_=>{}; return this; },
    PlaneGeometry: function(){ this.dispose=_=>{}; return this; },
    SphereGeometry: function(){ this.dispose=_=>{}; return this; },
    CylinderGeometry: function(){ this.dispose=_=>{}; return this; },
    EdgesGeometry: function(geo){ this.geometry=geo; this.dispose=_=>{}; return this; },
    MeshStandardMaterial: function(opts){ this.color=opts.color||0xffffff; this.roughness=opts.roughness||0.4; this.metalness=opts.metalness||0.3; this.opacity=opts.opacity||1; this.transparent=false; this.wireframe=false; this.name=''; this.depthWrite=true; },
    MeshBasicMaterial: function(opts){ this.color=opts.color||0xffffff; this.opacity=opts.opacity||1; this.transparent=false; this.wireframe=false; this.depthWrite=true; },
    LineBasicMaterial: function(opts){ this.color=opts.color||0; },
    Mesh: function(geo,mat){ this.geometry=geo||{}; this.material=mat; this.position=v3(); this.scale=v3(); this.visible=true; this.castShadow=false; this.receiveShadow=false; this.userData={}; this.add=_=>{}; this.add=this.add; },
    LineSegments: function(geo,mat){ this.geometry=geo; this.material=mat; this.position=v3(); this.visible=true; },
    Sprite: function(mat){ this.position=v3(); this.scale=v3(); this.material=mat; },
    InstancedMesh: function(geo,mat,count){ this.count=count||0; this.instanceMatrix={ setUsage:_=>{}, needsUpdate:false }; this.frustumCulled=true; this.castShadow=false; this.receiveShadow=false; },

    InstancedBufferAttribute: function(arr, itemSize){ this.array=arr; this.count=arr.length/itemSize; this._needsUpdate=false;
      const self=this;
      Object.defineProperty(this,'needsUpdate',{ get(){return self._needsUpdate;}, set(v){self._needsUpdate=v;} });
    },

    Matrix4: function(){ this.elements=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; this.makeScale=(sx,sy,sz)=>{ this.elements[0]=sx; this.elements[5]=sy; this.elements[10]=sz; return this; }; this.setPosition=()=>this; this.set=(v)=>{ this.elements[12]=v.x||0; this.elements[13]=v.y||0; this.elements[14]=v.z||0; return this; }; this.decompose=()=>{ const e=this.elements; return [new Vec3(e[12],e[13],e[14]), new Vec3(e[0],e[5],e[10]), this]; }; return this; },
    Group: function(){ this.add=_=>{}; this.children=[]; },
    Raycaster: function(){ this.ray={}; this.intersectObjects=()=>[]; this.setFromCamera=()=>{}; this.intersectObject=(obj,rec)=>{ return []; }; this.linePrecision=1; },
    Color: function(c){ this.r=c; this.g=c; this.b=c; this.set=_=>{}; this.getHex=()=>c; },
    CanvasTexture: function(){ this.needsUpdate=false; this._canvas={width:128,height:64}; },
    SpriteMaterial: function(opts){ this.map=opts.map; this.depthTest=opts.depthTest!==false; },
    Euler: function(x,y,z){ this.x=x; this.y=y; this.z=z; this.set=_=>{}; },
    Vector3: Vec3,
    Vector2: Vec2,
    BufferGeometry: function(){
      this.attributes = {};
      this.index = null;
      this.groups = [];

      function _mkIndex(arr) {
        // Wrap plain array so real THREE-like callers can call getX/i/i+1/i+2
        const _arr = new Float32Array(arr);
        const attr = { count: _arr.length, array: _arr,
          getX: i => _arr[i], getY: i => i < _arr.length ? _arr[i+1] : 0, getZ: i => i < _arr.length ? _arr[i+2] : 0 };
        return attr;
      }

this.setAttribute = (name, attr) => {
         if (attr.count === undefined) attr.count = (attr.array ? attr.array.length / (attr.itemSize || 3) : 0);
         this.attributes[name] = attr;
         return attr;
       };
       this.getAttribute = (name) => this.attributes[name] || null;
       this.setIndex = (idx) => { this.index = _mkIndex(idx); };
       this.getIndex = () => this.index;
       this.getnormal = () => null;
       this.getuv = () => null;

      this.computeBoundingSphere = function(){ this.boundingSphere={ getCenter:_=>new Vec3(), radius:1 }; };
      this.computeVertexNormals = function(){};
      this.dispose = function(){};
      return this;
    },
    Float32BufferAttribute: function(arr, itemSize){
      this.array = Array.isArray(arr) ? new Float32Array(arr) : arr;
      this.itemSize = itemSize;
      this.count = this.array.length / itemSize;
      this._needsUpdate = false;
      const self = this;
      Object.defineProperty(this, 'needsUpdate', {
        get() { return self._needsUpdate; },
        set(v) { self._needsUpdate = v; },
      });

      // Indexed accessor matching THREE.js BufferedAttribute API
      function gx(i) { return self.array[i * self.itemSize]; }
      function gy(i) { return i < self.array.length / self.itemSize ? self.array[i * self.itemSize + 1] : 0; }
      function gz(i) { return i < self.array.length / self.itemSize ? self.array[i * self.itemSize + 2] : 0; }
      this.getX = gx; this.getY = gy; this.getZ = gz;

      return this;
    },
    DoubleSide: 1, FrontSide: 0, BackSide: 2,
    PCFSoftShadowMap: 1, BasicShadowMap: 0,
    NoBlending: 0, AdditiveBlending: 1, NormalBlending: 2,
    Clock: function(){ this.getDelta=()=>0.016; this.getElapsedTime=()=>0; },
    Plane: function(){},
    PlaneGeometry: function(){ return new global.THREE.BufferGeometry(); },
    DynamicDrawUsage: 35048,
    ReusableShadowMaps: {},
  };
})();

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadESM(relPath) {
  const full = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(full)) throw new Error(`Not found: ${full}`);
  return import('file://' + full);
}

async function runAll() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     pro.cardesign JavaScript Test Coverage        ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  let passed = 0, failed = 0;
  const timing = [];

  function runTest(name, fn) {
    const t0 = Date.now();
    try {
      fn();
      const ms = Date.now() - t0;
      console.log(`  [PASS] ${name} (${ms}ms)`);
      passed++;
      timing.push({ name, ok: true, ms });
    } catch(e) {
      const ms = Date.now() - t0;
      console.log(`  [FAIL] ${name}: ${e.message} (${ms}ms)`);
      failed++;
      timing.push({ name, ok: false, ms, err: e.message });
      // If a test hangs, we know which one
      if (ms > 8000) {
        console.log(`       ^^^ HUNG for ${ms}ms — infinite loop suspected`);
      }
    }
  }

  // ── 1. MaterialSystem ──────────────────────────────────────────────────────
  try {
    const { MaterialSystem } = await loadESM('src/material-system.js');
    runTest('MaterialSystem (import)', () => {
      const ms = new MaterialSystem();
      assert.strictEqual(ms.count(), 8);
      const steel = ms.get('steel');
      assert.strictEqual(steel.density, 7850);
      assert.strictEqual(ms.getVoxelMass({ material: 'steel' }) > 0, true);
    });
  } catch(e) { failed++; console.log('  [FAIL] MaterialSystem import: ' + e.message); }

  // ── 2. ModuleSystem ────────────────────────────────────────────────────────
  try {
    const { ModuleSystem } = await loadESM('src/module-system.js');
    runTest('ModuleSystem', () => {
      const ms = new ModuleSystem({ get: ()=> ({}) , count: ()=> 8 });
      assert.strictEqual(ms.count(), 1);
      const id = ms.createModule('Telaio', ms.rootId);
      assert.ok(id > 1);
      const tree = ms.getTree();
      assert.ok(tree);
    });
  } catch(e) { failed++; console.log('  [FAIL] ModuleSystem import: ' + e.message); }

  // ── 3. Brick ───────────────────────────────────────────────────────────────
  try {
    const { Brick, BrickSystem } = await loadESM('src/core/brick-system.js');
    runTest('Brick', () => {
      const b = new Brick(1, 'Test', {x:0,y:0,z:0}, {x:100,y:20,z:20});
      assert.strictEqual(b.volume_mm3, 100 * 20 * 20);
    });
    runTest('Brick center', () => {
      const b = new Brick(2, 'C2', {x:0,y:0,z:0}, {x:100,y:20,z:20});
      assert.strictEqual(b.center.x, 50);
      assert.strictEqual(b.center.y, 10);
      assert.strictEqual(b.center.z, 10);
    });
  } catch(e) { failed++; console.log('  [FAIL] Brick import: ' + e.message); }

  // ── 4. ComponentLibrary ────────────────────────────────────────────────────
  try {
    const { ComponentLibrary } = await loadESM('src/core/component-library.js');
    runTest('ComponentLibrary', () => {
      const lib = new ComponentLibrary();
      assert.ok(lib.getAll().length > 0);
      assert.ok(lib.get(1));
      assert.ok(lib.search('700c').length > 0);
      assert.ok(lib.getByCategory('wheels').length > 0);
    });
  } catch(e) { failed++; console.log('  [FAIL] ComponentLibrary import: ' + e.message); }

  // ── 5. BrickAdapter ────────────────────────────────────────────────────────
  try {
    const { BrickAdapter } = await loadESM('src/core/brick-adapter.js');
    runTest('BrickAdapter export', () => {
      assert.ok(typeof BrickAdapter === 'function');
    });
  } catch(e) { failed++; console.log('  [FAIL] BrickAdapter import: ' + e.message); }

  // ── 6. MeshExporter ────────────────────────────────────────────────────────
  try {
    const { MeshExporter } = await loadESM('src/mesh-exporter.js');
    runTest('MeshExporter.exportOBJ', () => {
      const exp = new MeshExporter();
      const geo = new THREE.BufferGeometry();
      const pos = new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0], 3);
      geo.setAttribute('position', pos);
      geo.setIndex([0,1,2]);
      geo.computeBoundingSphere();
      const obj = exp.exportOBJ(geo);
      assert.ok(obj.includes('v 0.000000'), 'OBJ should contain vertex 0');
      assert.ok(obj.includes('f 1'), 'OBJ should contain faces');
    });

    runTest('MeshExporter.exportSTL (ASCII)', () => {
      const exp = new MeshExporter();
      const geo = new THREE.BufferGeometry();
      const pos = new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0], 3);
      geo.setAttribute('position', pos);
      geo.setIndex([0,1,2]);
      const stl = exp.exportSTL(geo, true);
      assert.ok(stl.includes('solid VoxelCAD'));
      assert.ok(stl.includes('facet'));
    });

    runTest('MeshExporter.exportSTL (binary)', () => {
      const exp = new MeshExporter();
      const geo = new THREE.BufferGeometry();
      const pos = new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0], 3);
      geo.setAttribute('position', pos);
      geo.setIndex([0,1,2]);
      const stl = exp.exportSTL(geo, false);
      assert.ok(stl instanceof ArrayBuffer);
      assert.strictEqual(stl.byteLength > 84, true);
    });

    runTest('MeshExporter.voxelToGeometry', () => {
      const exp = new MeshExporter();
      const voxels = [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:0,y:1,z:0}];
      const vgeo = exp.voxelToGeometry(voxels, 1.0, false);
      assert.ok(vgeo.attributes.position.count > 0, 'Must have positions');
    });
  } catch(e) { failed++; console.log('  [FAIL] MeshExporter import: ' + e.message); }

  // ── 7. PhysicsCalc ─────────────────────────────────────────────────────────
  try {
    const { PhysicsCalc } = await loadESM('src/physics-calc.js');
    runTest('PhysicsCalc.voxelMass', () => {
      const mockMatDB = { get: (n)=>({name:n, density: n==='steel'?7850:2700}), count:()=>2, getAll:()=>[] };
      const mockModSys = { getTree: ()=>({children:[]}) };
      const physics = new PhysicsCalc(mockMatDB, mockModSys);
      const mass = physics.voxelMass({material:'steel'}, 1.0);
      assert.ok(mass > 0 && mass < 100);
    });

    runTest('PhysicsCalc.voxelWeight', () => {
      const mockMatDB = { get: (n)=>({name:n, density: n==='steel'?7850:2700}), count:()=>2, getAll:()=>[] };
      const mockModSys = { getTree: ()=>({children:[]}) };
      const physics = new PhysicsCalc(mockMatDB, mockModSys);
      const weight = physics.voxelWeight({material:'steel'}, 1.0);
      assert.ok(weight > 0);
    });

    runTest('PhysicsCalc.calculateAllVoxels', () => {
      const mockMatDB = { get: (n)=>({name:n, density: n==='steel'?7850:2700}), count:()=>2, getAll:()=>[] };
      const mockModSys = { getTree: ()=>({children:[]}) };
      const physics = new PhysicsCalc(mockMatDB, mockModSys);
      const voxels = [{material:'steel',x:0,y:0,z:0}, {material:'steel',x:1,y:1,z:1}];
      const result = physics.calculateAllVoxels(voxels);
      assert.strictEqual(result.voxelCount, 2);
      assert.ok(result.totalMass > 0);
      assert.ok(result.centerOfMass);
      assert.ok(result.inertia);
    });
  } catch(e) { failed++; console.log('  [FAIL] PhysicsCalc import: ' + e.message); }

  // ── Summary ────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\nResults: ${passed}/${total} passed, ${failed} failed`);
  console.log('─'.repeat(50));

  const slowest = [...timing].sort((a,b)=>b.ms-a.ms).slice(0,3);
  if (slowest.length > 0 && slowest[0].ms > 500) {
    console.log('\nSlowest tests:');
    slowest.forEach(t => {
      console.log(`  ${t.ok?'[PASS]':'[FAIL]'} ${t.name}: ${t.ms}ms`);
    });
  }

  console.log();
  process.exit(failed === 0 ? 0 : 1);
}

runAll().catch(e => { console.error('Fatal:', e); process.exit(1); });
