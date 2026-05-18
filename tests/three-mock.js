/**
 * three-mock.js — ESM stub di THREE per test Node (no browser, no WebGL)
 * I moduli src/* che fanno `import * as THREE from 'three'` ricevono questo stub
 * quando NODE_PATH è impostato a tests/ o quando il test pre-carica il modulo.
 */

// ── Vectors ──────────────────────────────────────────────────────────────────
export class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
}

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  normalize() { const l = Math.sqrt(this.x**2+this.y**2+this.z**2)||1; this.x/=l; this.y/=l; this.z/=l; return this; }
  dot(v) { return this.x*v.x + this.y*v.y + this.z*v.z; }
  cross(v) { return new Vector3(this.y*v.z-this.z*v.y, this.z*v.x-this.x*v.z, this.x*v.y-this.y*v.x); }
  length() { return Math.sqrt(this.x**2+this.y**2+this.z**2); }
  distanceTo(v) { return Math.sqrt((this.x-v.x)**2+(this.y-v.y)**2+(this.z-v.z)**2); }
  applyMatrix4(m) { return this; }
  angleTo(v) { return 0; }
  lerp(v, t) { this.x += (v.x-this.x)*t; this.y += (v.y-this.y)*t; this.z += (v.z-this.z)*t; return this; }
}

export class Euler {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

// ── Math helpers ──────────────────────────────────────────────────────────────
export const MathUtils = {
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
};

// ── Core objects ──────────────────────────────────────────────────────────────
export class Object3D {
  constructor() { this.position = new Vector3(); this.rotation = new Euler(); this.scale = new Vector3(1,1,1); this.visible = true; this.children = []; this.userData = {}; this.name = ''; }
  add(c) { this.children.push(c); }
  remove(c) { const i = this.children.indexOf(c); if (i > -1) this.children.splice(i, 1); }
}

export class Scene extends Object3D {}
export class Group extends Object3D {}

export class Camera extends Object3D {
  updateProjectionMatrix() {}
  lookAt() {}
}

export class PerspectiveCamera extends Camera {
  constructor(fov = 75, aspect = 1, near = 0.1, far = 1000) {
    super(); this.fov = fov; this.aspect = aspect; this.near = near; this.far = far;
  }
}

export class Raycaster {
  constructor() { this.ray = {}; this.linePrecision = 1; }
  setFromCamera() {}
  intersectObjects() { return []; }
  intersectObject() { return []; }
}

// ── Geometries ─────────────────────────────────────────────────────────────────
export class BufferGeometry {
  constructor() { this.attributes = {}; this.index = null; this.groups = []; }
  setAttribute(name, attr) { this.attributes[name] = attr; return attr; }
  getAttribute(name) { return this.attributes[name] || null; }
  setIndex(idx) { this.index = Array.isArray(idx) ? { array: new Uint32Array(idx), count: idx.length } : idx; }
  getIndex() { return this.index; }
  computeBoundingSphere() { this.boundingSphere = { getCenter: () => new Vector3(), radius: 1 }; }
  computeVertexNormals() {}
  dispose() {}
}

export class BoxGeometry extends BufferGeometry {
  constructor(w = 1, h = 1, d = 1) { super(); this.parameters = { width: w, height: h, depth: d }; }
}
export class PlaneGeometry extends BufferGeometry { constructor(w = 1, h = 1) { super(); this.parameters = { width: w, height: h }; } }
export class SphereGeometry extends BufferGeometry { constructor(r = 1, ws = 16, hs = 12) { super(); this.parameters = { radius: r, widthSegments: ws, heightSegments: hs }; } }
export class CylinderGeometry extends BufferGeometry { constructor(rt = 0, rb = 1, h = 1) { super(); this.parameters = { radiusTop: rt, radiusBottom: rb, height: h }; } }
export class EdgesGeometry extends BufferGeometry { constructor(geo) { super(); this.geometry = geo; } }

// ── Buffer attribute ────────────────────────────────────────────────────────────
export class Float32BufferAttribute {
  constructor(arr, itemSize) {
    this.array = Array.isArray(arr) ? new Float32Array(arr) : arr;
    this.itemSize = itemSize;
    this.count = this.array.length / itemSize;
    this._needsUpdate = false;
  }
  get needsUpdate() { return this._needsUpdate; }
  set needsUpdate(v) { this._needsUpdate = v; }
}

// ── Materials ──────────────────────────────────────────────────────────────────
export class Material {}
export class MeshBasicMaterial extends Material {
  constructor(opts = {}) { super(); this.color = opts.color || 0xffffff; this.opacity = opts.opacity ?? 1; this.transparent = !!opts.transparent; this.wireframe = !!opts.wireframe; this.depthWrite = opts.depthWrite !== false; this.map = opts.map || null; }
}
export class MeshStandardMaterial extends Material {
  constructor(opts = {}) { super(); this.color = opts.color || 0xffffff; this.roughness = opts.roughness ?? 0.4; this.metalness = opts.metalness ?? 0.3; this.opacity = opts.opacity ?? 1; this.transparent = !!opts.transparent; this.wireframe = !!opts.wireframe; this.depthWrite = opts.depthWrite !== false; }
}
export class MeshDepthMaterial extends Material { constructor() { super(); } }
export class LineBasicMaterial extends Material { constructor(opts = {}) { super(); this.color = opts.color || 0; } }
export class SpriteMaterial extends Material { constructor(opts = {}) { super(); this.map = opts.map; this.depthTest = opts.depthTest !== false; } }

// ── Mesh ───────────────────────────────────────────────────────────────────────
export class Mesh extends Object3D {
  constructor(geo, mat) {
    super(); this.geometry = geo || new BufferGeometry(); this.material = mat || new Material();
    this.position = new Vector3(); this.scale = new Vector3(1,1,1); this.visible = true;
    this.castShadow = false; this.receiveShadow = false;
  }
}
export class LineSegments extends Object3D {
  constructor(geo, mat) { super(); this.geometry = geo; this.material = mat; this.visible = true; this.position = new Vector3(); }
}
export class Sprite extends Object3D {
  constructor(mat) { super(); this.material = mat; this.position = new Vector3(); this.scale = new Vector3(1,1,1); }
}

// ── InstancedMesh ──────────────────────────────────────────────────────────────
export class InstancedMesh {
  constructor(geo, mat, count) {
    this.count = count || 0;
    this.geometry = geo;
    this.material = mat;
    this.frustumCulled = true;
    this.castShadow = false;
    this.receiveShadow = false;
    this.instanceMatrix = { array: new Float32Array(count * 16), needsUpdate: false, setUsage: () => {} };
    this._dummy = new Object3D();
  }
  setMatrixAt(i, m) { const e = m.elements || [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]; for (let j = 0; j < 16; j++) this.instanceMatrix.array[i*16+j] = e[j]; }
}

export class InstancedBufferAttribute {
  constructor(arr, itemSize) {
    this.array = Array.isArray(arr) ? new Float32Array(arr) : arr;
    this.itemSize = itemSize;
    this.count = this.array.length / itemSize;
    this._needsUpdate = false;
  }
  get needsUpdate() { return this._needsUpdate; }
  set needsUpdate(v) { this._needsUpdate = v; }
}

// ── Matrix4 ────────────────────────────────────────────────────────────────────
export class Matrix4 {
  constructor() { this.elements = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  set(v) { const e = this.elements; e[12] = v.x||0; e[13] = v.y||0; e[14] = v.z||0; return this; }
  makeScale(sx,sy,sz) { this.elements[0]=sx; this.elements[5]=sy; this.elements[10]=sz; return this; }
  setPosition(v) { this.elements[12]=v.x||0; this.elements[13]=v.y||0; this.elements[14]=v.z||0; return this; }
  compose(pos, quat, scale) { return this; }
  decompose() { const e=this.elements; return [new Vector3(e[12],e[13],e[14]),null,new Vector3(e[0],e[5],e[10])]; }
  copy(m) { this.elements.set(m.elements); return this; }
}

// ── Color ──────────────────────────────────────────────────────────────────────
export class Color {
  constructor(c = 0xffffff) { this.r = ((c>>16)&255)/255; this.g = ((c>>8)&255)/255; this.b = (c&255)/255; }
  set(c) { this.r=((c>>16)&255)/255; this.g=((c>>8)&255)/255; this.b=(c&255)/255; return this; }
  getHex() { return Math.round(this.r*255)<<16 | Math.round(this.g*255)<<8 | Math.round(this.b*255); }
}

export const DoubleSide = 1, FrontSide = 0, BackSide = 2;
export const PCFSoftShadowMap = 1, BasicShadowMap = 0;
export const NoBlending = 0, AdditiveBlending = 1, NormalBlending = 2;

// ── Misc ───────────────────────────────────────────────────────────────────────
export class Plane { constructor() {} }
export class Clock { getDelta() { return 0.016; } getElapsedTime() { return 0; } }
export const CanvasTexture = function() { this.needsUpdate = false; this._canvas = {width:128,height:64}; };
export const DynamicDrawUsage = 35048;
export const ReusableShadowMaps = {};
