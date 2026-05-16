// ScalingTool unit tests
import * as THREE from 'three';
import { ScalingTool } from './src/core/scaling-tool.js';

// ── DOM + browser-API mock ───────────────────────────────────────────────────
const _evHandlers = {};
const _svEls      = {};

const _createEl = (tag) => {
  if (tag === 'canvas') return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return {
    style: { cssText: '' }, innerHTML: '',
    appendChild: () => {}, removeChild: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
};

const _docId       = (id) => { if (!_svEls[id]) _svEls[id] = Object.assign(_createEl('div'), { id }); return _svEls[id]; };
const _docAdd      = (t, cb) => { if (cb) _evHandlers[t] = cb; };
const _docDispatch = (e)    => { const cb = _evHandlers[e.type]; if (cb) cb(e); };

const _document = Object.freeze({
  body:              { appendChild: () => {}, removeChild: () => {}, style: { cssText: '', cursor: '' } },
  getElementById:    _docId,
  createElement:     _createEl,
  addEventListener:  _docAdd,
});
Object.defineProperty(globalThis, 'document', { value: _document, configurable: true, writable: true });

const _winMock = {
  addEventListener:    _docAdd,
  removeEventListener: () => {},
  dispatchEvent:       _docDispatch,
  CustomEvent:         function(type, opts = {}) { this.type = type; this.detail = opts.detail; },
};
Object.defineProperty(globalThis, 'window',     { value: _winMock, configurable: true, writable: true });
Object.defineProperty(globalThis, 'navigator',  { value: { userAgent: '' }, configurable: true });
globalThis.performance          = { now: () => Date.now() };
globalThis.requestAnimationFrame = cb => setTimeout(cb, 16);
globalThis.setTimeout           = setTimeout;
globalThis.clearTimeout         = clearTimeout;

// ── VoxelEngine mock ──────────────────────────────────────────────────────────
const pushHistory = [];

const voxelEngineMock = {
  instancedMeshes:    new Map([['steel', { instanceMatrix: { setUsage() {}, needsUpdate: false } }]]),
  keyToInstance:      new Map([['steel', new Map([['0,0,0', 0]])]]),
  instanceToKey:      new Map([['steel', ['0,0,0']]]),
  _worldPos:          pos  => ({ ...pos }),
  _setInstanceMatrix: ()   => {},
  _gridKey:           pos  => `${pos.x},${pos.y},${pos.z}`,
  _pushHistory:       a    => pushHistory.push(a),
  _onVoxelChanged:    ()   => {},
  getVoxelAt:         (x, y, z) => {
    const store = { '0,0,0': { x: 0, y: 0, z: 0, material: 'steel', scale: [2, 1, 1] } };
    return store[`${x},${y},${z}`] || null;
  },
  activeMaterial: 'steel',  activeModule: null,
};

// ── Scene / camera / renderer ───────────────────────────────────────────────
const sceneMock    = new THREE.Scene();
const cameraMock   = new THREE.Vector3(0, 10, 20);
const rendererMock = { domElement: document.createElement('canvas') };

// ── Create tool ─────────────────────────────────────────────────────────────
const tool = new ScalingTool(voxelEngineMock, sceneMock, cameraMock, rendererMock);

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) { console.log('  [PASS]', msg); passed++; } else { console.log('  [FAIL]', msg); failed++; } }

// helper: swap in a plain liveLabel object so we can read innerHTML
function withLabel(cb) {
  const saved = tool.liveLabel;
  tool.liveLabel = { innerHTML: '', style: { display: '' } };
  const result = cb();
  tool.liveLabel = saved;
  return result;
}

// ── 1. Initial state ────────────────────────────────────────────────────────
assert(tool.isActive   === false, 'init:        isActive === false');
assert(tool.isDragging === false, 'init:        isDragging === false');
assert(tool.sensitivity === 100, 'init:        sensitivity === 100');
assert(tool.liveLabel  !== null,  'init:        liveLabel allocated in ctor');
assert(tool.dragAxis   === 'x',  'init:        default dragAxis === x');

// ── 2. Activate / Deactivate ────────────────────────────────────────────────
tool.activate();
assert(tool.isActive   === true,  'activate:    isActive === true');
assert(tool.isDragging === false, 'activate:    isDragging unchanged');
tool.deactivate();
assert(tool.isActive   === false, 'deactivate:  isActive === false');
assert(tool.isDragging === false, 'deactivate:  isDragging === false');

// ── 3. _updateScaleLabel positive on X ──────────────────────────────────────
withLabel(() => {
  tool.dragAxis   = 'x';
  tool.startScale = { x: 2, y: 1, z: 1 };
  tool._updateScaleLabel({ x: 3, y: 1, z: 1 });
  assert(tool.liveLabel.innerHTML.includes('3.0'),      'label: new scale value 3.0');
  assert(tool.liveLabel.innerHTML.includes('+1.0'),     'label: positive delta +1.0 mm');
  assert(tool.liveLabel.innerHTML.includes('#4caf50'),  'label: positive delta green');
});

// ── 4. _updateScaleLabel negative on Y ──────────────────────────────────────
withLabel(() => {
  tool.dragAxis   = 'y';
  tool.startScale = { x: 1, y: 1, z: 1 };
  tool._updateScaleLabel({ x: 1, y: 0.5, z: 1 });
  assert(tool.liveLabel.innerHTML.includes('0.5'),      'label: new scale value 0.5');
  assert(tool.liveLabel.innerHTML.includes('-0.5'),     'label: negative delta -0.5');
  assert(tool.liveLabel.innerHTML.includes('#f44336'),  'label: negative delta red');
});

// ── 5. _removeHighlights safe with null selectedFace ─────────────────────────
tool.selectedFace = null;
tool._removeHighlights();
assert(true, '_removeHighlights: no throw when selectedFace is null');

// ── 6. _applyVoxelScale with voxel that has scale array ─────────────────────
const scaledVx = voxelEngineMock.getVoxelAt(0, 0, 0);
assert(scaledVx !== null,               'pre: voxel exists at (0,0,0)');
assert(Array.isArray(scaledVx.scale),   'pre: voxel.scale is [2,1,1]');
const prevLen = pushHistory.length;
tool._applyVoxelScale(scaledVx);
assert(pushHistory.length === prevLen,  '_applyVoxelScale: does not push history entry');

// ── 7. _applyVoxelScale safe with undefined scale ───────────────────────────
const unscaledVx = { x: 5, y: 0, z: 5, material: 'steel', scale: undefined };
tool._applyVoxelScale(unscaledVx);
assert(true, '_applyVoxelScale: uses [1,1,1] default for undefined scale');

// ── Summary ─────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\nResults: ${passed}/${total} passed, ${failed} failed`);
console.log('─'.repeat(50));
process.exit(failed === 0 ? 0 : 1);
