/**
 * VoxelEngine - Gestisce la griglia 3D, il rendering e l'interazione voxel
 *
 * Utilizza InstancedMesh per materiale — un unico draw call per materiale
 * anziché uno per voxel. Miglioramento: ~10-50x con scene grandi.
 */
import * as THREE from 'three';

export class VoxelEngine {
  constructor(scene, materialDB, moduleSystem, camera, renderer, controls) {
    this.scene = scene;
    this.materialDB = materialDB;
    this.moduleSystem = moduleSystem;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;

    this.voxels = new Map();

    // Instanced rendering: un InstancedMesh per materiale
    this.instancedMeshes = new Map();  // materialName -> THREE.InstancedMesh
    this.instanceToKey = new Map();    // materialName -> [voxelKey[]] indexed by instanceId
    this.keyToInstance = new Map();    // materialName -> Map(voxelKey -> instanceId)
    this.freeIndices = new Map();      // materialName -> [liberi instanceId]
    this.maxInstances = 200000;        // max per materiale

    this.voxelGroup = new THREE.Group();
    this.scene.add(this.voxelGroup);

    this.ghost = null;
    this._createGhost();

    this.highlight = null;
    this._createHighlight();

    this.sharedGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);

    this._createAxisLabels();

    // Ground plane invisibile per il raycast (primo voxel)
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshBasicMaterial({ visible: false });
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.scene.add(this.groundPlane);

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
    this._maxRedo = 50;

    this._setupEvents();
  }

  // ── InstancedMesh management ──────────────────────────────────

  _getInstancedMesh(materialName) {
    let mesh = this.instancedMeshes.get(materialName);
    if (mesh) return mesh;

    const mat = this.materialDB.get(materialName);
    if (!mat) return null;

    const opts = {
      color: new THREE.Color(mat.color),
      roughness: mat.roughness || 0.4,
      metalness: mat.metalness || 0.3,
    };
    if (mat.transparent) {
      opts.transparent = true;
      opts.opacity = mat.opacity || 0.6;
      opts.depthWrite = false;
    }

    const material = new THREE.MeshStandardMaterial(opts);
    material.name = materialName;
    mesh = new THREE.InstancedMesh(this.sharedGeometry, material, this.maxInstances);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    this.voxelGroup.add(mesh);

    this.instancedMeshes.set(materialName, mesh);
    this.instanceToKey.set(materialName, new Array(this.maxInstances).fill(null));
    this.keyToInstance.set(materialName, new Map());
    this.freeIndices.set(materialName, []);

    return mesh;
  }

  _getInstanceId(materialName) {
    const free = this.freeIndices.get(materialName);
    if (free && free.length > 0) return free.pop();
    const map = this.keyToInstance.get(materialName);
    return map ? map.size : 0;
  }

  _setInstanceMatrix(mesh, instanceId, position) {
    const matrix = new THREE.Matrix4();
    matrix.makeTranslation(position.x, position.y, position.z);
    mesh.setMatrixAt(instanceId, matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  // ── Rendering ────────────────────────────────────────────────

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

    makeLabel('X', 'ff4444', new THREE.Vector3(6, 0, 0));
    makeLabel('Y', '44ff44', new THREE.Vector3(0, 6, 0));
    makeLabel('Z', '4488ff', new THREE.Vector3(0, 0, 6));
  }

  _createGhost() {
    const geo = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      wireframe: true,
      linewidth: 2,
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

  // ── Raycast con supporto InstancedMesh e ground plane ───────────────────────

  _raycast(event) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    // 1. Controlla prima i voxel (InstancedMesh)
    const meshes = Array.from(this.instancedMeshes.values());
    if (meshes.length > 0) {
      const intersects = this.raycaster.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.instanceId !== undefined) {
          const materialName = hit.object.material.name;
          const key = this.instanceToKey.get(materialName)?.[hit.instanceId];
          if (key) {
            const parts = key.split(',').map(Number);
            return { key, x: parts[0], y: parts[1], z: parts[2], point: hit.point, faceNormal: hit.face.normal, isGround: false };
          }
        }
      }
    }

    // 2. Se nessun voxel colpito, controlla il ground plane
    const groundIntersects = this.raycaster.intersectObject(this.groundPlane);
    if (groundIntersects.length > 0) {
      const p = groundIntersects[0].point;
      return {
        x: Math.round(p.x),
        y: 0,
        z: Math.round(p.z),
        point: p,
        faceNormal: new THREE.Vector3(0, 1, 0),
        isGround: true,
      };
    }

    return null;
  }

  _onPointerMove(event) {
    const hit = this._raycast(event);
    this.highlight.visible = false;
    this.ghost.visible = false;

    if (!hit) return;

    if (!hit.isGround) {
      // Colpito un voxel esistente
      this.highlight.position.copy(this._worldPos({ x: hit.x, y: hit.y, z: hit.z }));
      this.highlight.visible = true;

      if (this.activeTool === 'add') {
        const ghostPos = {
          x: hit.x + Math.round(hit.faceNormal.x),
          y: hit.y + Math.round(hit.faceNormal.y),
          z: hit.z + Math.round(hit.faceNormal.z),
        };
        this.ghost.position.copy(this._worldPos(ghostPos));
        this.ghost.visible = true;
      }
    } else {
      // Colpito il ground plane
      if (this.activeTool === 'add') {
        const ghostPos = { x: hit.x, y: 0.5, z: hit.z };
        this.ghost.position.copy(this._worldPos(ghostPos));
        this.ghost.visible = true;
      }
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

  // ── Voxel operations ─────────────────────────────────────────

  addVoxel(pos, materialName, moduleId) {
    if (moduleId === undefined) moduleId = null;
    const key = this._gridKey(pos);

    if (this.voxels.has(key)) {
      const existing = this.voxels.get(key);
      if (existing.material !== materialName) {
        this._removeVoxelSilently(existing.x, existing.y, existing.z);
        return this._addVoxelInternal(pos, materialName, moduleId);
      }
      return false;
    }

    return this._addVoxelInternal(pos, materialName, moduleId);
  }

  _addVoxelInternal(pos, materialName, moduleId) {
    const material = this.materialDB.get(materialName);
    if (!material) return false;

    const key = this._gridKey(pos);
    const voxelData = {
      x: pos.x, y: pos.y, z: pos.z,
      material: materialName,
      module: moduleId,
      density: material.density,
      temperature: 293,
      damage: 0,
    };
    this.voxels.set(key, voxelData);

    const mesh = this._getInstancedMesh(materialName);
    if (!mesh) return false;

    const instanceId = this._getInstanceId(materialName);
    this._setInstanceMatrix(mesh, instanceId, this._worldPos(pos));

    this.keyToInstance.get(materialName).set(key, instanceId);
    this.instanceToKey.get(materialName)[instanceId] = key;

    // Update instance count to ensure voxel is rendered
    if (instanceId + 1 > mesh.count) {
      mesh.count = instanceId + 1;
    }

    this._pushHistory({ type: 'add', x: pos.x, y: pos.y, z: pos.z, material: materialName, module: moduleId });
    this._onVoxelChanged();
    return true;
  }

  removeVoxel(x, y, z) {
    const key = this._gridKey({ x, y, z });
    const voxel = this.voxels.get(key);
    if (!voxel) return;

    const mat = this.materialDB.get(voxel.material);
    this._pushHistory({ type: 'remove', x, y, z, material: voxel.material, module: voxel.module });
    this._removeVoxelSilently(x, y, z);
    this._onVoxelChanged();
  }

  fillLayer(y, materialName, moduleId, solid = false) {
    if (moduleId === undefined) moduleId = null;
    let added = 0;
    const radius = 5;
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        if (solid || x === -radius || x === radius || z === -radius || z === radius) {
          if (this.addVoxel({ x, y, z }, materialName, moduleId)) added++;
        }
      }
    }
    return added;
  }

  selectVoxel(x, y, z) {
    this.selectedVoxel = { x, y, z };
    const key = this._gridKey({ x, y, z });
    const voxel = this.voxels.get(key);
    if (voxel) {
      this.highlight.position.copy(this._worldPos(voxel));
      this.highlight.visible = true;
    }
    window.dispatchEvent(new CustomEvent('voxel-selected', { detail: voxel || null }));
    return voxel;
  }

  getVoxelAt(x, y, z) {
    return this.voxels.get(this._gridKey({ x, y, z }));
  }

  getVoxelsInModule(moduleId) {
    const result = [];
    for (const v of this.voxels.values()) {
      if (v.module === moduleId) result.push(v);
    }
    return result;
  }

  // ── Internal remove (without history push) ───────────────────

  _removeVoxelSilently(x, y, z) {
    const key = this._gridKey({ x, y, z });
    const voxel = this.voxels.get(key);
    if (!voxel) return;

    const matName = voxel.material;
    const instMap = this.keyToInstance.get(matName);
    const idxMap = this.instanceToKey.get(matName);
    const mesh = this.instancedMeshes.get(matName);

    if (instMap && idxMap && mesh) {
      const instanceId = instMap.get(key);
      if (instanceId !== undefined) {
        const hiddenMatrix = new THREE.Matrix4();
        hiddenMatrix.makeScale(0, 0, 0);
        mesh.setMatrixAt(instanceId, hiddenMatrix);
        mesh.instanceMatrix.needsUpdate = true;

        instMap.delete(key);
        idxMap[instanceId] = null;
        this.freeIndices.get(matName)?.push(instanceId);
      }
    }
    this.voxels.delete(key);
  }

  // ── Undo / Redo ──────────────────────────────────────────────

  clearAll() {
    for (const [matName, mesh] of this.instancedMeshes) {
      const identity = new THREE.Matrix4();
      for (let i = 0; i < mesh.count; i++) {
        mesh.setMatrixAt(i, identity);
      }
      mesh.count = 0;
      mesh.instanceMatrix.needsUpdate = true;
    }

    const free = [];
    for (const [matName] of this.instancedMeshes) {
      this.keyToInstance.get(matName)?.clear();
      this.instanceToKey.set(matName, new Array(this.maxInstances).fill(null));
      free.length = 0;
    }

    this.voxels.clear();
    this.selectedVoxel = null;
    this.clearHistory();
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

  _pushRedo(action) {
    this._redoStack.push(action);
    if (this._redoStack.length > this._maxRedo) this._redoStack.shift();
  }

  undo() {
    if (this._history.length === 0) return;
    const action = this._history.pop();
    this._pushRedo(action);
    if (action.type === 'add') {
      this._removeVoxelSilently(action.x, action.y, action.z);
    } else if (action.type === 'remove') {
      this._addVoxelInternal({ x: action.x, y: action.y, z: action.z }, action.material, action.module);
    }
    this._onVoxelChanged();
  }

  redo() {
    if (this._redoStack.length === 0) return;
    const action = this._redoStack.pop();
    this._pushHistory(action);
    if (action.type === 'add') {
      this._addVoxelInternal({ x: action.x, y: action.y, z: action.z }, action.material, action.module);
    } else if (action.type === 'remove') {
      this._removeVoxelSilently(action.x, action.y, action.z);
    }
    this._onVoxelChanged();
  }

  clearHistory() {
    this._history = [];
    this._redoStack = [];
  }

  // ── Persistenza ──────────────────────────────────────────────

  toJSON() {
    return {
      voxels: Array.from(this.voxels.values()),
      modules: this.moduleSystem.toJSON(),
      version: '0.2.0',
    };
  }

  fromJSON(data) {
    this.clearAll();

    if (!data || typeof data !== 'object') {
      console.error('[VoxelEngine] Invalid JSON data');
      return;
    }

    if (data.modules) this.moduleSystem.fromJSON(data.modules);
    const voxels = data.voxels || [];
    if (!Array.isArray(voxels)) {
      console.error('[VoxelEngine] voxels must be an array');
      return;
    }

    let loaded = 0;
    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i];
      if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number' || !v.material) {
        console.warn('[VoxelEngine] Skipping invalid voxel at index', i);
        continue;
      }
      const key = this._gridKey(v);
      if (this.voxels.has(key)) continue;
      this._addVoxelInternal({ x: v.x, y: v.y, z: v.z }, v.material, v.module);
      loaded++;
    }
    this._onVoxelChanged();
    console.log(`[VoxelEngine] Loaded ${loaded} voxels from JSON`);
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
      // silently ignore
    }
  }

  update(deltaTime) {
    if (this.ghost && this.ghost.visible) {
      this.ghost.material.opacity = 0.2 + Math.sin(performance.now() * 0.005) * 0.1;
    }
  }
}