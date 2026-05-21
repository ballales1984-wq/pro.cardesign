export default {"DoubleSide":1};
export const DoubleSide = 1;
export const Scene = function(){ this.add=_=>{}; this.remove=_=>{}; };
export const Mesh = function(geo,mat){ 
    this.geometry = geo || { attributes: {} }; 
    this.material = mat; 
    this.position = v3(); 
    this.scale = v3(); 
    this.visible = true; 
    this.castShadow = false; 
    this.receiveShadow = false; 
    this.userData = {}; 
    this.add = _=>{}; 
    this.name = ''; 
    this.morphTargetDictionary = {};
    this.morphTargetInfluences = [];
  };
export const MeshStandardMaterial = function(opts){ 
    this.color = opts.color || 0xffffff; 
    this.roughness = opts.roughness || 0.4; 
    this.metalness = opts.metalness || 0.3; 
    this.opacity = opts.opacity || 1; 
    this.transparent = opts.transparent || false; 
    this.wireframe = false; 
    this.name = ''; 
    this.depthWrite = true; 
    this.side = opts.side; 
  };
export const BufferGeometry = function(){ 
    this.attributes = {}; 
    this.index = null; 
    this.groups = []; 
    this.boundingSphere = null; 
    this.boundingBox = null; 
    this.setAttribute = (n,a) => { this.attributes[n] = a; return a; }; 
    this.getAttribute = (n) => this.attributes[n] || null; 
    this.setIndex = (i) => { this.index = { getX:(j)=>i[j], getY:(j)=>i[j+1], getZ:(j)=>i[j+2], count:i.length }; }; 
    this.getIndex = () => this.index; 
    this.computeBoundingSphere = () => { this.boundingSphere = { getCenter:()=>v3(), radius:1 }; }; 
    this.computeBoundingBox = () => { this.boundingBox = { min:{x:-1,y:-1,z:-1}, max:{x:1,y:1,z:1} }; }; 
    this.dispose = ()=>{}; 
    this.morphAttributes = {};
  };
export const Float32BufferAttribute = function(arr, itemSize){ 
    this.array = Array.isArray(arr) ? new Float32Array(arr) : arr; 
    this.itemSize = itemSize; 
    this.count = this.array.length / itemSize; 
  };
export const Vector3 = (x,y,z) => v3(x,y,z);