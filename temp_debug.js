// Debug EditableMeshModel in Node.js CJS context
const { pathToFileURL } = require('url');
const path = require('path');
const v3 = function(x,y,z) { return { x, y, z, length: function(){ return Math.sqrt(x*x+y*y+z*z); }, distanceTo: function(v){ return Math.sqrt((x-v.x)**2+(y-v.y)**2+(z-v.z)**2); }, clone: function(){ return v3(x,y,z); } }; };

// Minimal mock from test_coverage.js lines 175-241
global.THREE = {
  Scene: function(){ this.add=function(){}; },
  FogExp2: function(){},
  PerspectiveCamera: function(){ this.position={ set:function(){}, copy:function(){}, x:0,y:0,z:0 }; },
  WebGLRenderer: function(){},
  Box3: function(min,max){ this.min=min||{x:-1,y:-1,z:-1}; this.max=max||{x:1,y:1,z:1}; },
  Vector3: v3,
  Vector2: function(x,y){ return { x, y }; },
  BufferGeometry: function(){ this.attributes={}; this.index=null; this.groups=[]; this.boundingSphere=null; this.boundingBox=null;this.setAttribute=function(n,a){this.attributes[n]=a;return a;};this.getAttribute=function(n){return this.attributes[n]||null;};this.computeBoundingSphere=function(){this.boundingSphere={getCenter:function(){return v3()},radius:1};};this.computeVertexNormals=function(){};this.computeBoundingBox=function(){this.boundingBox={min:{x:-1,y:-1,z:-1},max:{x:1,y:1,z:1}};};this.dispose=function(){};this.morphAttributes={}; Object.defineProperty(this,'clone',{value:function(){var c=Object.create(this);for(var k in this){if(this[k]&&typeof this[k]==='object')c[k]=Object.create(this[k]);else c[k]=this[k];}c.boundingSphere=null;c.boundingBox=null;return c;}});this.setIndex=function(i){this.index={getX:function(j){return i[j]},getY:function(j){return i[j+1]},getZ:function(j){return i[j+2]},count:i.length}};return this;},
  Float32BufferAttribute: function(arr, itemSize){ this.array=Array.isArray(arr)?new Float32Array(arr):arr; this.itemSize=itemSize; this.count=this.array.length/itemSize; },
  MeshStandardMaterial: function(opts){ this.color=opts.color||0xffffff; },
  DoubleSide: 1,
};

function loadESM(relPath) {
  return import(pathToFileURL(path.resolve('D:/pro.cardesign', relPath)).href);
}

(async()=>{
  try {
    const { EditableMeshModel } = await loadESM('src/model/EditableMeshModel.js');
    const geo = new global.THREE.BufferGeometry();
    const pos = new global.THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0, 1,0,0, 1,1,0, 0,1,0], 3);
    geo.setAttribute('position', pos);
    geo.computeBoundingSphere();
    const emm = new EditableMeshModel(geo);
    console.log('SUCCESS vertexCount=' + emm.vertexCount);
  } catch(e) {
    console.error('FAIL:', e.message);
    console.error(e.stack);
  }
})();
