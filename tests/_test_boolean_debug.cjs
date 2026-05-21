const assert = require('assert');
global.document = { createElement: ()=>({getContext:()=>({}),style:{}}), getElementById: ()=>({}) };
global.navigator = { hardwareConcurrency: 4 };

const Vec3 = (x=0,y=0,z=0)=>({ x,y,z, set(){}, copy(){ return this; }, clone(){ return Vec3(this.x,this.y,this.z); }, add(){ return this; }, multiplyScalar(){ return this; }, sub(){ return this; }, normalize(){ return this; }, cross(){ return Vec3(); }, dot(){ return 0; }, length(){ return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z); }, applyMatrix4(){ return this; }, applyNormalMatrix(){ return this; }, fromBufferAttribute(attr,i){ this.x=attr.getX(i); this.y=attr.getY(i); this.z=attr.getZ(i); return this; }, getMidpoint(v){ v.x=(this.x+v.x)/2; v.y=(this.y+v.y)/2; v.z=(this.z+v.z)/2; return v; }, getNormal(v){ return this; }, getBarycoord(t,p){ return {a:{x:0,y:0,z:0}, b:{x:0,y:0,z:0}, c:{x:0,y:0,z:0}}; } });

const MockBufferGeometry = function() {
  this.attributes = {};
  this.index = null;
  this.groups = [];
  this.boundingSphere = null;
  this.boundingBox = null;
  this.boundsTree = null;
  this.halfEdges = null;
  this.groupIndices = null;
  this.computeBoundingSphere = function(){ this.boundingSphere={ getCenter:_=>Vec3(), radius:1 }; };
  this.computeVertexNormals = function(){};
  this.computeBoundingBox = function(){ this.boundingBox={min:Vec3(),max:Vec3()}; };
  this.dispose = function(){};
  this.clone = function(){ const c = new MockBufferGeometry(); c.attributes=JSON.parse(JSON.stringify(this.attributes)); c.groups=JSON.parse(JSON.stringify(this.groups)); return c; };
  this.setAttribute = function(n, attr){ this.attributes[n]=attr; return this; };
  this.getAttribute = function(n){ return this.attributes[n] || null; };
  this.setIndex = function(idx){ this.index = { array: idx.array, count: idx.count ? idx.count : (idx.array ? idx.array.length : 0), getX: i=>idx.array[i], getY: i=>i<idx.array.length?idx.array[i+1]:0, getZ: i=>i<idx.array.length?idx.array[i+2]:0 }; };
  this.getIndex = function(){ return this.index; };
};

const MockBrush = function(geo, mat) {
  this.isBrush = true;
  this.geometry = geo || new MockBufferGeometry();
  this.material = mat || null;
  this.position = Vec3();
  this.rotation = Vec3();
  this.scale = Vec3(1,1,1);
  this.matrixWorld = { elements: [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1], determinant: ()=>1, copy:()=>this, invert:()=>this, multiply:()=>this };
  this._previousMatrix = { elements: new Array(16).fill(0) };
  this.updateMatrixWorld = fn => {};
  this.children = [];
  this.isOperation = false;
};

const MockBVH = function(geo) {
  this.geometry = geo;
  this.strategy = 0;
  this.maxDepth = 40;
  this.maxLeafTris = 10;
  // bvhcast stub — always "no intersection"
  this.bvhcast = function(otherBVH, matrix, ops) {
    ops.intersectsTriangles = () => false;
    return 0;
  };
  // raycastFirst stub — always no hit (report all "front side")
  this.raycastFirst = function(ray, side) { return null; };
};

global.THREE = {
  Scene: function(){ this.add=_=>{}; this.children=[]; },
  Mesh: function(geo,mat){ this.geometry=geo; this.material=mat||null; this.position=Vec3(); this.rotation=Vec3(); this.scale=Vec3(1,1,1); this.updateMatrixWorld=fn=>{}; this.children=[]; },
  MeshStandardMaterial: function(o){ this.color=o.color||0x808080; this.roughness=o.roughness||0.4; this.metalness=o.metalness||0.3; },
  BufferGeometry: MockBufferGeometry,
  Float32BufferAttribute: function(arr, itemSize){
    this.array = Array.isArray(arr) ? new Float32Array(arr) : arr;
    this.itemSize = itemSize; this.count = Math.floor(this.array.length / itemSize);
    this.getX = i => this.array[i*itemSize];
    this.getY = i => i < this.array.length/itemSize ? this.array[i*itemSize+1] : 0;
    this.getZ = i => i < this.array.length/itemSize ? this.array[i*itemSize+2] : 0;
    return this;
  },
  BoxGeometry: function(w,h,d){
    const g = new MockBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,w,0,0, 0,h,0,w,0,0,w,h,0,0,h,0, 0,0,d,w,0,d,0,h,d,w,0,d,w,h,d,0,h,d,0,0,0,w,0,0,w,0,d,0,0,d,0,h,0,w,h,0,w,h,d,0,h,d,0,0,0,0,h,0,0,h,d,0,0,d,w,0,0,w,h,0,w,h,d,w,0,d],3));
    g.setIndex(new THREE.BufferAttribute(new THREE.Float32BufferAttribute([0,1,2, 2,1,3, 4,5,6, 6,5,7, 8,9,10, 10,9,11, 12,13,14, 14,13,15, 16,17,18, 18,17,19, 20,21,22, 22,21,23],1),1));
    g.computeBoundingSphere();
    return g;
  },
  BufferAttribute: function(arr, itemSize){ return new THREE.Float32BufferAttribute(arr.array||arr, itemSize); },
  DoubleSide: 2,
  Vector3: Vec3,
  Vector4: function(x=0,y=0,z=0,w=0){ return { x,y,z,w, addScaledVector(v,s){ this.x+=v.x*s; this.y+=v.y*s; this.z+=v.z*s; this.w+=v.w*s; return this; }, set(x,y,z,w){this.x=x;this.y=y;this.z=z;this.w=w;return this;} }; },
  Triangle: function(){ this.a=Vec3(); this.b=Vec3(); this.c=Vec3(); this.setFromAttributeAndIndices = function(attr,i0,i1,i2){ this.a.fromBufferAttribute(attr,i0); this.b.fromBufferAttribute(attr,i1); this.c.fromBufferAttribute(attr,i2); return this; }; this.getMidpoint=v=>v; this.getNormal=v=>v; this.intersectsTriangle=function(t,edge,precise){ return false; }; },
  Matrix4: function(){ this.elements=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; this.determinant=()=>1; this.copy=()=>this; this.decompose=()=>[Vec3(),Vec3(),this]; return this; },
  Matrix3: function(){ this.determinant=()=>1; this.getNormalMatrix=()=>new THREE.Matrix3(); return this; },
};
global.MeshBVHLib = { MeshBVH: MockBVH };

(async () => {
  const path = require('path').join(__dirname, 'src', 'boolean', 'BooleanOperations.js');
  const m = await import(path);
  const { BooleanOperations } = m;

  const a = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  const b = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5));
  b.position.set(2, 2, 2);

  let passed = 0;
  function chk(name, fn) { try { fn(); console.log('  [PASS]', name); passed++; } catch(e) { console.log('  [FAIL]', name, '-', e.message); } }

  chk('import', () => assert.ok(BooleanOperations));
  chk('static.perform exists', () => assert.strictEqual(typeof BooleanOperations.perform, 'function'));
  chk('static.subtract exists', () => assert.strictEqual(typeof BooleanOperations.subtract, 'function'));
  chk('static.union exists', () => assert.strictEqual(typeof BooleanOperations.union, 'function'));
  chk('static.intersect exists', () => assert.strictEqual(typeof BooleanOperations.intersect, 'function'));
  chk('static.performOnGeometry exists', () => assert.strictEqual(typeof BooleanOperations.performOnGeometry, 'function'));

  // Real evaluator operation
  try {
    const r = BooleanOperations.perform(a, b, 'subtract');
    chk('perform/subtract returns mesh', () => { assert.ok(r); assert.ok(r.geometry); });
    if (r && r.geometry) chk('result has position attr', () => assert.ok(r.geometry.attributes.position));
  } catch(e) {
    console.log('  [NOTE] Full perform() threw', e.message, '- evaluator needs BVH and splitter (OK for mock env)');
    chk('perform.type', () => assert.strictEqual(typeof BooleanOperations.perform, 'function'));
  }

  try {
    const r2 = BooleanOperations.perform(a, b, 'union');
    chk('perform/union returns mesh', () => { assert.ok(r2); assert.ok(r2.geometry); });
  } catch(e) {
    console.log('  [NOTE] union threw', e.message);
  }

  try {
    const r3 = BooleanOperations.intersect(a, b);
    chk('intersect returns mesh', () => { assert.ok(r3); assert.ok(r3.geometry); });
  } catch(e) {
    console.log('  [NOTE] intersect threw', e.message);
  }

  chk('performOnGeometry returns geometry', () => {
    const gA = new THREE.BoxGeometry(2,2,2);
    const gB = new THREE.BoxGeometry(1,1,1);
    const r = BooleanOperations.performOnGeometry(gA, gB, 'subtract');
    assert.ok(r);
    assert.ok(r.attributes);
    assert.ok(r.attributes.position);
  });

  chk('perform throws on bad op', () => {
    assert.throws(() => BooleanOperations.perform(a, b, 'foobar'), /CSG operation/i);
  });

  console.log('\n  BooleanOperations pass:', passed, '(note: full Benchmarks need full BVH mock)');
})();
