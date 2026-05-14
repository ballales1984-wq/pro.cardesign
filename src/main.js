/**
 * VoxelCAD - Entry Point (Renderer Process)
 * Three.js-based voxel editor with physics & module system
 */
import * as THREE from 'three';
import { FlyControls } from 'three/examples/jsm/controls/FlyControls.js';
import { VoxelEngine } from './voxel-engine.js';
import { MaterialSystem } from './material-system.js';
import { ModuleSystem } from './module-system.js';
import { PhysicsCalc } from './physics-calc.js';
import { MeshExporter } from './mesh-exporter.js';
import { UI } from './ui.js';

// Three.js Setup
var canvas = document.getElementById('gl-canvas');
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1923);
scene.fog = new THREE.FogExp2(0x0f1923, 0.035);

var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(8, 10, 12);

var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth - 270, window.innerHeight - 48);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

var controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.1;

// Lights
var ambientLight = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambientLight);

var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 15);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
scene.add(dirLight);

var hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x362a10, 0.3);
scene.add(hemiLight);

// Grid
var gridHelper = new THREE.GridHelper(40, 40, 0x1a3a5c, 0x0f2240);
gridHelper.position.y = -0.01;
scene.add(gridHelper);

// Axes
var axesHelper = new THREE.AxesHelper(3);
scene.add(axesHelper);

// Core Systems
var materialDB = new MaterialSystem();
var moduleSystem = new ModuleSystem(materialDB);
var physics = new PhysicsCalc(materialDB, moduleSystem);
var meshExporter = new MeshExporter();
var voxelEngine = new VoxelEngine(scene, materialDB, moduleSystem, camera, renderer, controls);

// Controls
var controls = new THREE.FlyControls(camera, renderer.domElement);
controls.movementSpeed = 10;
controls.domElement = renderer.domElement;
controls.rollSpeed = Math.PI / 24;
controls.autoForward = false;
controls.dragToLook = false;

// UI
var ui = new UI({
  voxelEngine: voxelEngine,
  materialDB: materialDB,
  moduleSystem: moduleSystem,
  physics: physics,
  meshExporter: meshExporter,
  controls: controls,
  camera: camera,
  renderer: renderer,
  scene: scene,
});

// Resize
window.addEventListener('resize', function() {
  var w = window.innerWidth - 270;
  var h = window.innerHeight - 48;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// Animation Loop
var frameCount = 0;
var fpsTimer = 0;

function animate(time) {
  requestAnimationFrame(animate);
  controls.update();

  frameCount++;
  if (time - fpsTimer >= 1000) {
    document.getElementById('fps-counter').textContent = 'FPS: ' + frameCount;
    frameCount = 0;
    fpsTimer = time;
  }

  voxelEngine.update(time * 0.001);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

console.log('%c◆ VoxelCAD v0.1.0 loaded', 'color: #e94560; font-size: 14px; font-weight: bold');
console.log('%c  Materiali: ' + materialDB.count() + ' | Moduli: ' + moduleSystem.count(), 'color: #8892a4');