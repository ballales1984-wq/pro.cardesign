/**
 * VoxelCAD - Entry Point (Renderer Process)
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
import { ProceduralEngine } from './core/procedural-engine.js';

function showFatalError(message) {
  const box = document.createElement('div');
  box.id = 'voxelcad-error';
  box.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#1a1a2e;color:#f44336;' +
    'display:flex;align-items:center;justify-content:center;padding:24px;' +
    'font:14px/1.5 monospace;white-space:pre-wrap;text-align:center;';
  box.textContent = 'Errore VoxelCAD:\n\n' + message;
  document.body.appendChild(box);
}

function boot() {
  window.addEventListener('error', (e) => {
    console.error(e.error || e.message);
    showFatalError((e.error && e.error.stack) || e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error(e.reason);
    showFatalError(String(e.reason && e.reason.stack ? e.reason.stack : e.reason));
  });

  const canvas = document.getElementById('gl-canvas');
  const viewportEl = document.getElementById('viewport');
  if (!canvas || !viewportEl) {
    showFatalError('Elementi #gl-canvas o #viewport mancanti nel DOM.');
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1923);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  camera.position.set(8, 10, 12);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.error('WebGLRenderer failed:', err);
    viewportEl.innerHTML =
      '<p style="color:#f44336;padding:24px;text-align:center;">WebGL non disponibile. Aggiorna i driver GPU.</p>';
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0f1923, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.mouseButtons = {
    LEFT: false,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  };

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight.position.set(15, 25, 20);
  scene.add(dirLight);

  scene.add(new THREE.HemisphereLight(0x87ceeb, 0x362a10, 0.4));

  const gridHelper = new THREE.GridHelper(80, 80, 0x00d2ff, 0x334455);
  scene.add(gridHelper);

  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xe94560 })
    )
  );
  scene.add(new THREE.AxesHelper(12));

  const dimensionDiv = document.getElementById('brick-dimensions');
  const fpsEl = document.getElementById('fps-counter');

  const materialDB = new MaterialSystem();
  const moduleSystem = new ModuleSystem(materialDB);
  const physics = new PhysicsCalc(materialDB, moduleSystem);
  const meshExporter = new MeshExporter();
  const voxelEngine = new VoxelEngine(
    scene,
    materialDB,
    moduleSystem,
    camera,
    renderer,
    controls
  );
  const brickSystem = new BrickSystem(voxelEngine);
  const proceduralEngine = new ProceduralEngine(voxelEngine);

  try {
    new UI({
      voxelEngine,
      materialDB,
      moduleSystem,
      physics,
      meshExporter,
      proceduralEngine,
      controls,
      camera,
      renderer,
      scene,
    });
  } catch (err) {
    console.error('[UI] init failed:', err);
    showFatalError(err.stack || err.message);
    return;
  }

  let lastW = 0;
  let lastH = 0;

  function resizeRenderer() {
    const w = viewportEl.clientWidth;
    const h = viewportEl.clientHeight;
    if (w < 16 || h < 16) return false;

    if (w === lastW && h === lastH) return true;
    lastW = w;
    lastH = h;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    return true;
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resizeRenderer).observe(viewportEl);
  }
  window.addEventListener('resize', resizeRenderer);

  let frameCount = 0;
  let fpsTimer = 0;

  function animate(time) {
    requestAnimationFrame(animate);

    if (lastW < 16 || lastH < 16) resizeRenderer();

    controls.update();

    if (dimensionDiv) {
      const sel = brickSystem.selectedBrick;
      if (sel) {
        dimensionDiv.textContent = brickSystem.dimensionsText;
        dimensionDiv.style.display = 'block';
      } else {
        dimensionDiv.style.display = 'none';
      }
    }

    frameCount++;
    if (fpsEl && time - fpsTimer >= 1000) {
      fpsEl.textContent = 'FPS: ' + frameCount;
      frameCount = 0;
      fpsTimer = time;
    }

    voxelEngine.update(time * 0.001);
    renderer.render(scene, camera);
  }

  resizeRenderer();
  requestAnimationFrame(() => {
    resizeRenderer();
    animate(0);
  });

  console.log('VoxelCAD renderer OK', { w: lastW, h: lastH, webgl: renderer.capabilities.isWebGL2 });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
