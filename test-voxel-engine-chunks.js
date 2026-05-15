// Test VoxelEngine with Chunk System
import * as THREE from 'three';
import { Chunk } from './src/core/chunk-system.js';
import { VoxelEngine } from './src/voxel-engine.js';

// ── DOM & browser-API mock ─────────────────────────────────────────────────
const _evHandlers = {};

(() => {
  const doc = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          getContext: () => ({
            font: '', fillStyle: '', textAlign: '', textBaseline: '',
            fillText: () => {},
          }),
          width: 800, height: 600,
          addEventListener: () => {},
        };
      }
      if (tag === 'a') {
        return { href: '', appendChild: () => {}, removeChild: () => {}, click: () => {} };
      }
      return {
        addEventListener: (t, cb) => { if (cb) _evHandlers[t] = cb; },
        removeEventListener: (t, cb) => { if (_evHandlers[t] === cb) delete _evHandlers[t]; },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        style: { display: '', opacity: '' },
        textContent: '', value: '',
        appendChild: () => {}, removeChild: () => {},
        children: [], parentElement: null,
        classList: { add: () => {}, remove: () => {} },
        dispatchEvent: (e) => { const h = _evHandlers[e.type]; if (h) h(e); },
      };
    },
    getElementById: (id) => ({
      addEventListener: () => {},
      removeEventListener: () => {},
      textContent: '', value: '', id,
      style: { display: 'none', opacity: '' },
    }),
    addEventListener: (t, cb) => { if (cb) _evHandlers[t] = cb; },
    removeEventListener: (t, cb) => { if (_evHandlers[t] === cb) delete _evHandlers[t]; },
    dispatchEvent: (e) => { const h = _evHandlers[e.type]; if (h) h(e); },
    body: Object.assign({}, { appendChild: () => {} }),
  };
  Object.defineProperty(globalThis, 'document', { value: doc, writable: false });
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: '' }, writable: false });
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  globalThis.performance = { now: () => Date.now() };
  globalThis.HTMLCanvasElement = function(){};
  Object.defineProperty(globalThis, 'window', { value: doc, writable: true });
})();

globalThis.CustomEvent = function(type, opts) { this.type = type; this.detail = opts?.detail; };

// Mock VoxelEngine dependencies
const mockMaterialDB = {
  get: (name) => {
    const materials = {
      steel:    { color: 0x808080, density: 7850, roughness: 0.4, metalness: 0.3 },
      aluminum: { color: 0xC0C0C0, density: 2700, roughness: 0.4, metalness: 0.3 },
    };
    return materials[name] || null;
  }
};

const mockModuleSystem = {
  toJSON: () => ({}),
  fromJSON: () => {}
};

const mockCamera = {
  position: new THREE.Vector3(0, 0, 0),
  lookAt: () => {},
  updateProjectionMatrix: () => {}
};

const mockRenderer = {
  domElement: document.createElement('canvas'),
  setSize: () => {},
  setPixelRatio: () => {}
};

const mockControls = {
  target: new THREE.Vector3(0, 0, 0),
  update: () => {}
};

const mockScene = new THREE.Scene();

// Direct VoxelEngine test (uses real THREE.js from node_modules)
const engine = new VoxelEngine(
  mockScene, mockMaterialDB, mockModuleSystem, mockCamera, mockRenderer, mockControls
);

console.log('Testing VoxelEngine with Chunk System...');
console.log('Initial voxel count:', engine.getVoxelCount());

// Add a voxel
const r1 = engine.addVoxel({ x: 0, y: 0, z: 0 }, 'steel', null);
console.log('Add voxel at (0,0,0):',       !!r1 ? 'OK' : 'FAIL');
console.log('Voxel count after add:',      engine.getVoxelCount());

const r2 = engine.addVoxel({ x: 1, y: 0, z: 0 }, 'aluminum', null);
console.log('Add voxel at (1,0,0):',       !!r2 ? 'OK' : 'FAIL');
console.log('Voxel count after 2nd add:',  engine.getVoxelCount());

// Get voxel at (0,0,0)
const v0 = engine.getVoxelAt(0, 0, 0);
console.log('Retrieved (0,0,0): material=', v0?.material, 'expected steel:', v0?.material === 'steel');

// Select voxel
const sv = engine.selectVoxel(0, 0, 0);
console.log('Selected:', sv ? '(0,0,0)' : 'null');

// Remove voxel at (0,0,0)
engine.removeVoxel(0, 0, 0);
console.log('Count after remove:', engine.getVoxelCount());
console.log('Voxel at (0,0,0) after remove:', engine.getVoxelAt(0, 0, 0));

// Scale selected voxel (the one at (1,0,0))
engine.selectVoxel(1, 0, 0);
const scaled = engine.scaleSelectedVoxel(2, 1, 1);
const scaledVoxel = engine.getVoxelAt(1, 0, 0);
console.log('Scaled (1,0,0) to 2×1×1:', scaled ? 'OK' : 'FAIL', '| scale:', scaledVoxel?.scale);

// Cross-chunk: world pos (16,0,0) must be in chunk (1,0,0)
engine.addVoxel({ x: 16, y: 0, z: 0 }, 'steel', null);
const v16 = engine.getVoxelAt(16, 0, 0);
console.log('Voxel at world (16,0,0):', v16 ? 'OK' : 'MISSING');

// JSON round-trip
const json = engine.toJSON();
console.log('toJSON voxels:', json.voxels.length);

engine.fromJSON(json);
console.log('fromJSON count:', engine.getVoxelCount());

// getVoxelsInModule
engine.addVoxel({ x: 2, y: 0, z: 0 }, 'steel', 'my-module');
const modVoxels = engine.getVoxelsInModule('my-module');
console.log('Voxels in module "my-module":', modVoxels.length, '(expect 1)');

// voxelsIterator
let iterCount = 0;
for (const v of engine.voxelsIterator()) iterCount++;
console.log('voxelsIterator count:', iterCount);

// clearAll
engine.clearAll();
console.log('Count after clearAll:', engine.getVoxelCount());

console.log('\nAll VoxelEngine chunk tests completed!');
