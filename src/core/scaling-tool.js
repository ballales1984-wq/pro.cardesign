/**
 * ScalingTool - Click and drag on brick faces to resize with live measurements
 */

// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
const THREE = await import('three');
;

export class ScalingTool {
  constructor(voxelEngine, scene, camera, renderer) {
    this.voxelEngine = voxelEngine;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.isActive = false;
    this.isDragging = false;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // Drag state
    this.selectedFace = null;
    this.selectedVoxel = null;
    this.dragStartPoint = null;
    this.dragAxis = 'x';
    this.startScale = null;

    // Live label
    this.liveLabel = null;
    this.sensitivity = 100; // 100px = 1 unit

    this._createLiveLabel();
  }

  _createLiveLabel() {
    const el = document.createElement('div');
    el.id = 'scaling-live-label';
    el.style.cssText =
      'position:fixed;top:20px;right:20px;' +
      'background:rgba(0,0,0,0.9);color:#00d2ff;' +
      'padding:12px 16px;border-radius:8px;' +
      'font-family:monospace;font-size:12px;' +
      'border:1px solid #00d2ff;display:none;' +
      'z-index:10000;pointer-events:none;' +
      'min-width:180px;';
    document.body.appendChild(el);
    this.liveLabel = el;
  }

  activate() {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    this._bindEvents();
  }

  deactivate() {
    this.isActive = false;
    this.isDragging = false;
    this.selectedFace = null;
    this.selectedVoxel = null;
    if (this.liveLabel) this.liveLabel.style.display = 'none';
    this._removeHighlights();
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
        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        const z = parseInt(parts[2], 10);
        this.isDragging = true;
        this.selectedVoxel = { x, y, z };
        this.dragStartPoint = hit.point.clone();
        const normal = hit.face.normal;

        if (Math.abs(normal.x) > 0.5) this.dragAxis = 'x';
        else if (Math.abs(normal.y) > 0.5) this.dragAxis = 'y';
        else this.dragAxis = 'z';

        const voxel = this.voxelEngine.getVoxelAt(x, y, z);
        if (voxel && voxel.scale) {
          this.startScale = { x: voxel.scale[0] || 1, y: voxel.scale[1] || 1, z: voxel.scale[2] || 1 };
        } else {
          this.startScale = { x: 1, y: 1, z: 1 };
        }

        this._createFaceHighlight(hit.point, normal);
        this.liveLabel.style.display = 'block';
      }
    }
  }

  _onMouseMove(event) {
    if (!this.isActive) return;

    const mouse = this._getMousePos(event);

    if (this.isDragging && this.selectedVoxel && this.dragStartPoint) {
      this.raycaster.setFromCamera(mouse, this.camera);

      const plane = new THREE.Plane();
      const n = this.dragAxis === 'x' ? 1 : (this.dragAxis === 'y' ? 1 : 0);
      const normal = new THREE.Vector3(
        this.dragAxis === 'x' ? 1 : 0,
        this.dragAxis === 'y' ? 1 : 0,
        this.dragAxis === 'z' ? 1 : 0
      );
      plane.setFromNormalAndCoplanarPoint(normal, this.dragStartPoint);

      const intersection = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(plane, intersection);

      if (intersection) {
        const p = intersection;
        const dp = this.dragStartPoint;
        const delta = (this.dragAxis === 'x' ? p.x : this.dragAxis === 'y' ? p.y : p.z)
                    - (this.dragAxis === 'x' ? dp.x : this.dragAxis === 'y' ? dp.y : dp.z);
        const axisIndex = this.dragAxis === 'x' ? 0 : this.dragAxis === 'y' ? 1 : 2;
        const newScale = Math.max(1, Math.round((this.startScale[axisIndex] || 1) + delta));

        const voxel = this.voxelEngine.getVoxelAt(
          this.selectedVoxel.x, this.selectedVoxel.y, this.selectedVoxel.z
        );
        if (voxel) {
          if (!voxel.scale) voxel.scale = [1, 1, 1];
          voxel.scale[axisIndex] = newScale;

          this._updateScaleLabel(voxel.scale);
          this._applyVoxelScale(voxel);
        }
      }
    }
  }

  _onMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;

      if (this.selectedVoxel && this.startScale) {
        const voxel = this.voxelEngine.getVoxelAt(
          this.selectedVoxel.x, this.selectedVoxel.y, this.selectedVoxel.z
        );

        this.voxelEngine._pushHistory({
          type: 'scale',
          x: this.selectedVoxel.x,
          y: this.selectedVoxel.y,
          z: this.selectedVoxel.z,
          oldScale: this.startScale,
          newScale: voxel && voxel.scale ? [voxel.scale[0], voxel.scale[1], voxel.scale[2]] : [1, 1, 1]
        });

        this.voxelEngine._onVoxelChanged();
      }

      this._removeHighlights();
      this.liveLabel.style.display = 'none';
    }
  }

  _applyVoxelScale(voxel) {
    const key = voxel.x + ',' + voxel.y + ',' + voxel.z;
    const materialName = voxel.material;
    const mesh = this.voxelEngine.instancedMeshes.get(materialName);

    if (mesh) {
      const instMap = this.voxelEngine.keyToInstance.get(materialName);
      const instanceId = instMap ? instMap.get(key) : undefined;
      if (instanceId !== undefined) {
        const scale = voxel.scale || [1, 1, 1];
        this.voxelEngine._setInstanceMatrix(
          mesh,
          instanceId,
          this.voxelEngine._worldPos({ x: voxel.x, y: voxel.y, z: voxel.z }),
          new THREE.Vector3(scale[0], scale[1], scale[2])
        );
      }
    }
  }

  _createFaceHighlight(point, normal) {
    this._removeHighlights();

    const geo = new THREE.PlaneGeometry(0.3, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: false
    });

    const highlight = new THREE.Mesh(geo, mat);
    highlight.position.copy(point);
    highlight.position.add(normal.clone().multiplyScalar(0.02));
    highlight.lookAt(point.clone().add(normal));

    this.selectedFace = highlight;
    this.scene.add(highlight);
  }

  _removeHighlights() {
    if (this.selectedFace) {
      this.scene.remove(this.selectedFace);
      this.selectedFace.geometry.dispose();
      this.selectedFace.material.dispose();
      this.selectedFace = null;
    }
  }

  _updateScaleLabel(scale) {
    if (!this.liveLabel) return;

    const axisIndex = this.dragAxis === 'x' ? 0 : (this.dragAxis === 'y' ? 1 : 2);
    const delta = (scale[axisIndex] || 1) - (this.startScale[axisIndex] || 1);
    const sign = delta >= 0 ? '+' : '';
    const color = delta >= 0 ? '#4caf50' : '#f44336';

    this.liveLabel.innerHTML =
      '<div style="font-weight:bold;margin-bottom:8px;">Live Scaling</div>' +
      '<div>Asse: ' + this.dragAxis.toUpperCase() + '</div>' +
      '<div>Attuale: ' + (scale[axisIndex] || 1).toFixed(1) + ' mm</div>' +
      '<div style="margin-top:4px;">Delta: <span style="color:' + color + '">' + sign + delta.toFixed(1) + ' mm</span></div>';
  }

  destroy() {
    this.deactivate();
    if (this.liveLabel && this.liveLabel.parentNode) {
      this.liveLabel.parentNode.removeChild(this.liveLabel);
    }
  }
}

export default ScalingTool;
