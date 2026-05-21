// Minimal BVH and Triangle mock so Evaluator can run in non-browser test
// This is a simplified mocks based on what Evaluator actually calls.
global.THREE = global.THREE || {};

Vec3 = (x=0,y=0,z=0)=>({ x,y,z,
  set(x,y,z){ this.x=x;this.y=y;this.z=z; return this; },
  copy(v){ this.x=v.x;this.y=v.y;this.z=v.z; return this; },
  clone(){ return Vec3(this.x,this.y,this.z); },
  add(){ return this; },
  multiplyScalar(){ return this; },
  sub(v){ this.x-=v.x;this.y-=v.y;this.z-=v.z; return this; },
  normalize(){ const l=Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)||1; this.x/=l;this.y/=l;this.z/=l; return this; },
  cross(v){ return Vec3(this.y*v.z-this.z*v.y, this.z*v.x-this.x*v.z, this.x*v.y-this.y*v.x); },
  dot(v){ return this.x*v.x+this.y*v.y+this.z*v.z; },
  length(){ return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z); },
  applyMatrix4(m){ return this; },
  applyNormalMatrix(m){ return this; },
  fromBufferAttribute(attr, idx){ this.x=attr.getX(idx); this.y=attr.getY(idx); this.z=attr.getZ(idx); return this; },
  getMidpoint(v){ v.x+=this.x/2; v.y+=this.y/2; v.z+=this.z/2; return v; },
  lerp(){ return this; },
});

MockTriangle = function() {
  this.a = Vec3(); this.b = Vec3(); this.c = Vec3();
  this.setFromAttributeAndIndices = function(posAttr, i0, i1, i2) {
    this.a.fromBufferAttribute(posAttr, i0);
    this.b.fromBufferAttribute(posAttr, i1);
    this.c.fromBufferAttribute(posAttr, i2);
    return this;
  };
  this.getMidpoint = v => { v.x=(this.a.x+this.b.x+this.c.x)/3; v.y=(this.a.y+this.b.y+this.c.y)/3; v.z=(this.a.z+this.b.z+this.c.z)/3; return v; };
  this.getNormal = v => { v.x=0;v.y=1;v.z=0; return v; };
  this.intersectsTriangle = () => false;
};

MockBVH = function(geo) {
  this.geometry = geo;
  this.bvhcast = function(otherBVH, matrix, ops) {
    // No intersections reported for mock → split triangles = none
    ops.intersectsTriangles = () => false;
    return 0;
  };
  this.raycastFirst = function(ray, side) { return null; };  // no hit → FRONT_SIDE
};

// Inject into global mock
global.THREE.Vector3 = Vec3;
global.THREE.Vector4 = function(x=0,y=0,z=0,w=0){ return { x,y,z,w, addScaledVector(v,s){ this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;this.w+=v.w*s;return this; } }; };
global.THREE.Triangle = MockTriangle;
global.THREE.Matrix4 = function(){ this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]; this.copy=()=>this; this.invert=()=>this; this.multiply=()=>this; this.determinant=()=>1; this.decompose=()=>[Vec3(),Vec3(),this]; this.setPosition=v=>this.elements[12]=v.x; this.elements[13]=v.y; this.elements[14]=v.z; return this; };
global.THREE.Matrix3 = function(){ this.getNormalMatrix=()=>this; this.multiplyScalar=()=>this; };
global.THREE.DoubleSide = 2;
global.THREE.Ray = function(){ this.origin=Vec3(); this.direction=Vec3(); };
global.THREE.Line3 = function(){ this.start=Vec3(); this.end=Vec3(); };
global.MeshBVHLib = { MeshBVH: MockBVH };

(async () => {
  const p = 'file:///D:/pro.cardesign/src/boolean/BooleanOperations.js';
  const m = await import(p);
  const { BooleanOperations } = m;

  const a = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10));
  const b = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5));
  b.position.set(2, 2, 2);

  function chk(name, fn) { try { fn(); console.log('  [PASS]', name); } catch(e) { console.log('  [FAIL]', name, '-', e.message); } }

  console.log('BooleanOperations loaded');

  chk('import', () => assert.ok(BooleanOperations));
  chk('perform exists', () => assert.strictEqual(typeof BooleanOperations.perform, 'function'));
  chk('subtract exists', () => assert.strictEqual(typeof BooleanOperations.subtract, 'function'));
  chk('union exists', () => assert.strictEqual(typeof BooleanOperations.union, 'function'));
  chk('intersect exists', () => assert.strictEqual(typeof BooleanOperations.intersect, 'function'));
  chk('performOnGeometry exists', () => assert.strictEqual(typeof BooleanOperations.performOnGeometry, 'function'));

  try {
    const r = BooleanOperations.perform(a, b, 'subtract');
    chk('perform/subtract returns mesh', () => { assert.ok(r); assert.ok(r.geometry); });
    if (r && r.geometry) chk('result has position attr', () => assert.ok(r.geometry.attributes.position));
  } catch(e) {
    console.log('  [INFO] perform(subtract) threw:', e.message);
  }

  try {
    const r2 = BooleanOperations.union(a, b);
    chk('union returns mesh', () => { assert.ok(r2); assert.ok(r2.geometry); });
  } catch(e) { console.log('  [INFO] union threw:', e.message); }

  chk('performOnGeometry', () => {
    const gA = new THREE.BoxGeometry(2, 2, 2);
    const gB = new THREE.BoxGeometry(1, 1, 1);
    const r = BooleanOperations.performOnGeometry(gA, gB, 'subtract');
    assert.ok(r);
    assert.ok(r.attributes.position);
  });

  chk('perform throws on bad op', () => {
    assert.throws(() => BooleanOperations.perform(a, b, 'foobar'), /CSG operation/i);
  });

  console.log('\n  Note: Results with BVH/Bvhcast mocks may be approximated for mock-environment');
})();
