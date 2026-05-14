/**
 * VoxelEngine - Gestisce la griglia 3D, il rendering e l'interazione voxel
 */
export class VoxelEngine {
  constructor(scene, materialDB, moduleSystem, camera, renderer, controls) {
    this.scene = scene;
    this.materialDB = materialDB;
    this.moduleSystem = moduleSystem;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;

    this.voxels = new Map();
    this.meshes = new Map();

    this.voxelGroup = new THREE.Group();
    this.scene.add(this.voxelGroup);

    this.ghost = null;
    this._createGhost();

    this.highlight = null;
    this._createHighlight();

    // Geometry and material cache for performance
    this.sharedGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    this.materialCache = new Map();

    this._createAxisLabels();

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.selectedVoxel = null;
    this.activeMaterial = 'steel';
    this.activeModule = null;
    this.activeTool = 'add';
    this.voxelSize = 1.0;

    this._history = [];
    this._redoStack = [];
    this._maxHistory = 50;

    this._setupEvents();
  }

  _getMaterial(materialName) {
    const mat = this.materialDB.get(materialName);
    if (!mat) return null;
    const key = mat.name + '-' + mat.color + '-' + (mat.roughness || 0.4) + '-' + (mat.metalness || 0.3);
    let m = this.materialCache.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(mat.color),
        roughness: mat.roughness || 0.4,
        metalness: mat.metalness || 0.3,
      });
      this.materialCache.set(key, m);
    }
    return m;
  }

  _createAxisLabels() {
    const makeLabel = (text, color, pos) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.font = 'bold 48px sans-serif';
      ctx.fillStyle = '#' + color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 32);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(pos);
      sprite.scale.set(1.2, 0.6, 1);
      this.scene.add(sprite);
    };

    // X=red, Y=green, Z=blue
    makeLabel('X', 'ff4444', new THREE.Vector3(6, 0, 0));
    makeLabel('Y', '44ff44', new THREE.Vector3(0, 6, 0));
    makeLabel('Z', '4488ff', new THREE.Vector3(0, 0, 6));
  }

  _createGhost() {
    const geo = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    this.ghost = new THREE.Mesh(geo, mat);
    this.ghost.visible = false;
    this.scene.add(this.ghost);
  }

  _createHighlight() {
    const geo = new THREE.BoxGeometry(
      this.voxelSize * 1.05,
      this.voxelSize * 1.05,
      this.voxelSize * 1.05
    );
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({
      color: 0xe94560,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    this.highlight = new THREE.LineSegments(edges, mat);
    this.highlight.visible = false;
    this.scene.add(this.highlight);
  }

  _setupEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
    canvas.addEventListener('click', (e) => this._onPointerClick(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
  }

  _gridPos(worldPos) {
    return {
      x: Math.round(worldPos.x / this.voxelSize),
      y: Math.round(worldPos.y / this.voxelSize),
      z: Math.round(worldPos.z / this.voxelSize),
    };
  }

  _gridKey(v) {
    return v.x + ',' + v.y + ',' + v.z;
  }

  _worldPos(gridPos) {
    return new THREE.Vector3(
      gridPos.x * this.voxelSize,
      gridPos.y * this.voxelSize,
      gridPos.z * this.voxelSize
    );
  }

  _raycast(event) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const meshes = Array.from(this.meshes.values());
    if (meshes.length === 0) return null;

    const intersects = this.raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      const hit = intersects[0];
      const key = hit.object.userData.voxelKey;
      if (key) {
        const parts = key.split(',').map(Number);
        return { key: key, x: parts[0], y: parts[1], z: parts[2], point: hit.point, faceNormal: hit.face.normal };
      }
    }
    return null;
  }

  _onPointerMove(event) {
    const hit = this._raycast(event);
    if (hit) {
      this.highlight.position.copy(this._worldPos(hit));
      this.highlight.visible = true;

      if (this.activeTool === 'add') {
        const ghostPos = {
          x: hit.x + Math.round(hit.faceNormal.x),
          y: hit.y + Math.round(hit.faceNormal.y),
          z: hit.z + Math.round(hit.faceNormal.z),
        };
        this.ghost.position.copy(this._worldPos(ghostPos));
        this.ghost.visible = true;
      } else {
        this.ghost.visible = false;
      }
    } else {
      this.highlight.visible = false;
      this.ghost.visible = false;
    }
  }

  _onPointerClick(event) {
    if (event.button !== 0) return;
    const hit = this._raycast(event);
    if (!hit) return;

    if (this.activeTool === 'add') {
      const pos = {
        x: hit.x + Math.round(hit.faceNormal.x),
        y: hit.y + Math.round(hit.faceNormal.y),
        z: hit.z + Math.round(hit.faceNormal.z),
      };
      this.addVoxel(pos, this.activeMaterial, this.activeModule);
    } else if (this.activeTool === 'remove') {
      this.removeVoxel(hit.x, hit.y, hit.z);
    } else if (this.activeTool === 'select') {
      this.selectVoxel(hit.x, hit.y, hit.z);
    }
  }

  _onKeyDown(event) {
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    const key = event.key.toLowerCase();
    if (key === 'v') {
      this.setTool('select');
    } else if (key === 'a') {
      this.setTool('add');
    } else if (key === 'r') {
      this.setTool('remove');
    } else if (key === 'f') {
      this.setTool('fill');
    } else if (event.ctrlKey && key === 'x') {
      this.clearAll();
    } else if (event.ctrlKey && key === 'z') {
      this.undo();
    } else if (event.ctrlKey && key === 'y') {
      this.redo();
    }
  }

  addVoxel(pos, materialName, moduleId) {
    if (moduleId === undefined) moduleId = null;
    const key = this._gridKey(pos);
    if (this.voxels.has(key)) return false;

    const material = this.materialDB.get(materialName);
    if (!material) return false;

    const voxelData = {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      material: materialName,
      module: moduleId,
      density: material.density,
      temperature: 293,
      damage: 0,
    };
    this.voxels.set(key, voxelData);

    const meshMaterial = this._getMaterial(materialName);
    const mesh = new THREE.Mesh(this.sharedGeometry, meshMaterial);
    mesh.position.copy(this._worldPos(pos));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.voxelKey = key;

    this.voxelGroup.add(mesh);
    this.meshes.set(key, mesh);

    this._pushHistory({ type: 'add', x: pos.x, y: pos.y, z: pos.z, material: materialName, module: moduleId });
    this._onVoxelChanged();
    return true;
  }

  removeVoxel(x, y, z) {
    const key = this._gridKey({ x: x, y: y, z: z });
    const mesh = this.meshes.get(key);
    if (mesh) {
      const voxel = this.voxels.get(key);
      this._pushHistory({ type: 'remove', x: x, y: y, z: z, material: voxel ? voxel.material : null, module: voxel ? voxel.module : null });
      this.voxelGroup.remove(mesh);
      this.meshes.delete(key);
    }
    this.voxels.delete(key);
    this._onVoxelChanged();
  }

  fillLayer(y, materialName, moduleId) {
    if (moduleId === undefined) moduleId = null;
    let added = 0;
    const radius = 5;
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        if (x === -radius || x === radius || z === -radius || z === radius) {
          if (this.addVoxel({ x: x, y: y, z: z }, materialName, moduleId)) added++;
        }
      }
    }
    return added;
  }

  selectVoxel(x, y, z) {
    this.selectedVoxel = { x: x, y: y, z: z };
    const key = this._gridKey({ x: x, y: y, z: z });
    const voxel = this.voxels.get(key);
    if (voxel) {
      this.highlight.position.copy(this._worldPos(voxel));
      this.highlight.visible = true;
    }
    window.dispatchEvent(new CustomEvent('voxel-selected', { detail: voxel || null }));
    return voxel;
  }

  getVoxelAt(x, y, z) {
    return this.voxels.get(this._gridKey({ x: x, y: y, z: z }));
  }

  getVoxelsInModule(moduleId) {
    const result = [];
    for (const entry of this.voxels) {
      const v = entry[1];
      if (v.module === moduleId) result.push(v);
    }
    return result;
  }

  clearAll() {
    for (const entry of this.meshes) {
      this.voxelGroup.remove(entry[1]);
    }
    this.meshes.clear();
    this.voxels.clear();
    this.selectedVoxel = null;
    this.clearHistory();

    // Dispose shared resources
    if (this.sharedGeometry) this.sharedGeometry.dispose();
    this.sharedGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
    if (this.materialCache) {
      for (const mat of this.materialCache.values()) {
        if (mat) mat.dispose();
      }
      this.materialCache.clear();
    }

    this._onVoxelChanged();
  }

  setTool(tool) {
    this.activeTool = tool;
    const btns = document.querySelectorAll('.tool');
    for (let i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    const btnMap = { select: 'tool-select', add: 'tool-add', remove: 'tool-remove', fill: 'tool-fill' };
    const el = document.getElementById(btnMap[tool]);
    if (el) el.classList.add('active');
    window.dispatchEvent(new CustomEvent('tool-changed', { detail: tool }));
  }

  _pushHistory(action) {
    this._history.push(action);
    if (this._history.length > this._maxHistory) this._history.shift();
    this._redoStack = [];
  }

  undo() {
    if (this._history.length === 0) return;
    const action = this._history.pop();
    this._redoStack.push(action);
    if (action.type === 'add') {
      this._removeVoxelSilently(action.x, action.y, action.z);
    } else if (action.type === 'remove') {
      this._addVoxelSilently({ x: action.x, y: action.y, z: action.z }, action.material, action.module);
    }
    this._onVoxelChanged();
  }

  redo() {
    if (this._redoStack.length === 0) return;
    const action = this._redoStack.pop();
    this._pushHistory(action);
    if (action.type === 'add') {
      this._addVoxelSilently({ x: action.x, y: action.y, z: action.z }, action.material, action.module);
    } else if (action.type === 'remove') {
      this._removeVoxelSilently(action.x, action.y, action.z);
    }
    this._onVoxelChanged();
  }

  _addVoxelSilently(pos, materialName, moduleId) {
    if (moduleId === undefined) moduleId = null;
    const key = this._gridKey(pos);
    if (this.voxels.has(key)) return false;
    const material = this.materialDB.get(materialName);
    if (!material) return false;
    const voxelData = { x: pos.x, y: pos.y, z: pos.z, material: materialName, module: moduleId, density: material.density, temperature: 293, damage: 0 };
    this.voxels.set(key, voxelData);
    const meshMaterial = this._getMaterial(materialName);
    const mesh = new THREE.Mesh(this.sharedGeometry, meshMaterial);
    mesh.position.copy(this._worldPos(pos));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.voxelKey = key;
    this.voxelGroup.add(mesh);
    this.meshes.set(key, mesh);
    return true;
  }

  _removeVoxelSilently(x, y, z) {
    const key = this._gridKey({ x: x, y: y, z: z });
    const mesh = this.meshes.get(key);
    if (mesh) {
      this.voxelGroup.remove(mesh);
      this.meshes.delete(key);
    }
    this.voxels.delete(key);
  }

  clearHistory() {
    this._history = [];
    this._redoStack = [];
  }

  toJSON() {
    return {
      voxels: Array.from(this.voxels.entries()).map(function(entry) { return entry[1]; }),
      modules: this.moduleSystem.toJSON(),
      version: '0.1.0',
    };
  }

  fromJSON(data) {
    this.clearAll();
    if (data.modules) this.moduleSystem.fromJSON(data.modules);
    const voxels = data.voxels || [];
    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i];
      this.voxels.set(this._gridKey(v), v);
      const meshMaterial = this._getMaterial(v.material);
      if (!meshMaterial) continue;
      const mesh = new THREE.Mesh(this.sharedGeometry, meshMaterial);
      mesh.position.set(v.x * this.voxelSize, v.y * this.voxelSize, v.z * this.voxelSize);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.voxelKey = this._gridKey(v);
      this.voxelGroup.add(mesh);
      this.meshes.set(this._gridKey(v), mesh);
    }
    this._onVoxelChanged();
  }

  resetCamera() {
    if (!this.controls) return;
    this.camera.position.set(8, 10, 12);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _onVoxelChanged() {
    try {
      const el = document.getElementById('voxel-count');
      if (el) el.textContent = 'Voxel: ' + this.voxels.size;
      window.dispatchEvent(new CustomEvent('voxels-updated', { detail: { count: this.voxels.size } }));
    } catch (e) {
      // silently ignore if DOM element not found
    }
  }

  update(deltaTime) {
    if (this.ghost && this.ghost.visible) {
      this.ghost.material.opacity = 0.2 + Math.sin(performance.now() * 0.005) * 0.1;
    }
  }
}