/**
 * VoxelCAD - Entry Point (Renderer Process)
 * Three.js-based voxel editor with physics & module system
 */
// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
const THREE = await import('three');
;
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VoxelEngine } from './voxel-engine.js';
import { MaterialSystem } from './material-system.js';
import { ModuleSystem } from './module-system.js';
import { PhysicsCalc } from './physics-calc.js';
import { MeshExporter } from './mesh-exporter.js';
import { UI } from './ui.js';
import { BrickSystem } from './core/brick-system.js';
import { ComponentLibrary } from './core/component-library.js';
import { STLImporter, QualityAnalyzer } from './core/stl-import.js';
import { ProceduralEngine } from './core/procedural-engine.js';

// Three.js Setup
const canvas = document.getElementById('gl-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1923);
scene.fog = new THREE.FogExp2(0x0f1923, 0.035);

const viewport = document.getElementById('viewport');
const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 2000);
camera.position.set(8, 10, 12);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

let controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = Math.PI - 0.05;
controls.minDistance = 1.5;
controls.maxDistance = 500;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.8;
controls.rotateSpeed = 0.75;
controls.screenSpacePanning = true;
controls.mouseButtons = {
  LEFT: false, // Left click is reserved for interacting with voxels
  MIDDLE: THREE.MOUSE.PAN, // Middle click + drag to Pan
  RIGHT: THREE.MOUSE.ROTATE // Right click + drag to Rotate
};
// Ensure OrbitControls doesn't interfere
controls.enabled = true;

// Lights
const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 15);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362a10, 0.3);
scene.add(hemiLight);

// Grid — allineata alle coordinate intere dei voxel
const gridHelper = new THREE.GridHelper(40, 40, 0x2a4a7c, 0x1a3050);
gridHelper.position.set(0, 0, 0);
scene.add(gridHelper);

// Marker origine (pallino rosso al centro della scena)
const originGeo = new THREE.SphereGeometry(0.2, 12, 12);
const originMat = new THREE.MeshBasicMaterial({ color: 0xe94560 });
const originMarker = new THREE.Mesh(originGeo, originMat);
scene.add(originMarker);

// Assi principali X=Rosso, Y=Verde, Z=Blu, lunghezza 5 unità
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Core Systems
const materialDB = new MaterialSystem();
const moduleSystem = new ModuleSystem(materialDB);
const physics = new PhysicsCalc(materialDB, moduleSystem);
const meshExporter = new MeshExporter();
const voxelEngine = new VoxelEngine(scene, materialDB, moduleSystem, camera, renderer, controls);
const brickSystem = new BrickSystem(voxelEngine);
const proceduralEngine = new ProceduralEngine(voxelEngine);

// UI
const ui = new UI({
  voxelEngine: voxelEngine,
  materialDB: materialDB,
  moduleSystem: moduleSystem,
  physics: physics,
  meshExporter: meshExporter,
  proceduralEngine: proceduralEngine,
  controls: controls,
  camera: camera,
  renderer: renderer,
  scene: scene,
});

// Resize
function resizeRenderer() {
  const rect = viewport.getBoundingClientRect();
  const w = Math.max(1, Math.floor(rect.width));
  const h = Math.max(1, Math.floor(rect.height));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

window.addEventListener('resize', resizeRenderer);
resizeRenderer();

// ── DOM references cached once (no layout thrashing per-frame) ──────────────
const dimensionDiv  = document.getElementById('brick-dimensions');
const fpsCounterEl  = document.getElementById('fps-counter');

// HUD state — dirty flag pattern: update DOM only on change
let lastSelectedBrickId = null;
let lastHUDDims        = '';
let frameCount = 0;
let fpsTimer   = 0;

function updateHUD(time) {
  const sel = brickSystem.selectedBrick;

  // Brick dimension display
  if (sel) {
    const id = sel.id;
    if (id !== lastSelectedBrickId || brickSystem.dimensionsText !== lastHUDDims) {
      dimensionDiv.textContent  = brickSystem.dimensionsText;
      dimensionDiv.style.display = 'block';
      lastSelectedBrickId = id;
      lastHUDDims         = brickSystem.dimensionsText;
    }
  } else if (lastSelectedBrickId !== null) {
    dimensionDiv.style.display = 'none';
    lastSelectedBrickId = null;
    lastHUDDims         = '';
  }

  // FPS counter — throttled to once every 1000ms, no re-lookup
  frameCount++;
  if (time - fpsTimer >= 1000) {
    fpsCounterEl.textContent = 'FPS: ' + frameCount;
    frameCount = 0;
    fpsTimer  = time;
  }
}

// Animation Loop
function animate(time) {
  requestAnimationFrame(animate);
  controls.update();
  voxelEngine.update(time * 0.001);
  renderer.render(scene, camera);
  updateHUD(time);
}
requestAnimationFrame(animate);

console.log('%c◆ VoxelCAD v0.1.0 loaded', 'color: #e94560; font-size: 14px; font-weight: bold');
console.log('%c  Materiali: ' + materialDB.count() + ' | Moduli: ' + moduleSystem.count(), 'color: #8892a4');
