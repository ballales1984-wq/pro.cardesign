// Minimal blueprintjs-style mock for three-bvh-csg + THREE to trace BooleanOperations
const Vec3 = (x=0, y=0, z=0) => ({ x, y, z,
  set(){}, copy(){ return this; }, clone(){ return Vec3(this.x,this.y,this.z); },
  add(){ return this; }, multiplyScalar(){ return this; }, sub(){ return this; },
  normalize(){ return this; }, cross(){ return Vec3(); }, dot(){ return 0; },
  length(){ return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z); },
  applyMatrix4(){ return this; }, lerp(){ return this; },
});

global.THREE = {
  Mesh: function(geo, mat){ this.geometry = geo; this.material = mat || new THREE.MeshStandardMaterial({color:0x808080}); this.position = Vec3(); this.rotation = Vec3(); this.scale = Vec3(1,1,1); this.updateMatrixWorld = fn => { if(fn) this._matrixWorld=true; }; this.add=_=>{}; },
  MeshStandardMaterial: function(opts){ this.color=opts.color||0x808080; this.roughness=opts.roughness||0.4; this.metalness=opts.metalness||0.3; },
  BufferGeometry: function(){
    console.log('[BG CTOR]');
    this.attributes = {}; this.index = null; this.groups = []; this.boundingSphere = null; this.boundingBox = null;
    this.computeBoundingSphere = function(){ this.boundingSphere={ getCenter:_=>Vec3(), radius:1 }; console.log('[BG] computeBoundingSphere OK'); };
    this.computeVertexNormals = function(){ console.log('[BG] computeVertexNormals OK'); };
    this.computeBoundingBox = function(){ this.boundingBox = { min: Vec3(-1,-1,-1), max: Vec3(1,1,1) }; console.log('[BG] computeBoundingBox OK'); };
    this.dispose = function(){ console.log('[BG] dispose'); };
    this.clone = function(){ const c = Object.assign(Object.create(Object.getPrototypeOf(this)), this); c.attributes=JSON.parse(JSON.stringify(this.attributes)); console.log('[BG] clone OK'); return c; };
    this.setAttribute = function(name, attr){ this.attributes[name] = attr; return this; };
    this.getAttribute = function(name){ return this.attributes[name] || null; };
    return this;
  },
  Float32BufferAttribute: function(arr, itemSize) {
    this.array = Array.isArray(arr) ? new Float32Array(arr) : arr;
    this.itemSize = itemSize;  this.count = Math.floor(this.array.length / itemSize);
    this.setXYZ = function(i,x,y,z){ this.array[i*3]=x; this.array[i*3+1]=y; this.array[i*3+2]=z; };
    this.setXY = function(i,x,y){ this.array[i*2]=x; this.array[i*2+1]=y; };
    this.getX = i => this.array[i*itemSize];
    this.getY = i => i < this.array.length/itemSize ? this.array[i*itemSize+1] : 0;
    this.getZ = i => i < this.array.length/itemSize ? this.array[i*itemSize+2] : 0;
    return this;
  },
  BoxGeometry: function(w,h,d){
    console.log('[BoxGeo] w='+w+' h='+h+' d='+d);
    const g = new THREE.BufferGeometry();
    // Fake position attr
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      0,0,0, w,0,0, 0,h,0,    w,0,0, w,h,0, 0,h,0,
      0,0,d, w,0,d, 0,h,d,    w,0,d, w,h,d, 0,h,d,
      0,0,0, w,0,0, w,0,d, 0,0,d,
      0,h,0, w,h,0, w,h,d, 0,h,d,
      0,0,0, 0,h,0, 0,h,d, 0,0,d,
      w,0,0, w,h,0, w,h,d, w,0,d,
    ], 3));
    console.log('[BoxGeo] g.computeBoundingSphere =', typeof g.computeBoundingSphere);
    return g;
  },
  Vector3: Vec3,
};

// Real three-bvh-csg is imported directly - don't mock it instead
(async () => {
  try {
    const m = await import('./src/boolean/BooleanOperations.js');
    console.log('Module loaded exports:', Object.keys(m));
    const { BooleanOperations } = m;

    const a = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
    const b = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5));
    b.position.set(2, 2, 2);

    console.log('\n--- BooleanOperations.subtract ---');
    const r = BooleanOperations.perform(a, b, 'subtract');
    console.log('result:', !!r);
    console.log('result.geometry:', !!r.geometry);
    if (r && r.geometry) {
      console.log('result.geometry.computeBoundingSphere:', typeof r.geometry.computeBoundingSphere);
      console.log('SUCCESS');
    }
  } catch(e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  }
})();
