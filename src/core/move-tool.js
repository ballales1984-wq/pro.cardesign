/**
 * MoveTool — click a brick and drag to reposition it
 *
 * Features:
 *  - MouseDown on an InstancedMesh body → pick the brick, create a camera-facing drag plane
 *  - MouseMove → raycast onto the plane, show ghost at the snapped grid position
 *  - MouseUp → silently remove brick from old grid cell, silently add it at the new one,
 *              push a MOVE history entry so Ctrl+Z undoes the relocation
 *
 * Shortcut
 *  M — toggle move tool (added in voxel-engine.js _onKeyDown)
 */

import * as THREE from 'three';

export class MoveTool {
  constructor(voxelEngine, scene, camera, renderer) {
    this.voxelEngine = voxelEngine;
    this.scene       = scene;
    this.camera      = camera;
    this.renderer    = renderer;

    this.isActive    = false;
    this.isDragging  = false;

    this.raycaster   = new THREE.Raycaster();
    this.pointer     = new THREE.Vector2();

    // State set on mouse-down
    this.selectedVoxel   = null;   // {x, y, z} — original grid coordinates
    this.startVoxelData  = null;   // voxel data snapshot (material, module, scale)
    this.dragStartWorld  = null;   // THREE.Vector3 — raycast hit point (world)
    this.dragPlane       = null;   // THREE.Plane — camera-facing, through world drag origin

    // Live feedback
    this.liveLabel  = null;        // DOM overlay
    this.ghostMesh  = null;        // semi-transparent box showing destination

    this._sensitivity = 100; // px per grid unit

    this._createLiveLabel();
    this._createGhostPreview();
  }

  // ── Activazione / disattivazione ─────────────────────────────────────────

  activate() {
    this.isActive = true;
    document.body.style.cursor = 'grab';
    this._bindEvents();
  }

  deactivate() {
    this.isActive  = false;
    this.isDragging = false;
    this._resetState();
    this._unbindEvents();
    if (this.ghostMesh) this.ghostMesh.visible = false;
    if (this.liveLabel) this.liveLabel.style.display = 'none';
  }

  // ── Event binding ────────────────────────────────────────────────────────

  _bindEvents() {
    this._onCanvasDown = this._onMouseDown.bind(this);
    this._onWinMove    = this._onMouseMove.bind(this);
    this._onWinUp      = this._onMouseUp.bind(this);
    this.renderer.domElement.addEventListener('pointerdown', this._onCanvasDown);
    window.addEventListener('pointermove', this._onWinMove);
    window.addEventListener('pointerup',   this._onWinUp);
  }

  _unbindEvents() {
    if (this._onCanvasDown) this.renderer.domElement.removeEventListener('pointerdown', this._onCanvasDown);
    window.removeEventListener('pointermove', this._onWinMove);
    window.removeEventListener('pointerup',   this._onWinUp);
  }

  // ── Mouse helpers ────────────────────────────────────────────────────────

  _getMousePos(event) {
    const canvas = this.renderer.domElement;
    const rect   = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return this.pointer;
  }

  // ── Private state helpers ─────────────────────────────────────────────────

  _resetState() {
    this.isDragging          = false;
    this.selectedVoxel       = null;
    this.startVoxelData      = null;
    this.dragStartWorld      = null;
    this.dragPlane           = null;
    if (this.liveLabel) this.liveLabel.style.display = 'none';
    this._removeFaceHighlight();
  }

  // ── MouseDown — pick the brick ───────────────────────────────────────────

  _onMouseDown(event) {
    if (!this.isActive || event.button !== 0) return;

    const mouse = this._getMousePos(event);
    this.raycaster.setFromCamera(mouse, this.camera);

    const intersections = this.raycaster.intersectObjects(
      Array.from(this.voxelEngine.instancedMeshes.values()), true
    );

    if (intersections.length === 0 || intersections[0].instanceId === undefined) return;

    const hit       = intersections[0];
    const matName   = hit.object.material.name;
    const instanceId = hit.instanceId;
    const keyArray  = this.voxelEngine.instanceToKey.get(matName);

    if (!keyArray) return;
    const key      = keyArray[instanceId];
    if (!key) return;

    const parts = key.split(',').map(Number);
    const { x, y, z } = this.voxelEngine._gridPos({ x: parts[0], y: parts[1], z: parts[2] });

    const voxel = this.voxelEngine.getVoxelAt(x, y, z);
    if (!voxel) return;

    this.isDragging         = true;
    this.selectedVoxel      = { x, y, z };
    this.startVoxelData     = { ...voxel };
    this.dragStartWorld     = hit.point.clone();

    // Build a camera-facing drag plane at the hit point
    const camDir        = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    this.dragPlane      = new THREE.Plane();
    this.dragPlane.setFromNormalAndCoplanarPoint(camDir, hit.point);

    this._createFaceHighlight(hit.point, camDir);
    this.liveLabel.style.display = 'block';
    this._updateLabel({ x, y, z });

    // Select + show ghost at original position
    this.voxelEngine.selectVoxel(x, y, z);
    this._setGhostAt({ x, y, z });

    // Let the VoxelEngine know we're intercepting this click
    event.stopPropagation();
  }

  // ── MouseMove — preview the destination ─────────────────────────────────

  _onMouseMove(event) {
    if (!this.isActive) return;

    const mouse = this._getMousePos(event);

    if (this.isDragging && this.dragStartWorld && this.dragPlane) {
      // Only update preview — do NOT mutate the real voxel yet
      this.raycaster.setFromCamera(mouse, this.camera);
      const worldHit = new THREE.Vector3();
      const ok = this.raycaster.ray.intersectPlane(this.dragPlane, worldHit);
      if (!ok) return;

      const delta = worldHit.clone().sub(this.dragStartWorld);
      const oldGrid = this.selectedVoxel;

      const newGrid = {
        x: oldGrid.x + Math.round(delta.x),
        y: oldGrid.y + Math.round(delta.y),
        z: oldGrid.z + Math.round(delta.z),
      };

      const dx = newGrid.x - oldGrid.x;
      const dy = newGrid.y - oldGrid.y;
      const dz = newGrid.z - oldGrid.z;

      // Animate ghost to the destination if it changed and destination is empty
      const occupied = this.voxelEngine.getVoxelAt(newGrid.x, newGrid.y, newGrid.z);
      if (!occupied && (dx !== 0 || dy !== 0 || dz !== 0)) {
        this._setGhostAt(newGrid);
      } else {
        this.ghostMesh.visible = false;
      }

      // Clamp scale / dtype for live label
      this._updateLabel(newGrid);
    }
  }

  // ── MouseUp — commit the move ───────────────────────────────────────────

  _onMouseUp(event) {
    if (!this.isDragging || !this.selectedVoxel) {
      this._resetState();
      return;
    }

    const oldPos = { ...this.selectedVoxel };
    this.raycaster.setFromCamera(this._getMousePos(event), this.camera);

    const worldHit = new THREE.Vector3();
    if (this.dragPlane && this.raycaster.ray.intersectPlane(this.dragPlane, worldHit)) {
      const delta = worldHit.clone().sub(this.dragStartWorld);
      const newPos = {
        x: oldPos.x + Math.round(delta.x),
        y: oldPos.y + Math.round(delta.y),
        z: oldPos.z + Math.round(delta.z),
      };
      const dx = newPos.x - oldPos.x;
      const dy = newPos.y - oldPos.y;
      const dz = newPos.z - oldPos.z;

      if ((dx !== 0 || dy !== 0 || dz !== 0) &&
          !this.voxelEngine.getVoxelAt(newPos.x, newPos.y, newPos.z)) {
        // ── Commit the relocation ──────────────────────────────────────
        const data = this.startVoxelData;
        // Remove from old slot (silent — no duplicate history entry)
        this.voxelEngine._removeVoxelSilently(oldPos.x, oldPos.y, oldPos.z);
        // Add at new slot (silent — we push our own history entry below)
        this.voxelEngine._addVoxelInternal(newPos, data.material, data.module);
        // Restore scale (default is [1,1,1], only overwrite if it was non-unit)
        const vd = this.voxelEngine.getVoxelAt(newPos.x, newPos.y, newPos.z);
        if (vd && data.scale) {
          vd.scale = [...data.scale];
          this.voxelEngine._applyVoxelScaleToVoxel(
            vd, vd.scale[0], vd.scale[1], vd.scale[2],
            this.voxelEngine._worldPos(newPos)
          );
        }

        this.voxelEngine._pushHistory({
          type: 'move',
          oldX: oldPos.x, oldY: oldPos.y, oldZ: oldPos.z,
          newX: newPos.x, newY: newPos.y, newZ: newPos.z,
          material: data.material,
          module:   data.module,
          scale:    data.scale || [1,1,1],
        });
        this.voxelEngine._onVoxelChanged();

        this.voxelEngine.selectVoxel(newPos.x, newPos.y, newPos.z);
        this.voxelEngine._notify(
          `Brick moved: (${oldPos.x},${oldPos.y},${oldPos.z}) → (${newPos.x},${newPos.y},${newPos.z})`,
          'success'
        );
      }
    }

    this._resetState();
  }

  // ── Live label ──────────────────────────────────────────────────────────

  _updateLabel(gridPos) {
    if (!this.liveLabel) return;
    const old = this.selectedVoxel;
    const dx  = old ? (gridPos.x - old.x) : 0;
    const dy  = old ? (gridPos.y - old.y) : 0;
    const dz  = old ? (gridPos.z - old.z) : 0;
    const sign = (n) => n >= 0 ? '+' : '';
    this.liveLabel.innerHTML =
      '<div style="font-weight:bold;margin-bottom:8px;">Move</div>' +
      `<div>Posizione: (${gridPos.x}, ${gridPos.y}, ${gridPos.z})</div>` +
      `<div>ΔX: ${sign(dx)}${dx}  ΔY: ${sign(dy)}${dy}  ΔZ: ${sign(dz)}${dz}</div>`;
  }

  // ── Ghost preview ───────────────────────────────────────────────────────

  _createGhostPreview() {
    const geo = new THREE.BoxGeometry();
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff, transparent: true, opacity: 0.25,
      depthWrite: false,
    });
    this.ghostMesh   = new THREE.Mesh(geo, mat);
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);
  }

  _setGhostAt(gridPos) {
    if (!this.ghostMesh) return;
    const vd  = this.startVoxelData;
    const scl = vd && vd.scale ? vd.scale : [1, 1, 1];
    const worldCenter = this.voxelEngine._worldPos(gridPos);

    this.ghostMesh.position.copy(worldCenter);
    this.ghostMesh.scale.set(scl[0], scl[1], scl[2]);
    this.ghostMesh.visible = true;
  }

  // ── Face highlight (inherited from ScalingTool pattern) ──────────────────

  _createFaceHighlight(point, dir) {
    this._removeFaceHighlight();
    const geo = new THREE.PlaneGeometry(0.3, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const hl = new THREE.Mesh(geo, mat);
    hl.position.copy(point);
    hl.position.add(dir.clone().multiplyScalar(0.02));
    hl.lookAt(point.clone().add(dir));
    this._faceHighlight = hl;
    this.scene.add(hl);
  }

  _removeFaceHighlight() {
    if (this._faceHighlight) {
      this.scene.remove(this._faceHighlight);
      this._faceHighlight.geometry.dispose();
      this._faceHighlight.material.dispose();
      this._faceHighlight = null;
    }
  }

  // ── Live label DOM ──────────────────────────────────────────────────────

  _createLiveLabel() {
    const el = document.createElement('div');
    el.id = 'move-live-label';
    el.style.cssText =
      'position:fixed;top:20px;right:20px;' +
      'background:rgba(0,0,0,0.9);color:#00d2ff;' +
      'padding:12px 16px;border-radius:8px;' +
      'font-family:monospace;font-size:12px;' +
      'border:1px solid #00d2ff;display:none;' +
      'z-index:10000;pointer-events:none;' +
      'min-width:190px;';
    document.body.appendChild(el);
    this.liveLabel = el;
  }

  // ── Teardown ────────────────────────────────────────────────────────────

  destroy() {
    this.deactivate();
    if (this.liveLabel && this.liveLabel.parentNode) this.liveLabel.parentNode.removeChild(this.liveLabel);
    if (this.ghostMesh) { this.scene.remove(this.ghostMesh); this.ghostMesh.geometry?.dispose(); this.ghostMesh.material?.dispose(); }
    this._removeFaceHighlight();
  }
}
