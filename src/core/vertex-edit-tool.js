/**
 * VertexEditTool - Drag individual brick vertices (Blender-style)
 * Phase 1: vertex handles only.  Edge handles → separate PBI.
 * Shortcut: E
 */

import * as THREE from 'three';

export class VertexEditTool {
  constructor(voxelEngine, scene, camera, renderer) {
    this.voxelEngine = voxelEngine;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.isActive = false;
    this.isDragging = false;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._plane = new THREE.Plane();

    this.selectedHandleIdx  = null;
    this.selectedVoxel      = null;

    this.dragHandleIdx      = null;
    this.dragStartPositions = null;
    this.dragStartMouse     = null;

    this.liveLabel        = null;
    this.activeHandles    = [];
    this._handleGeometry = null;

    this._createLiveLabel();
  }

  // ── Geometry helpers ───────────────────────────────────────────────────

  /**
   * 8 world-space vertices for the cube associated with this voxel.
   * Indices: i=0..7 such that i and (7-i) are opposite corners.
   */
  _getVertexWorldPositions(voxel) {
    const center = this.voxelEngine._worldPos
      ? this.voxelEngine._worldPos({ x: voxel.x, y: voxel.y, z: voxel.z })
      : new THREE.Vector3(voxel.x + 0.5, voxel.y + 0.5, voxel.z + 0.5);

    const sc     = voxel.scale || [1, 1, 1];
    const half   = new THREE.Vector3((sc[0] || 1) * 0.5, (sc[1] || 1) * 0.5, (sc[2] || 1) * 0.5);
    const VS     = this.voxelEngine.voxelSize || 1.0;
    const hx = half.x * VS, hy = half.y * VS, hz = half.z * VS;

    return [
      new THREE.Vector3(center.x - hx, center.y - hy, center.z - hz),
      new THREE.Vector3(center.x + hx, center.y - hy, center.z - hz),
      new THREE.Vector3(center.x - hx, center.y + hy, center.z - hz),
      new THREE.Vector3(center.x + hx, center.y + hy, center.z - hz),
      new THREE.Vector3(center.x - hx, center.y - hy, center.z + hz),
      new THREE.Vector3(center.x + hx, center.y - hy, center.z + hz),
      new THREE.Vector3(center.x - hx, center.y + hy, center.z + hz),
      new THREE.Vector3(center.x + hx, center.y + hy, center.z + hz),
    ];
  }

  /**
   * Given 8 vertices (one possibly replaced by vNew), compute new Brick dimensions.
   * Returns { sx, sy, sz } in voxel units.  Each side clamped to >= 1.
   */
  _computeBrickFromVertices(vertices, draggedIdx, vNew) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = (i === draggedIdx && vNew) ? vNew : vertices[i];
      if (v.x < minX) minX = v.x;  if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;  if (v.y > maxY) maxY = v.y;
      if (v.z < minZ) minZ = v.z;  if (v.z > maxZ) maxZ = v.z;
    }
    const VS = this.voxelEngine.voxelSize || 1.0;
    return {
      sx: Math.max(1, Math.round((maxX - minX) / VS)),
      sy: Math.max(1, Math.round((maxY - minY) / VS)),
      sz: Math.max(1, Math.round((maxZ - minZ) / VS)),
    };
  }

  // ── Gizmo handles ──────────────────────────────────────────────────────

  _handleGeo() {
    if (!this._handleGeometry) this._handleGeometry = new THREE.OctahedronGeometry(0.06, 0);
    return this._handleGeometry;
  }

  _makeHandleMat() {
    return new THREE.MeshBasicMaterial({
      color: 0x00d2ff, transparent: true, opacity: 0.90,
      depthTest: true, depthWrite: false,
    });
  }

  _createHandles(voxel) {
    this._removeHandles();
    const positions = this._getVertexWorldPositions(voxel);
    const geo      = this._handleGeo();

    this.activeHandles = positions.map(pos => {
      const mesh = new THREE.Mesh(geo, this._makeHandleMat());
      mesh.position.copy(pos);
      this.scene.add(mesh);
      return mesh;
    });
  }

  _removeHandles() {
    this.activeHandles.forEach(h => {
      this.scene.remove(h);
      h.material.dispose();
    });
    this.activeHandles = [];
    this._handleGeometry = null;   // lazily recreated on next activate
  }

  _handleAt(idx) {
    return this.activeHandles[idx] || null;
  }

  _findClosestHandleByRay(mouse) {
    this.raycaster.setFromCamera(mouse, this.camera);
    let closestId = null, closestDist = Infinity;
    for (let i = 0; i < this.activeHandles.length; i++) {
      const hits = this.raycaster.intersectObject(this.activeHandles[i]);
      if (hits.length > 0) {
        const d = hits[0].point.distanceTo(this.camera.position);
        if (d < closestDist) { closestDist = d; closestId = i; }
      }
    }
    return closestId;
  }

  // ── Screen <-> world axis helpers ──────────────────────────────────────

  _axisWorld() {
    return [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];
  }

  _axisScreen() {
    const toScr = v => {
      const c = v.clone().project(this.camera);
      return new THREE.Vector2(c.x, c.y);
    };
    return [toScr(new THREE.Vector3(1, 0, 0)),
            toScr(new THREE.Vector3(0, 1, 0)),
            toScr(new THREE.Vector3(0, 0, 1))];
  }

  _dominantAxis(dpScreen, axisScreenVectors) {
    let bestIdx = 0, bestMag = -Infinity;
    for (let i = 0; i < 3; i++) {
      const m = Math.abs(dpScreen.dot(axisScreenVectors[i]));
      if (m > bestMag) { bestMag = m; bestIdx = i; }
    }
    return bestIdx;
  }

  _screenDeltaToWorld(dpScreen, axesWorld, axesScreen) {
    let bestD = 0, bestW = new THREE.Vector3();
    for (let i = 0; i < 3; i++) {
      const lsq = axesScreen[i].lengthSq();
      if (lsq > 0.0001) {
        const d = dpScreen.dot(axesScreen[i]) / lsq;
        if (Math.abs(d) > Math.abs(bestD)) { bestD = d; bestW.copy(axesWorld[i]); }
      }
    }
    return bestW.multiplyScalar(bestD);
  }

  // ── Live label ─────────────────────────────────────────────────────────

  _createLiveLabel() {
    const el = document.createElement('div');
    el.id = 'vertex-edit-live-label';
    el.style.cssText =
      'position:fixed;top:20px;right:20px;' +
      'background:rgba(0,0,0,0.9);color:#ff6b6b;' +
      'padding:12px 16px;border-radius:8px;' +
      'font-family:monospace;font-size:12px;' +
      'border:1px solid #ff6b6b;display:none;' +
      'z-index:10000;pointer-events:none;min-width:180px;';
    document.body.appendChild(el);
    this.liveLabel = el;
  }

  _updateLiveLabel(axisName, newSize) {
    if (!this.liveLabel) return;
    this.liveLabel.innerHTML =
      '<div style="font-weight:bold;margin-bottom:8px;">Vertex Edit</div>' +
      `<div>Asse: ${axisName.toUpperCase()}</div>` +
      `<div>W: ${newSize.sx.toFixed(1)} mm</div>` +
      `<div>H: ${newSize.sy.toFixed(1)} mm</div>` +
      `<div>D: ${newSize.sz.toFixed(1)} mm</div>`;
  }

  // ── Activate / Deactivate ─────────────────────────────────────────────

  activate() {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    this._bindEvents();
  }

  deactivate() {
    this.isActive  = false;
    this.isDragging = false;
    this.dragHandleIdx = null;
    this._removeHandles();
    this.selectedVoxel = null;
    if (this.liveLabel) this.liveLabel.style.display = 'none';
    this._unbindEvents();
  }

  _bindEvents() {
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp   = this._onMouseUp.bind(this);

    this._boundCanvas = this.renderer.domElement;
    this._boundCanvas.addEventListener('pointerdown', this._onMouseDown);
    window.addEventListener('pointermove', this._onMouseMove);
    window.addEventListener('pointerup',   this._onMouseUp);
  }

  _unbindEvents() {
    if (this._boundCanvas) {
      this._boundCanvas.removeEventListener('pointerdown', this._onMouseDown);
    }
    window.removeEventListener('pointermove', this._onMouseMove);
    window.removeEventListener('pointerup',   this._onMouseUp);
  }

  _getMousePos(event) {
    const canvas = this.renderer.domElement;
    const rect   = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return this.pointer;
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────

  _cornerAxisLabel(idx) {
    const labels = ['X−','X+','Y−','Y+','Z−','Z+','X−','X+'];
    return labels[idx] || '?';
  }

  _onMouseDown(event) {
    if (!this.isActive || event.button !== 0) return;

    // Click in voxel -> select via voxelEngine; click handles -> drag them
    const mouse = this._getMousePos(event);
    this.raycaster.setFromCamera(mouse, this.camera);

    // Query voxels via the same path useState elsewhere
    const hit = this.voxelEngine._raycast
      ? this.voxelEngine._raycast(event)
      : null;

    if (!hit || hit.isGround) {
      // Clicked empty space -> deselect
      this.selectedVoxel = null;
      this._removeHandles();
      this.voxelEngine.selectedVoxel = null;
      this.voxelEngine.highlight.visible = false;
      return;
    }

    const x = hit.x, y = hit.y, z = hit.z;
    const voxel = this.voxelEngine.getVoxelAt(x, y, z);
    if (!voxel) return;

    // ── Click on an existing voxel → select and show handles ──
    if (!this.selectedVoxel ||
        this.selectedVoxel.x !== x || this.selectedVoxel.y !== y || this.selectedVoxel.z !== z) {

      this.selectedVoxel = { x, y, z };
      this.voxelEngine.selectVoxel(x, y, z);
      this._createHandles(voxel);
      return;          // first click on a new brick = select only
    }

    // ── Click on an existing handle → begin drag ────────────────
    const handleIdx = this._findClosestHandleByRay(mouse);
    if (handleIdx === null) return;

    this.isDragging        = true;
    this.dragHandleIdx     = handleIdx;
    const positions        = this._getVertexWorldPositions(this.selectedVoxel);
    this.dragStartPositions = positions.map(p => p.clone());
    this.dragStartMouse     = mouse.clone();
    this._axesWorld = this._axisWorld();
    this._axesScreen = this._axisScreen();

    this.liveLabel.style.display = 'block';

    const picked = this._handleAt(handleIdx);
    if (picked) { picked.material.color.set(0xff6b6b); picked.material.opacity = 1.0; }
  }

  _onMouseMove(event) {
    if (!this.isActive || !this.isDragging || this.dragHandleIdx === null) return;

    const mouse    = this._getMousePos(event);
    const dp       = new THREE.Vector2(
      mouse.x - this.dragStartMouse.x,
      mouse.y - this.dragStartMouse.y
    );

    const axIdx    = this._dominantAxis(dp, this._axesScreen);
    const wdp      = this._screenDeltaToWorld(dp, this._axesWorld, this._axesScreen);
    const origVert  = this.dragStartPositions[this.dragHandleIdx];
    const vNew      = origVert.clone().add(wdp);

    // Preview: update handle mesh position
    const h = this._handleAt(this.dragHandleIdx);
    if (h) h.position.copy(vNew);

    // Preview: compute new bricksize for label
    const newSize = this._computeBrickFromVertices(this.dragStartPositions, this.dragHandleIdx, vNew);
    this._updateLiveLabel(this._cornerAxisLabel(this.dragHandleIdx), newSize);
  }

  _onMouseUp(event) {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (this.selectedVoxel && this.dragHandleIdx !== null && this.dragStartPositions) {
      const voxel = this.voxelEngine.getVoxelAt(
        this.selectedVoxel.x, this.selectedVoxel.y, this.selectedVoxel.z
      );

      if (voxel) {
        const h   = this._handleAt(this.dragHandleIdx);
        const vNew = h ? h.position.clone() : null;
        const brickDims = this._computeBrickFromVertices(
          this.dragStartPositions, this.dragHandleIdx, vNew
        );

        // Save old scale for history
        const oldScale = voxel.scale ? [...voxel.scale] : [1, 1, 1];
        const newScale = [brickDims.sx, brickDims.sy, brickDims.sz];

        voxel.scale = newScale;

        // Restore handle highlight
        if (h) { h.material.color.set(0x00d2ff); }

        // Update InstancedMesh
        this.voxelEngine._setInstanceMatrix(
          this.voxelEngine.instancedMeshes.get(voxel.material),
          this.voxelEngine.keyToInstance.get(voxel.material).get(
            `${voxel.x},${voxel.y},${voxel.z}`
          ),
          this.voxelEngine._worldPos({ x: voxel.x, y: voxel.y, z: voxel.z }),
          new THREE.Vector3(newScale[0], newScale[1], newScale[2])
        );

        this.voxelEngine._pushHistory({
          type: 'vertexScale', x: voxel.x, y: voxel.y, z: voxel.z,
          oldScale, newScale,
        });
        this.voxelEngine._onVoxelChanged();
      }
    }

    // Reset handle colors
    for (let i = 0; i < this.activeHandles.length; i++) {
      const h = this._handleAt(i);
      if (h) { h.material.color.set(0x00d2ff); h.material.opacity = 0.90; }
    }
    this.dragHandleIdx      = null;
    this.dragStartPositions = null;
    this.liveLabel.style.display = 'none';
  }

  // ── Destroy ─────────────────────────────────────────────────────────────

  destroy() {
    this.deactivate();
    if (this._handleGeometry) this._handleGeometry.dispose();
    if (this.liveLabel && this.liveLabel.parentNode) {
      this.liveLabel.parentNode.removeChild(this.liveLabel);
    }
  }
}
