/**
 * VertexEditTool — V2  (Blender-style vertex + extrude)
 *
 * Features:
 *  - Drag a single vertex → scale the whole brick
 *  - Extrude mode (Shift+E or toolbar button): drag a vertex → the whole
 *    face opposite to that vertex is pushed/pulled as a rigid plane
 *  - In extrude mode the 7 "slave" vertices follow the dragged vertex
 *    so the brick always stays a rectangular prism.
 *
 * Shortcuts
 *  E      — toggle vertexEdit tool
 *  Shift+E — toggle extrude mode (inside vertexEdit tool)
 */

import * as THREE from 'three';

// ── Constant maps ─────────────────────────────────────────────────────────

/** face index → world-space normal (unit) */
const FACE_NORMALS = [
  new THREE.Vector3( 1,  0,  0),   // 0 +X
  new THREE.Vector3(-1,  0,  0),   // 1 −X
  new THREE.Vector3( 0,  1,  0),   // 2 +Y
  new THREE.Vector3( 0, -1,  0),   // 3 −Y
  new THREE.Vector3( 0,  0,  1),   // 4 +Z
  new THREE.Vector3( 0,  0, -1),   // 5 −Z
];

/**
 * Vertices of each cube face (local index 0-7).
 * Each entry is [v0, v1, v2, v3] CCW-looking from outside.
 *
 *  Face +X (idx 0): vertices  1,3,7,5
 *  Face −X (idx 1): vertices  0,2,6,4
 *  Face +Y (idx 2): vertices  2,3,7,6
 *  Face −Y (idx 3): vertices  0,1,5,4
 *  Face +Z (idx 4): vertices  4,5,7,6
 *  Face −Z (idx 5): vertices  0,1,3,2
 */
const FACE_VERTICES = [
  [1, 3, 7, 5],   // +X
  [0, 2, 6, 4],   // −X
  [2, 3, 7, 6],   // +Y
  [0, 1, 5, 4],   // −Y
  [4, 5, 7, 6],   // +Z
  [0, 1, 3, 2],   // −Z
];

/** Corner vertex → { xSign, ySign, zSign } for quick normal reconstruction. */
const CORNER_SIGN = [
  { x:-1, y:-1, z:-1 },  // 0  origin corner
  { x:+1, y:-1, z:-1 },  // 1
  { x:-1, y:+1, z:-1 },  // 2
  { x:+1, y:+1, z:-1 },  // 3
  { x:-1, y:-1, z:+1 },  // 4
  { x:+1, y:-1, z:+1 },  // 5
  { x:-1, y:+1, z:+1 },  // 6
  { x:+1, y:+1, z:+1 },  // 7
];

/**
 * Vertex index → array of face indices that include this vertex.
 * Used to determine which face is being "pulled" by a vertex drag.
 */
const VERTEX_FACES = [
  [1, 3, 5],   // 0
  [0, 3, 5],   // 1
  [1, 2, 5],   // 2
  [0, 2, 5],   // 3
  [1, 3, 4],   // 4
  [0, 3, 4],   // 5
  [1, 2, 4],   // 6
  [0, 2, 4],   // 7
];

export class VertexEditTool {
  constructor(voxelEngine, scene, camera, renderer) {
    this.voxelEngine = voxelEngine;
    this.scene       = scene;
    this.camera      = camera;
    this.renderer    = renderer;

    this.isActive    = false;
    this.isDragging  = false;

    this.raycaster   = new THREE.Raycaster();
    this.pointer     = new THREE.Vector2();
    this._plane      = new THREE.Plane();

    // ── Selection state ──────────────────────────────────────────────────
    this.selectedHandleIdx  = null;   // 0-7 when a handle is highlighted
    this.selectedVoxel      = null;   // {x,y,z} when a brick is selected

    // ── Drag state ───────────────────────────────────────────────────────
    this.dragHandleIdx      = null;
    this.dragStartPositions = null;   // Array[8] of THREE.Vector3 at drag start
    this.dragStartMouse     = null;   // pointer at drag-start (normalized dev coords)
    this._axesWorld         = null;   // cached world-axis vectors
    this._axesScreen        = null;   // cached screen-axis vectors

    // ── Extrude mode ────────────────────────────────────────────────────
    this._extrudeMode  = false;       // false=vertex-scale, true=face-extrude
    this._extruding    = false;       // true while an extrude drag is active
    this._extrudeFaceIdx = null;      // which face is being extruded (0-5)
    this._faceDragAxisIdx = null;     // dominant screen axis during extrude drag

    // ── Visuals ──────────────────────────────────────────────────────────
    this.liveLabel     = null;
    this.activeHandles = [];
    this._handleGeo    = null;

    this._createLiveLabel();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GEOMETRY HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /** 8 world-space vertex positions for the current brick (cuboid). */
  _getVertexWorldPositions(voxel) {
    const center = this.voxelEngine._worldPos
      ? this.voxelEngine._worldPos({ x: voxel.x, y: voxel.y, z: voxel.z })
      : new THREE.Vector3(voxel.x + 0.5, voxel.y + 0.5, voxel.z + 0.5);

    const sc   = voxel.scale || [1, 1, 1];
    const half = new THREE.Vector3(
      (sc[0] || 1) * 0.5, (sc[1] || 1) * 0.5, (sc[2] || 1) * 0.5
    );
    const VS   = this.voxelEngine.voxelSize || 1.0;
    const hx = half.x * VS, hy = half.y * VS, hz = half.z * VS;

    return [
      new THREE.Vector3(center.x-hx, center.y-hy, center.z-hz),
      new THREE.Vector3(center.x+hx, center.y-hy, center.z-hz),
      new THREE.Vector3(center.x-hx, center.y+hy, center.z-hz),
      new THREE.Vector3(center.x+hx, center.y+hy, center.z-hz),
      new THREE.Vector3(center.x-hx, center.y-hy, center.z+hz),
      new THREE.Vector3(center.x+hx, center.y-hy, center.z+hz),
      new THREE.Vector3(center.x-hx, center.y+hy, center.z+hz),
      new THREE.Vector3(center.x+hx, center.y+hy, center.z+hz),
    ];
  }

  /**
   * From 8 vertices (one updated), compute new Brick size in voxels.
   * Each dimension clamped to ≥ 1.
   */
  _computeBrickFromVertices(vertices, draggedIdx, vNew) {
    let minX=Infinity, minY=Infinity, minZ=Infinity;
    let maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;
    for (let i=0; i<8; i++) {
      const v = (i===draggedIdx && vNew) ? vNew : vertices[i];
      if (v.x<minX) minX=v.x;  if (v.x>maxX) maxX=v.x;
      if (v.y<minY) minY=v.y;  if (v.y>maxY) maxY=v.y;
      if (v.z<minZ) minZ=v.z;  if (v.z>maxZ) maxZ=v.z;
    }
    const VS = this.voxelEngine.voxelSize || 1.0;
    return {
      sx: Math.max(1, Math.round((maxX-minX)/VS)),
      sy: Math.max(1, Math.round((maxY-minY)/VS)),
      sz: Math.max(1, Math.round((maxZ-minZ)/VS)),
    };
  }

  /**
   * Return new brick center and the axis signs of the 8 corners so
   * callers can reconstruct center world-pos after an extrude drag.
   */
  _computeBrickCenterAndSigns(vertices, draggedIdx, vNew) {
    const all = vertices.map((v,i) => (i===draggedIdx && vNew) ? vNew : v);
    const cx = (all[0].x+all[7].x)/2;   // (min+max)/2
    const cy = (all[0].y+all[7].y)/2;
    const cz = (all[0].z+all[7].z)/2;
    return { center: new THREE.Vector3(cx,cy,cz), signs: CORNER_SIGN };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  FACE / VERTEX HELPERS  (for extrude mode)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Return the face index whose normal points in the same general
   * direction as `sign`, using the voxel's current scale as a hint.
   * `sign` is one of CORNER_SIGN values for the dragged corner.
   */
  _faceForCornerSign(sign) {
    // Each vertex is the corner of 3 adjacent faces.  The one whose normal
    // has the same sign pattern is the "outer" face — the one being pushed.
    let bestFace = 0, bestDot = -Infinity;
    for (let f=0; f<6; f++) {
      const n = FACE_NORMALS[f];
      const dot = n.x*sign.x + n.y*sign.y + n.z*sign.z;
      if (dot > bestDot) { bestDot = dot; bestFace = f; }
    }
    return bestFace;
  }

  /** World-space vertices indices that belong to the given face. */
  _faceVertexIndices(faceIdx) { return FACE_VERTICES[faceIdx]; }

  /**
   * For a dragged corner vertex at `worldPos`, figure out which face
   * the extrude is acting on and return the local drag direction (sign×normal).
   */
  _resolveExtrudeFaceAndDir(worldPos, voxel) {
    // Reconstruct the sign (+1 or -1 per axis) for this world position
    const center = this.voxelEngine._worldPos
      ? this.voxelEngine._worldPos({ x: voxel.x, y: voxel.y, z: voxel.z })
      : new THREE.Vector3(voxel.x+0.5, voxel.y+0.5, voxel.z+0.5);
    const VS = this.voxelEngine.voxelSize || 1.0;
    const sc = voxel.scale || [1,1,1];
    const hx = (sc[0]||1)*0.5*VS, hy = (sc[1]||1)*0.5*VS, hz = (sc[2]||1)*0.5*VS;

    // Which quadrant is the vertex in?
    const sx = worldPos.x > center.x ? +1 : -1;
    const sy = worldPos.y > center.y ? +1 : -1;
    const sz = worldPos.z > center.z ? +1 : -1;

    return this._faceForCornerSign({x:sx, y:sy, z:sz});
  }

  /**
   * Build the correct drag direction vector for extrude mode.
   * Returns a unit normal pointing *outward* from the face being extruded.
   */
  _extrudeDragNormal(faceIdx) {
    return FACE_NORMALS[faceIdx].clone();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  MODE API
  // ═══════════════════════════════════════════════════════════════════════

  setExtrudeMode(on) {
    this._extrudeMode = !!on;
  }

  toggleExtrudeMode() {
    this._extrudeMode = !this._extrudeMode;
    return this._extrudeMode;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  GIZMO HANDLES
  // ═══════════════════════════════════════════════════════════════════════

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
    this.activeHandles = positions.map(pos => {
      const mesh = new THREE.Mesh(this._handleGeo(), this._makeHandleMat());
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
    this.activeHandles   = [];
    this._handleGeometry = null;
  }

  _handleAt(idx) { return this.activeHandles[idx] || null; }

  _findClosestHandleByRay(mouse) {
    this.raycaster.setFromCamera(mouse, this.camera);
    let bestId = null, bestDist = Infinity;
    for (let i=0; i<this.activeHandles.length; i++) {
      const hits = this.raycaster.intersectObject(this.activeHandles[i]);
      if (hits.length > 0) {
        const d = hits[0].point.distanceTo(this.camera.position);
        if (d < bestDist) { bestDist = d; bestId = i; }
      }
    }
    return bestId;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SCREEN ↔ WORLD AXIS HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  _axisWorld() {
    return [ new THREE.Vector3(1,0,0), new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,1) ];
  }

  _axisScreen() {
    const toScr = v => { const c=v.clone().project(this.camera); return new THREE.Vector2(c.x,c.y); };
    return [toScr(new THREE.Vector3(1,0,0)), toScr(new THREE.Vector3(0,1,0)), toScr(new THREE.Vector3(0,0,1))];
  }

  _dominantAxis(dpScreen, axScreen) {
    let bestI=0, bestM=-Infinity;
    for (let i=0; i<3; i++) {
      const m = Math.abs(dpScreen.dot(axScreen[i]));
      if (m>bestM) { bestM=m; bestI=i; }
    }
    return bestI;
  }

  _screenDeltaToWorld(dp, axesWorld, axesScreen) {
    let bestD=0, bestW=new THREE.Vector3();
    for (let i=0; i<3; i++) {
      const lsq = axesScreen[i].lengthSq();
      if (lsq > 0.0001) {
        const d = dp.dot(axesScreen[i]) / lsq;
        if (Math.abs(d) > Math.abs(bestD)) { bestD=d; bestW.copy(axesWorld[i]); }
      }
    }
    return bestW.multiplyScalar(bestD);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  LIVE LABEL
  // ═══════════════════════════════════════════════════════════════════════

  _createLiveLabel() {
    const el = document.createElement('div');
    el.id = 'vertex-edit-live-label';
    el.style.cssText =
      'position:fixed;top:20px;right:20px;' +
      'background:rgba(0,0,0,0.92);color:#ff6b6b;' +
      'padding:12px 16px;border-radius:8px;' +
      'font-family:monospace;font-size:12px;' +
      'border:1px solid #ff6b6b;display:none;' +
      'z-index:10000;pointer-events:none;min-width:195px;';
    document.body.appendChild(el);
    this.liveLabel = el;
  }

  _updateLiveLabel(axisName, newSize) {
    if (!this.liveLabel) return;
    const modeTag = this._extrudeMode
      ? '<span style="color:#fbbf24">[ESTRUSIONE]</span>'
      : '<span style="color:#00d2ff">[VERTICE]</span>';
    this.liveLabel.innerHTML =
      '<div style="font-weight:bold;margin-bottom:8px;">Vertex Edit</div>' +
      modeTag +
      `<div>Asse: ${axisName.toUpperCase()}</div>` +
      `<div>W: ${newSize.sx.toFixed(1)} mm</div>` +
      `<div>H: ${newSize.sy.toFixed(1)} mm</div>` +
      `<div>D: ${newSize.sz.toFixed(1)} mm</div>`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ACTIVATE / DEACTIVATE
  // ═══════════════════════════════════════════════════════════════════════

  activate() {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    this._bindEvents();
  }

  deactivate() {
    this.isActive        = false;
    this.isDragging      = false;
    this._extruding      = false;
    this._extrudeFaceIdx = null;
    this.dragHandleIdx   = null;
    this._removeHandles();
    this.selectedVoxel   = null;
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
    if (this._boundCanvas) this._boundCanvas.removeEventListener('pointerdown', this._onMouseDown);
    window.removeEventListener('pointermove', this._onMouseMove);
    window.removeEventListener('pointerup',   this._onMouseUp);
  }

  _getMousePos(event) {
    const canvas = this.renderer.domElement;
    const rect   = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX-rect.left)/rect.width)*2-1;
    this.pointer.y = -((event.clientY-rect.top)/rect.height)*2+1;
    return this.pointer;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  MOUSE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  _cornerAxisLabel(idx) {
    return ['X−','X+','Y−','Y+','Z−','Z+','X−','X+'][idx] || '?';
  }

  _onMouseDown(event) {
    if (!this.isActive || event.button !== 0) return;
    const mouse = this._getMousePos(event);
    this.raycaster.setFromCamera(mouse, this.camera);

    const hit = this.voxelEngine._raycast
      ? this.voxelEngine._raycast(event)
      : null;

    if (!hit || hit.isGround) {
      // Click empty space → deselect
      this.selectedVoxel = null;
      this._removeHandles();
      this.voxelEngine.selectedVoxel = null;
      this.voxelEngine.highlight.visible = false;
      return;
    }

    const { x, y, z } = hit;
    const voxel = this.voxelEngine.getVoxelAt(x, y, z);
    if (!voxel) return;

    // ── First click on NEW brick → select + show handles ─────────────
    if (!this.selectedVoxel ||
        this.selectedVoxel.x !== x || this.selectedVoxel.y !== y || this.selectedVoxel.z !== z) {
      this.selectedVoxel = { x, y, z };
      this.voxelEngine.selectVoxel(x, y, z);
      this._createHandles(voxel);
      return;   // selection click — no drag
    }

    // ── Already selected brick: click on a handle → start drag ───────
    const handleIdx = this._findClosestHandleByRay(mouse);
    if (handleIdx === null) return;

    this.isDragging   = true;
    this._extruding   = false;          // reset extrude state
    this.dragHandleIdx = handleIdx;
    const positions   = this._getVertexWorldPositions(this.selectedVoxel);
    this.dragStartPositions = positions.map(p => p.clone());
    this.dragStartMouse     = mouse.clone();
    this._axesWorld  = this._axisWorld();
    this._axesScreen = this._axisScreen();

    const picked = this._handleAt(handleIdx);
    if (picked) { picked.material.color.set(0xff6b6b); picked.material.opacity = 1.0; }

    if (this._extrudeMode) {
      // ── EXTRUDE PATH ──────────────────────────────────────────────
      const worldPos   = positions[handleIdx];
      const faceIdx    = this._resolveExtrudeFaceAndDir(worldPos, voxel);
      this._extruding        = true;
      this._extrudeFaceIdx   = faceIdx;
      this._faceDragAxisIdx  = null;   // determined on first mouse-move delta
    }

    this.liveLabel.style.display = 'block';
  }

  _onMouseMove(event) {
    if (!this.isActive || !this.isDragging || this.dragHandleIdx === null) return;

    const mouse = this._getMousePos(event);
    const dp    = new THREE.Vector2(
      mouse.x - this.dragStartMouse.x,
      mouse.y - this.dragStartMouse.y
    );

    // ── EXTRUDE PATH ─────────────────────────────────────────────────
    if (this._extrudeMode && this._extruding) {
      // Resolve face on first frame
      if (this._faceDragAxisIdx === null) {
        this._faceDragAxisIdx = this._dominantAxis(dp, this._axesScreen);
      }

      // Move all 4 vertices of the extrude face together
      const faceIdxs = this._faceVertexIndices(this._extrudeFaceIdx);
      const wdp = this._screenDeltaToWorld(dp, this._axesWorld, this._axesScreen);

      for (const fv of faceIdxs) {
        this.dragStartPositions[fv].add(wdp);
        const h = this._handleAt(fv);
        if (h) h.position.copy(this.dragStartPositions[fv]);
      }

      // Live label shows vertex 0 as reference
      const h = this._handleAt(this.dragHandleIdx);
      if (h) h.position.copy(this.dragStartPositions[this.dragHandleIdx]);

      const newSize = this._computeBrickFromVertices(
        this.dragStartPositions, this.dragHandleIdx,
        this.dragStartPositions[this.dragHandleIdx]
      );
      this._updateLiveLabel(this._cornerAxisLabel(this._faceDragAxisIdx), newSize);
      return;
    }

    // ── VERTEX SCALE PATH ───────────────────────────────────────────
    const axIdx  = this._dominantAxis(dp, this._axesScreen);
    const wdp    = this._screenDeltaToWorld(dp, this._axesWorld, this._axesScreen);
    const origV  = this.dragStartPositions[this.dragHandleIdx];
    const vNew   = origV.clone().add(wdp);

    // Preview: update handle mesh
    const h = this._handleAt(this.dragHandleIdx);
    if (h) h.position.copy(vNew);

    // Preview label
    const newSize = this._computeBrickFromVertices(
      this.dragStartPositions, this.dragHandleIdx, vNew
    );
    this._updateLiveLabel(this._cornerAxisLabel(this.dragHandleIdx), newSize);
  }

  _onMouseUp(event) {
    if (!this.isDragging) return;
    this.isDragging = false;

    if (!this.selectedVoxel || this.dragHandleIdx === null || !this.dragStartPositions) {
      this._resetDragState();
      return;
    }

    const voxel = this.voxelEngine.getVoxelAt(
      this.selectedVoxel.x, this.selectedVoxel.y, this.selectedVoxel.z
    );
    if (!voxel) { this._resetDragState(); return; }

    // ── Determine the "updated" vertex for dimension computation ──────
    let vUpdated = null;
    if (this._extruding && this._extrudeFaceIdx !== null) {
      // All 4 face vertices moved together: pick the dragged one as representative
      vUpdated = this.dragStartPositions[this.dragHandleIdx];
    } else {
      const h = this._handleAt(this.dragHandleIdx);
      vUpdated = h ? h.position.clone() : null;
    }

    const brickDims = this._computeBrickFromVertices(
      this.dragStartPositions, this.dragHandleIdx, vUpdated
    );

    // Reconstruct brick center from drag positions
    const { center: newCenter, signs } = this._computeBrickCenterAndSigns(
      this.dragStartPositions, this.dragHandleIdx, vUpdated
    );

    // Clamp & apply new scale
    const oldScale  = voxel.scale ? [...voxel.scale] : [1, 1, 1];
    const newScale  = [brickDims.sx, brickDims.sy, brickDims.sz];

    voxel.scale = newScale;

    // Restore handle color
    for (let i=0; i<this.activeHandles.length; i++) {
      const h = this.activeHandles[i];
      if (h) { h.material.color.set(0x00d2ff); }
    }

    // ── Update InstancedMesh ─────────────────────────────────────────
    // Centre shifted after extrude: move InstancedMatrix position too
    const oldCenter = this.voxelEngine._worldPos
      ? this.voxelEngine._worldPos(this.selectedVoxel)
      : new THREE.Vector3(this.selectedVoxel.x+0.5, this.selectedVoxel.y+0.5, this.selectedVoxel.z+0.5);

    this.voxelEngine._setInstanceMatrix(
      this.voxelEngine.instancedMeshes.get(voxel.material),
      this.voxelEngine.keyToInstance.get(voxel.material)?.get(
        `${voxel.x},${voxel.y},${voxel.z}`
      ),
      newCenter,
      new THREE.Vector3(newScale[0], newScale[1], newScale[2])
    );

    this.voxelEngine._pushHistory({
      type: 'vertexScale',
      x: voxel.x, y: voxel.y, z: voxel.z,
      oldScale, newScale,
    });

    this.voxelEngine._onVoxelChanged();
    this._resetDragState();
  }

  _resetDragState() {
    for (let i=0; i<this.activeHandles.length; i++) {
      const h = this.activeHandles[i];
      if (h) { h.material.color.set(0x00d2ff); h.material.opacity = 0.90; }
    }
    this.dragHandleIdx       = null;
    this.dragStartPositions  = null;
    this._extruding          = false;
    this._extrudeFaceIdx     = null;
    this._faceDragAxisIdx    = null;
    if (this.liveLabel) this.liveLabel.style.display = 'none';
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  DESTROY
  // ═══════════════════════════════════════════════════════════════════════

  destroy() {
    this.deactivate();
    if (this._handleGeometry) this._handleGeometry.dispose();
    if (this.liveLabel?.parentNode) this.liveLabel.parentNode.removeChild(this.liveLabel);
  }
}
