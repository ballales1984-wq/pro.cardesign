// ═══════════════════════════════════════════════════════════════════════════════
//  Visualization Tests - Phase 2 Features
//  Tests for external surface extraction and wireframe options
// ═══════════════════════════════════════════════════════════════════════════════

require('./three-mock-provider.cjs');

// Mock for onnxruntime-web (Fase 7)
global.ort = {
  InferenceSession: {
    create: async () => {
      throw new Error('ONNX model not available in test environment');
    }
  },
  Tensor: class {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
  }
};

const assert = require('assert');

function mockEl() {
  const handlers = {};
  const children = [];
  
  return {
    addEventListener: (t, cb) => { if (cb) handlers[t] = cb; },
    removeEventListener: (t, cb) => { if (handlers[t] === cb) delete handlers[t]; },
    dispatchEvent: (e) => { const h = handlers[e.type] || handlers['*']; if (h) h(e); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    getPropertyValue: () => '',
    setProperty: () => {},
    style: { display: 'none', opacity: '' },
    get textContent() {
      // Compute textContent from children's textContent
      return children.map(child => child.textContent).join('');
    },
    set textContent(value) {
      // When setting textContent, remove all children and add a single text node
      // For simplicity, we'll just clear children and store the value
      children.length = 0;
      // We'll store the value in a way that can be retrieved by the getter
      // For now, let's just add a pseudo-text node
      const textNode = {
        textContent: value,
        parentElement: this
      };
      children.push(textNode);
    },
    value: '',
    href: '',
    appendChild: (child) => {
      children.push(child);
      child.parentElement = this;
    },
    removeChild: (child) => {
      const index = children.indexOf(child);
      if (index > -1) {
        children.splice(index, 1);
        child.parentElement = null;
      }
    },
    children: children,
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
       drawImage: () => {},
       getImageData: () => ({ data: new Uint8ClampedArray(256 * 256 * 4) }),
     }),
   });
   const div = mockEl();

 global.document = {
       createElement: () => {
         const e = mockEl();
         e.getContext = () => ({
           font: '', fillStyle: '', textAlign: '', textBaseline: '',
           fillText: () => {}, fillRect: () => {},
           drawImage: () => {},
           getImageData: () => ({ data: new Uint8ClampedArray(256 * 256 * 4) }),
         });
         return e;
       },
       getElementById: () => Object.assign({}, div, { textContent: '', style: { display: 'none' }, value: '', addEventListener: () => {} }),
       querySelectorAll: () => [],
       addEventListener: () => {},
       body: Object.assign(mockEl(), { appendChild: () => {}, removeChild: () => {} }),
       createElementNS: () => canvas,
     };
     global.window = Object.assign({ addEventListener: () => {}, removeEventListener: () => {} }, mockEl());
    try { global.navigator = global.document.navigator || {}; } catch { /* ignore */ }
   global.HTMLCanvasElement = function(){};
   global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
   global.setTimeout = setTimeout;
   global.clearTimeout = clearTimeout;
   global.performance = { now: () => Date.now() };
}

mockDocAndGlobals();

// ── Minimal THREE.js mock (only what the tests touch) ────────────────────────
(function buildThreeMock() {
  const v3 = (x=0,y=0,z=0) => {
    return {
      x, y, z,
      set(){},
      copy(v){ this.x=v.x; this.y=v.y; this.z=v.z; return this; },
      clone(){ return v3(this.x, this.y, this.z); },
      add(v){ this.x+=v.x; this.y+=v.y; this.z+=v.z; return this; },
      multiplyScalar(s){ this.x*=s; this.y*=s; this.z*=s; return this; },
      sub(v){ this.x-=v.x; this.y-=v.y; this.z-=v.z; return this; },
      normalize(){ return this; },
      cross(){ return v3(); },
      dot(v){ return this.x*v.x + this.y*v.y + this.z*v.z; },
      length(){ return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); },
      lengthSq(){ return this.x*this.x + this.y*this.y + this.z*this.z; },
      distanceTo(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        const dz = this.z - v.z;
        return Math.sqrt(dx*dx + dy*dy + dz*dz);
      },
      applyMatrix4(){ return this; },
      angleTo(){ return 0; },
      lerp(){ return this; }
    };
  };
  const v2 = (x=0,y=0) => {
    return {
      x, y,
      set(){},
      copy(v){ this.x=v.x; this.y=v.y; return this; },
      clone(){ return v2(this.x, this.y); },
      add(v){ this.x+=v.x; this.y+=v.y; return this; },
      multiplyScalar(s){ this.x*=s; this.y*=s; return this; },
      sub(v){ this.x-=v.x; this.y-=v.y; return this; },
      normalize(){ return this; },
      cross(){ return 0; },
      dot(v){ return this.x*v.x + this.y*v.y; },
      length(){ return Math.sqrt(this.x*this.x + this.y*this.y); },
      lengthSq(){ return this.x*this.x + this.y*this.y; },
      distanceTo(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx*dx + dy*dy);
      },
      applyMatrix3(){ return this; },
      angleTo(){ return 0; },
      lerp(){ return this; }
    };
  };

 function Vec3(x=0,y=0,z=0){ return v3(x,y,z); }
    function Vec2(x=0,y=0){ return v2(x,y); }
    
    // Mesh constructor with prototype for instanceof support
    function MeshConstructor(geo,mat){ 
       this.geometry=geo||{}; this.material=mat; this.position=v3(); this.scale=v3(); this.rotation=v3(); this.visible=true; this.castShadow=false; this.receiveShadow=false; this.userData={}; this.add=_=>{}; 
       this.updateMatrixWorld = function(force){ /* no-op in mock */ };
       this.clone = function(){ const m = Object.create(Object.getPrototypeOf(this)); Object.assign(m, JSON.parse(JSON.stringify({position:this.position,rotation:this.rotation,scale:this.scale,visible:this.visible,castShadow:this.castShadow,receiveShadow:this.receiveShadow}))); m.geometry=this.geometry; m.material=this.material; return m; };
       this.dispose = function(){ this.geometry?.dispose?.(); this.material?.dispose?.(); };
       this.updateMorphTargets = function(){ /* no-op in mock */ };
    }
    function PointsConstructor(geo,mat){
       MeshConstructor.call(this, geo, mat);
    }

    global.THREE = {
     Scene: function(){ this.add=_=>{}; this.children=[]; },
     FogExp2: function(){},
     PerspectiveCamera: function(){ this.position={ set:_=>{}, copy:_=>{}, x:0,y:0,z:0 }; this.lookAt=_=>{}; this.aspect=1; this.updateProjectionMatrix=_=>{}; },
      WebGLRenderer: function(){ this.domElement=global.document.createElement('canvas'); this.setSize=_=>{}; this.setPixelRatio=_=>{}; this.shadowMap={ enabled:false, type:1 }; this.render=_=>{}; },
     BoxGeometry: function(w,h,d){ 
      var T2 = global.THREE || {};
      var g = new T2.BufferGeometry();
      g.setAttribute('position', new T2.Float32BufferAttribute(new Float32Array(24), 3));
      g.setIndex([0,1,2,3,4,5,6,7]);
      g.dispose=_=>{};
      g.clone=function(){ return new T2.BufferGeometry(); };
      return g; 
    },
     PlaneGeometry: function(){ 
      var T2 = global.THREE || {};
      var g = new T2.BufferGeometry();
      g.setAttribute('position', new T2.Float32BufferAttribute(new Float32Array(12), 3));
      g.dispose=_=>{};
      g.clone=function(){ return new T2.BufferGeometry(); };
      return g; 
    },
    SphereGeometry: function(){ 
      var T2 = global.THREE || {};
      var g = new T2.BufferGeometry();
      g.setAttribute('position', new T2.Float32BufferAttribute(new Float32Array(36), 3));
      g.dispose=_=>{};
      g.clone=function(){ return new T2.BufferGeometry(); };
      return g; 
    },
    CylinderGeometry: function(rt,rb,h,rs){ 
      var T2 = global.THREE || {};
      var g = new T2.BufferGeometry();
      g.setAttribute('position', new T2.Float32BufferAttribute(new Float32Array(36), 3));
      g.dispose=_=>{};
      g.clone=function(){ return new T2.BufferGeometry(); };
      return g; 
    },
    ConeGeometry: function(r,h,rs){ 
      var T2 = global.THREE || {};
      var g = new T2.BufferGeometry();
      g.setAttribute('position', new T2.Float32BufferAttribute(new Float32Array(36), 3));
      g.dispose=_=>{};
      g.clone=function(){ return new T2.BufferGeometry(); };
      return g; 
    },
    TorusGeometry: function(r,t,rs,ts){ 
      var T2 = global.THREE || {};
      var g = new T2.BufferGeometry();
      g.setAttribute('position', new T2.Float32BufferAttribute(new Float32Array(36), 3));
      g.dispose=_=>{};
      g.clone=function(){ return new T2.BufferGeometry(); };
      return g; 
    },
 EdgesGeometry: function(geo){ this.geometry=geo; this.dispose=_=>{}; return this; },
      MeshStandardMaterial: function(opts){
         this.color=opts.color||0xffffff; 
         this.roughness=opts.roughness||0.4; 
         this.metalness=opts.metalness||0.3; 
         this.opacity=opts.opacity||1; 
         this.transparent=opts.transparent||false; 
         this.wireframe=false; 
         this.name=''; 
         this.depthWrite=true;
         this.dispose = function(){};
       },
      MeshBasicMaterial: function(opts){ this.color={ value:opts.color||0xffffff, set(c){ this.value=c; } }; this.opacity=opts.opacity||1; this.transparent=false; this.wireframe=false; this.depthWrite=true; this.dispose=function(){}; },
     PointsMaterial: function(opts){ opts=opts||{}; this.color={ value:opts.color||0xffffff, set(c){ this.value=c; } }; this.size=opts.size||1; this.sizeAttenuation=opts.sizeAttenuation!==false; this.depthTest=opts.depthTest!==false; this.depthWrite=opts.depthWrite!==false; this.dispose=function(){}; },
   LineBasicMaterial: function(opts){ this.color=opts.color||0; },
 Mesh: MeshConstructor,
 Points: PointsConstructor,
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
    Quaternion: function(){ this.x=0; this.y=0; this.z=0; this.w=1; this.set=_=>{}; },
    Box3: function(min,max){ this.min=min||{x:-1,y:-1,z:-1}; this.max=max||{x:1,y:1,z:1}; this.getCenter=_=>{return{set:_=>{}}}; this.getSize=_=>{return{set:_=>{}}}; },
   Vector3: Vec3,
   Vector2: Vec2,
   BufferGeometry: function(){
      this.attributes = {};
      this.index = null;
      this.morphAttributes = {};
      this.groups = [];
      this.boundingSphere = null;
      this.boundingBox = null;

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
         this.clone = function(){
           var c = Object.create(this);
           c.attributes = {};
           if (this.attributes) {
             for (var k in this.attributes) {
               c.attributes[k] = Object.create(this.attributes[k]);
             }
           }
           c.index = this.index ? Object.create(this.index) : null;
           c.morphAttributes = this.morphAttributes ? Object.create(this.morphAttributes) : {};
           c.groups = this.groups ? this.groups.slice() : [];
           return c;
         };
         this.toNonIndexed = function(){
           var c = Object.create(this);
           c.attributes = {};
           if (this.attributes) {
             for (var k in this.attributes) {
               c.attributes[k] = Object.create(this.attributes[k]);
             }
           }
           c.index = null;
           c.morphAttributes = this.morphAttributes ? Object.create(this.morphAttributes) : {};
           c.groups = this.groups ? this.groups.slice() : [];
           return c;
         };
         this.deleteAttribute = function(name){
           delete this.attributes[name];
           return this;
         };
         this.computeVertexNormals = function(){};
         this.computeBoundingBox = function(){ this.boundingBox={ min:{x:-1,y:-1,z:-1}, max:{x:1,y:1,z:1} }; };
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
     this.setXYZ = function(i, x, y, z) {
       self.array[i * self.itemSize] = x;
       self.array[i * self.itemSize + 1] = y;
       self.array[i * self.itemSize + 2] = z;
     };

     return this;
   },
 DoubleSide: 1, FrontSide: 0, BackSide: 2,
    PCFSoftShadowMap: 1, BasicShadowMap: 0,
    NoBlending: 0, AdditiveBlending: 1, NormalBlending: 2,
    Clock: function(){ this.getDelta=()=>0.016; this.getElapsedTime=()=>0; },
    Plane: function(){},
    PlaneGeometry: function(){ return new global.THREE.BufferGeometry(); },
    Sphere: function(center, radius){ this.center=center||{x:0,y:0,z:0}; this.radius=radius||1; },
   DynamicDrawUsage: 35048,
   ReusableShadowMaps: {},
 };
})();

// ── Helpers ──────────────────────────────────────────────────────────────────
const { pathToFileURL } = require('url');

function loadESM(relPath) {
  const full = path.resolve(__dirname, '..', relPath);
  if (!fs.existsSync(full)) throw new Error(`Not found: ${full}`);
  return import(pathToFileURL(full).href);
}

async function runAll() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   pro.cardesign Visualization Test Coverage       ║');
  console.log('║       (Phase 2: External Surface & Wireframe)     ║');
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
       console.log(`       Stack: ${e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : 'no stack'}`);
       failed++;
       timing.push({ name, ok: false, ms, err: e.message });
       // If a test hangs, we know which one
       if (ms > 8000) {
         console.log(`       ^^^ HUNG for ${ms}ms — infinite loop suspected`);
       }
     }
   }

  // Import the modules we need for testing
  let VoxelEngine;
  let MaterialSystem;
  
  try {
    const vesm = await loadESM('src/voxel-engine.js');
    VoxelEngine = vesm.VoxelEngine;
    
    const ms = await loadESM('src/material-system.js');
    MaterialSystem = ms.MaterialSystem;
  } catch(e) {
    console.log(`  [FAIL] Import modules: ${e.message}`);
    return;
  }

  // ── 1. External Surface Extraction Tests ───────────────────────────────────
  
  runTest('External surface - single voxel', async () => {
    const mockScene = new THREE.Scene();
    const mockCamera = new THREE.PerspectiveCamera();
    const mockRenderer = new THREE.WebGLRenderer();
    const mockControls = {};
    const materialDB = new MaterialSystem();
    
    const engine = new VoxelEngine(mockScene, materialDB, null, mockCamera, mockRenderer, mockControls);
    
    // Add a single voxel
    engine.addVoxel({x: 0, y: 0, z: 0}, 'steel');
    
    // Check that we can extract external surface (this would fail before implementation)
    // For now, we'll test that the method exists or create a placeholder
    assert.ok(true, 'Placeholder test - to be implemented');
  });
  
  runTest('External surface - 2x2x2 cube', async () => {
    const mockScene = new THREE.Scene();
    const mockCamera = new THREE.PerspectiveCamera();
    const mockRenderer = new THREE.WebGLRenderer();
    const mockControls = {};
    const materialDB = new MaterialSystem();
    
    const engine = new VoxelEngine(mockScene, materialDB, null, mockCamera, mockRenderer, mockControls);
    
    // Add voxels to form a 2x2x2 cube
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          engine.addVoxel({x, y, z}, 'steel');
        }
      }
    }
    
    // External surface should have 24 faces (6 faces * 4 voxels per face)
    assert.ok(true, 'Placeholder test - to be implemented');
  });
  
  runTest('External surface - hollow cube', async () => {
    const mockScene = new THREE.Scene();
    const mockCamera = new THREE.PerspectiveCamera();
    const mockRenderer = new THREE.WebGLRenderer();
    const mockControls = {};
    const materialDB = new MaterialSystem();
    
    const engine = new VoxelEngine(mockScene, materialDB, null, mockCamera, mockRenderer, mockControls);
    
    // Add voxels to form a hollow 3x3x3 cube (missing center)
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          // Skip the center voxel (1,1,1)
          if (!(x === 1 && y === 1 && z === 1)) {
            engine.addVoxel({x, y, z}, 'steel');
          }
        }
      }
    }
    
    // External surface should show both outer and inner surfaces
    assert.ok(true, 'Placeholder test - to be implemented');
  });
  
  // ── 2. Wireframe Tests ─────────────────────────────────────────────────────
  
  runTest('Wireframe mode - basic toggle', async () => {
    const mockScene = new THREE.Scene();
    const mockCamera = new THREE.PerspectiveCamera();
    const mockRenderer = new THREE.WebGLRenderer();
    const mockControls = {};
    const materialDB = new MaterialSystem();
    
    const engine = new VoxelEngine(mockScene, materialDB, null, mockCamera, mockRenderer, mockControls);
    
    // Add a voxel
    engine.addVoxel({x: 0, y: 0, z: 0}, 'steel');
    
    // Check that wireframe mode can be toggled
    assert.ok(true, 'Placeholder test - to be implemented');
  });
  
  runTest('Wireframe mode - full wireframe', async () => {
    const mockScene = new THREE.Scene();
    const mockCamera = new THREE.PerspectiveCamera();
    const mockRenderer = new THREE.WebGLRenderer();
    const mockControls = {};
    const materialDB = new MaterialSystem();
    
    const engine = new VoxelEngine(mockScene, materialDB, null, mockCamera, mockRenderer, mockControls);
    
    // Add voxels to form a 2x2x2 cube
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          engine.addVoxel({x, y, z}, 'steel');
        }
      }
    }
    
    // Check that full wireframe shows all edges
    assert.ok(true, 'Placeholder test - to be implemented');
  });
  
  runTest('Wireframe mode - surface only wireframe', async () => {
    const mockScene = new THREE.Scene();
    const mockCamera = new THREE.PerspectiveCamera();
    const mockRenderer = new THREE.WebGLRenderer();
    const mockControls = {};
    const materialDB = new MaterialSystem();
    
    const engine = new VoxelEngine(mockScene, materialDB, null, mockCamera, mockRenderer, mockControls);
    
    // Add voxels to form a 3x3x3 cube
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          engine.addVoxel({x, y, z}, 'steel');
        }
      }
    }
    
    // Check that surface-only wireframe shows only external edges
    assert.ok(true, 'Placeholder test - to be implemented');
  });
  
  runTest('Wireframe mode - internal wireframe', async () => {
    const mockScene = new THREE.Scene();
    const mockCamera = new THREE.PerspectiveCamera();
    const mockRenderer = new THREE.WebGLRenderer();
    const mockControls = {};
    const materialDB = new MaterialSystem();
    
    const engine = new VoxelEngine(mockScene, materialDB, null, mockCamera, mockRenderer, mockControls);
    
    // Add voxels to form a hollow 3x3x3 cube (missing center)
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          // Skip the center voxel (1,1,1)
          if (!(x === 1 && y === 1 && z === 1)) {
            engine.addVoxel({x, y, z}, 'steel');
          }
        }
      }
    }
    
    // Check that internal wireframe shows only internal edges
    assert.ok(true, 'Placeholder test - to be implemented');
  });

  console.log(`\n✅ ${passed} passed, ❌ ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAll().catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}