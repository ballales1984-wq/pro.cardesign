/**
 * HoleTool - Create holes, counterbores, countersinks, and threads in brick geometry
 * Real measurements in millimeters
 */

import * as THREE from 'three';

export class HoleTool {
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

    this.selectedVoxel = null;
    this.dragStartPoint = null;

    this.liveLabel = null;
    this.holeSpec = {
      diameter: 10,
      depth: 50,
      holeType: 'through',
      threadDiameter: null,
      threadPitch: null,
      counterboreDiameter: null,
      countersinkAngle: 45,
    };

    this._createLiveLabel();
    this._createPanel();
  }

  _createLiveLabel() {
    const el = document.createElement('div');
    el.id = 'hole-live-label';
    el.style.cssText =
      'position:fixed;top:20px;right:20px;' +
      'background:rgba(0,0,0,0.9);color:#ff9800;' +
      'padding:12px 16px;border-radius:8px;' +
      'font-family:monospace;font-size:12px;' +
      'border:1px solid #ff9800;display:none;' +
      'z-index:10000;pointer-events:none;' +
      'min-width:200px;';
    document.body.appendChild(el);
    this.liveLabel = el;
  }

  _createPanel() {
    const panel = document.createElement('div');
    panel.id = 'hole-panel';
    panel.className = 'panel';
    panel.style.cssText =
      'position:fixed;bottom:80px;right:20px;' +
      'background:rgba(20,20,30,0.95);border:1px solid #ff9800;' +
      'border-radius:8px;padding:12px;font-family:sans-serif;' +
      'color:#fff;display:none;z-index:10000;min-width:220px;';

    panel.innerHTML = `
      <div style="font-weight:bold;margin-bottom:8px;color:#ff9800;">🔩 Hole Tool</div>
      <div style="font-size:11px;margin-bottom:8px;">Click on a brick to create a hole</div>

      <div style="margin-bottom:6px;">
        <label style="display:block;font-size:11px;margin-bottom:2px;">Type</label>
        <select id="hole-type" class="prop-input" style="width:100%;">
          <option value="through">Through Hole</option>
          <option value="blind">Blind Hole</option>
          <option value="counterbore">Counterbore</option>
          <option value="countersink">Countersink</option>
          <option value="threaded">Threaded Hole</option>
        </select>
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block;font-size:11px;margin-bottom:2px;">Diameter (mm)</label>
        <input type="number" id="hole-diameter" class="prop-input" value="10" min="1" step="0.5" style="width:100%;">
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block;font-size:11px;margin-bottom:2px;">Depth (mm)</label>
        <input type="number" id="hole-depth" class="prop-input" value="50" min="1" step="1" style="width:100%;">
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block;font-size:11px;margin-bottom:2px;">Thread Diameter (mm, optional)</label>
        <input type="number" id="hole-thread-dia" class="prop-input" min="1" step="0.5" style="width:100%;">
      </div>

      <div style="margin-bottom:6px;">
        <label style="display:block;font-size:11px;margin-bottom:2px;">Counterbore Dia (mm)</label>
        <input type="number" id="hole-counterbore-dia" class="prop-input" min="1" step="0.5" style="width:100%;">
      </div>

      <div style="display:flex;gap:6px;margin-top:8px;">
        <button id="btn-hole-apply" class="btn-primary" style="flex:1;">Apply</button>
        <button id="btn-hole-cancel" class="btn-secondary" style="flex:1;">Cancel</button>
      </div>
    `;

    document.body.appendChild(panel);

    this._setupPanelEvents();
  }

  _setupPanelEvents() {
    document.getElementById('btn-hole-apply').addEventListener('click', () => {
      this._applyHole();
    });

    document.getElementById('btn-hole-cancel').addEventListener('click', () => {
      this.deactivate();
      this._hidePanel();
    });

    document.getElementById('hole-type').addEventListener('change', (e) => {
      this.holeSpec.holeType = e.target.value;
      this._updatePanelVisibility();
    });
  }

  _updatePanelVisibility() {
    const type = this.holeSpec.holeType;
    const depthInput = document.getElementById('hole-depth');
    const threadInput = document.getElementById('hole-thread-dia').parentElement;
    const cbInput = document.getElementById('hole-counterbore-dia').parentElement;

    // Show/hide depth based on type
    depthInput.parentElement.style.display = (type === 'through') ? 'none' : 'block';

    // Show thread diameter for threaded holes
    threadInput.style.display = (type === 'threaded') ? 'block' : 'none';

    // Show counterbore for counterbore/countersink
    cbInput.style.display = (type === 'counterbore' || type === 'countersink') ? 'block' : 'none';
  }

  activate() {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    this._bindEvents();
    this._showPanel();
    this._updatePanelVisibility();
  }

  deactivate() {
    this.isActive = false;
    this.selectedVoxel = null;
    this.isDragging = false;
    this.dragStartPoint = null;
    this._hidePanel();
    this._unbindEvents();
  }

  _bindEvents() {
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);

    this._boundCanvas = this.renderer.domElement;
    this._boundCanvas.addEventListener('pointerdown', this._onMouseDown);
    window.addEventListener('pointermove', this._onMouseMove);
    window.addEventListener('pointerup', this._onMouseUp);
  }

  _unbindEvents() {
    if (this._boundCanvas) {
      this._boundCanvas.removeEventListener('pointerdown', this._onMouseDown);
    }
    window.removeEventListener('pointermove', this._onMouseMove);
    window.removeEventListener('pointerup', this._onMouseUp);
  }

  _getMousePos(event) {
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return this.pointer;
  }

  _onMouseDown(event) {
    if (!this.isActive || event.button !== 0) return;

    const mouse = this._getMousePos(event);
    this.raycaster.setFromCamera(mouse, this.camera);

    const intersections = this.raycaster.intersectObjects(
      Array.from(this.voxelEngine.instancedMeshes.values()), true
    );

    if (intersections.length > 0 && intersections[0].instanceId !== undefined) {
      const hit = intersections[0];
      const materialName = hit.object.material.name;
      const instanceId = hit.instanceId;
      const keyObj = this.voxelEngine.instanceToKey.get(materialName);
      const key = keyObj ? keyObj[instanceId] : null;

      if (key) {
        const parts = key.split(',');
        this.selectedVoxel = {
          x: parseInt(parts[0], 10),
          y: parseInt(parts[1], 10),
          z: parseInt(parts[2], 10)
        };
        this.dragStartPoint = hit.point.clone();
        this.isDragging = true;
        this.liveLabel.style.display = 'block';
        this._updateLiveLabel('Click Apply to create hole at selected position');
      }
    }
  }

  _onMouseMove(event) {
    if (!this.isActive || !this.isDragging) return;

    const mouse = this._getMousePos(event);
    this.raycaster.setFromCamera(mouse, this.camera);

    const intersections = this.raycaster.intersectObjects(
      Array.from(this.voxelEngine.instancedMeshes.values()), true
    );

    if (intersections.length > 0 && intersections[0].instanceId !== undefined) {
      const hit = intersections[0];
      this._updateLiveLabel(`Hole position: (${hit.point.x.toFixed(1)}, ${hit.point.y.toFixed(1)}, ${hit.point.z.toFixed(1)}) mm`);
    }
  }

  _onMouseUp(event) {
    if (!this.isDragging) return;
    this.isDragging = false;
  }

  _updateLiveLabel(text) {
    if (!this.liveLabel) return;

    this.liveLabel.innerHTML = `
      <div style="font-weight:bold;margin-bottom:4px;">🔩 Hole Tool</div>
      <div style="font-size:11px;">${text}</div>
    `;
  }

  _showPanel() {
    const panel = document.getElementById('hole-panel');
    if (panel) panel.style.display = 'block';
  }

  _hidePanel() {
const panel = document.getElementById('hole-panel');
    if (panel) panel.style.display = 'none';
    if (this.liveLabel) this.liveLabel.style.display = 'none';
  }

  _applyHole() {
    if (!this.selectedVoxel) {
      this._notify('Select a voxel before applying hole', 'warn');
      return;
    }

    // Read values from panel
    this.holeSpec.diameter = parseFloat(document.getElementById('hole-diameter').value) || 10;
    this.holeSpec.depth = parseFloat(document.getElementById('hole-depth').value) || 50;
    this.holeSpec.holeType = document.getElementById('hole-type').value;

    if (this.holeSpec.holeType === 'threaded') {
      this.holeSpec.threadDiameter = parseFloat(document.getElementById('hole-thread-dia').value) || this.holeSpec.diameter;
      this.holeSpec.threadPitch = this._getThreadPitch(this.holeSpec.threadDiameter);
    }

    if (this.holeSpec.holeType === 'counterbore' || this.holeSpec.holeType === 'countersink') {
      this.holeSpec.counterboreDiameter = parseFloat(document.getElementById('hole-counterbore-dia').value) || this.holeSpec.diameter * 1.5;
    }

    // Get center position in mm
    const centerPos = this.voxelEngine._worldPos(this.selectedVoxel);
    
    // Create hole - removes voxels within the hole cylinder
    const removedVoxels = this._drillHoleVoxels(
      this.selectedVoxel.x, this.selectedVoxel.y, this.selectedVoxel.z,
      centerPos.x, centerPos.y, centerPos.z
    );

    if (removedVoxels.length > 0) {
      // Push to undo history
      this.voxelEngine._pushHistory({
        type: 'hole',
        removedVoxels: removedVoxels,
        holeSpec: {...this.holeSpec}
      });

      this._notify(`Hole created: ${removedVoxels.length} voxels removed`, 'success');
    } else {
      this._notify('No voxels to remove - hole may be outside brick', 'warn');
    }

    this.deactivate();
    this._hidePanel();
  }

  _drillHoleVoxels(vx, vy, vz, cx, cy, cz) {
    const radius = this.holeSpec.diameter / 2.0;
    const removed = [];

    // Determine depth range based on hole type
    let minY, maxY;
    if (this.holeSpec.holeType === 'through') {
      minY = -1000;
      maxY = 1000;
    } else {
      minY = cy - this.holeSpec.depth / 2.0 - 1;
      maxY = cy + this.holeSpec.depth / 2.0 + 1;
    }

    // Check all voxels in a radius around the center point
    const searchRadius = Math.ceil(this.holeSpec.diameter * 1.5);
    for (let x = vx - searchRadius; x <= vx + searchRadius; x++) {
      for (let y = vy - searchRadius; y <= vy + searchRadius; y++) {
        for (let z = vz - searchRadius; z <= vz + searchRadius; z++) {
          const voxel = this.voxelEngine.getVoxelAt(x, y, z);
          if (!voxel) continue;

          // Calculate distance from center (voxel center at x+0.5, y+0.5, z+0.5)
          const dx = (x + 0.5) - cx;
          const dy = (y + 0.5) - cy;
          const dz = (z + 0.5) - cz;
          const dist = Math.sqrt(dx*dx + dz*dz);

          // Check if within radius and within depth
          if (dist <= radius && y >= minY && y <= maxY) {
            this.voxelEngine.removeVoxel(x, y, z);
            removed.push({ x, y, z });
          }
        }
      }
    }

    return removed;
  }

  _getThreadPitch(diameter) {
    const pitches = {
      1.6: 0.35, 2: 0.4, 2.5: 0.45, 3: 0.5, 3.5: 0.5,
      4: 0.7, 5: 0.8, 6: 1.0, 7: 1.0, 8: 1.25,
      10: 1.5, 12: 1.75, 16: 2.0, 20: 2.5, 24: 3.0
    };

    // Find closest standard thread
    for (const d of Object.keys(pitches).map(Number).sort((a, b) => a - b)) {
      if (d >= diameter) return pitches[d];
    }
    return pitches[24] || 3.0;
  }

_notify(message, type = 'info') {
     if (typeof window._notify === 'function') {
       window._notify(message, type);
     } else if (window.toast) {
       window.toast(message, type);
     } else {
       console.log(`[${type.toUpperCase()}] ${message}`);
     }
   }

  destroy() {
    this.deactivate();
    if (this.liveLabel && this.liveLabel.parentNode) {
      this.liveLabel.parentNode.removeChild(this.liveLabel);
    }
    const panel = document.getElementById('hole-panel');
    if (panel) panel.remove();
  }
}

export default HoleTool;