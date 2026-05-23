/**
 * VoxelCAD - Entry Point (Renderer Process)
 * Three.js-based voxel editor with physics & module system
 */
import * as THREE from 'three';
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

// ── Canvas / Scene ─────────────────────────────────────────────────────────
const canvas = document.getElementById('gl-canvas');
if (!canvas) {
  console.error('Canvas #gl-canvas not found in DOM');
  throw new Error('Canvas not found');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1923);
scene.fog = new THREE.FogExp2(0x0f1923, 0.015);

// ── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(8, 10, 12);
camera.lookAt(0, 0, 0);

// ── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Initial size set immediately — before any render pass
const initialW = Math.max(1, Math.floor(window.innerWidth - 260));
const initialH = Math.max(1, Math.floor(window.innerHeight - 48));
renderer.setSize(initialW, initialH, false);

// ── OrbitControls ───────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.1;
controls.mouseButtons = {
  LEFT: false,
  MIDDLE: THREE.MOUSE.PAN,
  RIGHT: THREE.MOUSE.ROTATE,
};

// ── Lights ──────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0x606080, 0.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(15, 25, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362a10, 0.35);
scene.add(hemiLight);

// ── Grid — INSERITO PRIMA DI OGNI ALTRA COSA ─────────────────────────────────
const gridHelper = new THREE.GridHelper(80, 80, 0x00d2ff, 0x00d2ff);
gridHelper.position.y = 0;
gridHelper.material.transparent = false;
gridHelper.material.opacity = 1.0;
scene.add(gridHelper);

// ── Origin marker ───────────────────────────────────────────────────────────
const originGeo  = new THREE.SphereGeometry(0.2, 12, 12);
const originMat  = new THREE.MeshBasicMaterial({ color: 0xe94560 });
const originMarker = new THREE.Mesh(originGeo, originMat);
scene.add(originMarker);

// ── Axes ────────────────────────────────────────────────────────────────────
const axesHelper = new THREE.AxesHelper(10);
scene.add(axesHelper);

// ── Brick dimensions HUD ─────────────────────────────────────────────────────
const dimensionDiv = document.getElementById('brick-dimensions');

// ── Core systems ─────────────────────────────────────────────────────────────
const materialDB       = new MaterialSystem();
const moduleSystem     = new ModuleSystem(materialDB);
const physics          = new PhysicsCalc(materialDB, moduleSystem);
const meshExporter     = new MeshExporter();
const voxelEngine      = new VoxelEngine(scene, materialDB, moduleSystem, camera, renderer, controls);
const brickSystem      = new BrickSystem(voxelEngine);
const proceduralEngine = new ProceduralEngine(voxelEngine);

// ── UI ───────────────────────────────────────────────────────────────────────
const ui = new UI({
  voxelEngine: voxelEngine,
  materialDB:  materialDB,
  moduleSystem,
  physics,
  meshExporter,
  proceduralEngine,
  controls,
  camera,
  renderer,
  scene,
});

// ── Resize handler ──────────────────────────────────────────────────────────
function resizeRenderer() {
  const w = Math.max(1, Math.floor(window.innerWidth - 260));
  const h = Math.max(1, Math.floor(window.innerHeight - 48));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

window.addEventListener('resize', resizeRenderer);
resizeRenderer();

// ── Animation Loop ──────────────────────────────────────────────────────────
let frameCount = 0;
let fpsTimer   = 0;

function animate(time) {
  requestAnimationFrame(animate);
  controls.update();

  // Brick dimensions HUD
  const sel = brickSystem.selectedBrick;
  if (sel) {
    dimensionDiv.textContent  = brickSystem.dimensionsText;
    dimensionDiv.style.display = 'block';
  } else {
    dimensionDiv.style.display = 'none';
  }

  // FPS counter — throttled
  frameCount++;
  if (time - fpsTimer >= 1000) {
    document.getElementById('fps-counter').textContent = 'FPS: ' + frameCount;
    frameCount = 0;
    fpsTimer   = time;
  }

  // Voxel hover ghost animation
  voxelEngine.update(time * 0.001);

  // Render
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);

console.log('%c◆ VoxelCAD v0.1.0 loaded', 'color: #e94560; font-size: 14px; font-weight: bold');
console.log('%c  Materiali: ' + materialDB.count() + ' | Moduli: ' + moduleSystem.count(), 'color: #8892a4');
