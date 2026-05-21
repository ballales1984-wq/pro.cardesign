// Minimal mock of THREE and three-bvh-csg to trace BooleanOperations.execute flow
const Vec3 = (x=0, y=0, z=0) => ({
  x, y, z,
  set(){}, copy(){ return this; }, clone(){ return Vec3(this.x,this.y,this.z); },
  add(){ return this; }, multiplyScalar(){ return this; }, sub(){ return this; },
  normalize(){ return this; }, cross(){ return Vec3(); }, dot(){ return 0; },
  length(){ return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z); },
  applyMatrix4(){ return this; }, lerp(){ return this; },
});

function mockEl() {
  return { addEventListener(){}, removeEventListener(){}, dispatchEvent(){}, getBoundingClientRect(){return{}}, getPropertyValue(){return''}, setProperty(){}, style:{}, textContent:'', children:[], parentElement:null, classList:{add(){},remove(){}} };
}
global.document = { createElement: () => mockEl(), getElementById: () => Object.assign({}, mockEl(), { textContent:'' }), querySelectorAll: () => [], addEventListener(){}, body: mockEl() };
global.window = global;
global.navigator = { hardwareConcurrency: 4 };
global.requestAnimationFrame = cb => setTimeout(cb, 16);

const MockBVHClass = function(geo) {
  this.geometry = geo;
  console.log('  [BVH] constructed for geometry', geo.constructor.name, 'pos count:', geo.attributes.position ? geo.attributes.position.count : 'N/A');
};

const MockEvaluator = function() {
  console.log('  [EVAL] Evaluator created');
  this.evaluate = function(a, b, op) {
    console.log('  [EVAL] evaluate called with op:', op, 'a.geo:', a.geometry.constructor.name, 'b.geo:', b.geometry.constructor.name);
    a.geometry.computeBoundingSphere();
    console.log('  [EVAL] a.geo.computeBoundingSphere OK');
    b.geometry.computeBoundingSphere();
    console.log('  [EVAL] b.geo.computeBoundingSphere OK');
    const resultGeo = a.geometry.clone();
    console.log('  [EVAL] resultGeo type:', typeof resultGeo, 'computeBoundingSphere:', typeof resultGeo.computeBoundingSphere);
    resultGeo.computeBoundingSphere();
    console.log('  [EVAL] result.geo.computeBoundingSphere OK');
    const resultMat = a.material || b.material || null;
    const result = new THREE.Mesh(resultGeo, resultMat);
    console.log('  [EVAL] returning result mesh', typeof result, typeof result.geometry, typeof result.geometry.computeBoundingSphere);
    return result;
  };
};

global.THREE = {
  Scene: function(){ this.add=_=>{}; this.children=[]; },
  Mesh: function(geo,mat){ this.geometry=geo; this.material=mat; this.position=Vec3(); this.rotation=Vec3(); this.scale=Vec3(1,1,1); },
  MeshStandardMaterial: function(opts){ this.color=opts.color||0xffffff; this.roughness=opts.roughness||0.4; this.metalness=opts.metalness||0.3; },
  BufferGeometry: function(){
    console.log('  [BG] BufferGeometry constructor called');
    this.attributes = {}; this.index = null; this.groups = []; this.boundingSphere = null; this.boundingBox = null; this.halfEdges = null; this.boundsTree = null;
    this.computeBoundingSphere = function(){ this.boundingSphere={ getCenter:_=>Vec3(), radius:1 }; console.log('  [BG] computeBoundingSphere called'); };
    this.computeVertexNormals = function(){ console.log('  [BG] computeVertexNormals called'); };
    this.computeBoundingBox = function(){ this.boundingBox={ min:Vec3(-1,-1,-1), max:Vec3(1,1,1) }; console.log('  [BG] computeBoundingBox called'); };
    this.dispose = function(){ console.log('  [BG] dispose called'); };
    this.setAttribute = function(name, attr){ this.attributes[name] = attr; return this; };
    this.getAttribute = function(name){ return this.attributes[name] || null; };
    this.clone = function(){
      const c = new THREE.BufferGeometry();
      Object.assign(c, JSON.parse(JSON.stringify({attributes:this.attributes, index:this.index, groups:this.groups, boundingSphere:this.boundingSphere, boundingBox:this.boundingBox})));
      c.attributes = {};
      for (const k in this.attributes) { c.attributes[k] = this.attributes[k]; }
      console.log('  [BG] clone called');
      return c;
    };
    return this;
  },
  Float32BufferAttribute: function(arr, itemSize) {
    this.array = Array.isArray(arr) ? new Float32Array(arr) : arr;
    this.itemSize = itemSize;
    this.count = this.array.length / itemSize;
    this.getX = i => this.array[i * itemSize];
    this.getY = i => i < this.array.length / itemSize ? this.array[i * itemSize + 1] : 0;
    this.getZ = i => i < this.array.length / itemSize ? this.array[i * itemSize + 2] : 0;
    return this;
  },
  BoxGeometry: function(w,h,d){
    console.log('  [Box] geometry created', w, h, d);
    const g = new THREE.BufferGeometry();
    console.log('  [Box] result geo.computeBoundingSphere:', typeof g.computeBoundingSphere);
    return g;
  },
  Vector3: Vec3,
};

global.MeshBVHLib = { MeshBVH: MockBVHClass };
global.Brush = function(geo, mat){
  this.isBrush = true;
  this.geometry = geo || new THREE.BufferGeometry();
  this.material = mat || null;
};
global.Brush.prototype = Object.assign(Object.create(global.THREE.Mesh.prototype), { isBrush: true });

(async () => {
  try {
    const m = await import('./src/boolean/BooleanOperations.js');
    console.log('BooleanOperations module loaded:', Object.keys(m));
    const { BooleanOperations } = m;

    const geo = new THREE.BoxGeometry(10,10,10);
    console.log('geo:', typeof geo, 'geo.computeBoundingSphere:', typeof geo.computeBoundingSphere);
    const a = new THREE.Mesh(geo);
    const b = new THREE.Mesh(new THREE.BoxGeometry(5,5,5));

    console.log('\n--- calling BooleanOperations.subtract ---');
    const result = BooleanOperations.perform(a, b, 'subtract');
    console.log('\nresult:', typeof result);
    if (result) {
      console.log('result.geometry:', typeof result.geometry);
      if (result.geometry) console.log('result.geometry.computeBoundingSphere:', typeof result.geometry.computeBoundingSphere);
    }
    console.log('SUCCESS');
  } catch(e) {
    console.error('FAILED:', e.message);
    console.error(e.stack);
  }
})();
