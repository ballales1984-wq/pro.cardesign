/**
 * SculptTool - Push/pull voxels to deform surfaces
 */

// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
import * as THREE from 'three';

export class SculptTool {
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

    // Drag state
    this.selectedVoxel = null;
    this.dragStartPoint = null;
    this.dragStartPointer = null;
    this.dragNormal = null;
    this.startVoxelData = null;

    // Strength settings
    this.strength = 2;
    this.sensitivity = 20;

    // Live label
    this.liveLabel = null;
    this._createLiveLabel();
  }

  _createLiveLabel() {
    const el = document.createElement('div');
    el.id = 'sculpt-live-label';
    el.style.cssText =
      'position:fixed;top:20px;right:20px;' +
      'background:rgba(0,0,0,0.9);color:#ff6b6b;' +
      'padding:12px 16px;border-radius:8px;' +
      'font-family:monospace;font-size:12px;' +
      'border:1px solid #ff6b6b;display:none;' +
      'z-index:10000;pointer-events:none;' +
      'min-width:200px;';
    document.body.appendChild(el);
    this.liveLabel = el;
  }

  _createHint() {
    let hint = document.getElementById('sculpt-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'sculpt-hint';
      hint.style.cssText =
        'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
        'background:rgba(0,0,0,0.85);color:#fff;padding:10px 20px;' +
        'border-radius:6px;font-family:sans-serif;font-size:13px;' +
        'z-index:10000;pointer-events:none;opacity:0.9;';
      document.body.appendChild(hint);
    }
    hint.textContent = '';
    const titleDiv = document.createElement('div');
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.marginBottom = '4px';
    titleDiv.textContent = '🗿 Sculpt Tool';
    hint.appendChild(titleDiv);

    const dragDiv = document.createElement('div');
    dragDiv.style.fontSize = '12px';
    dragDiv.style.color = '#aaa';
    const pushSpan = document.createElement('span');
    pushSpan.style.color = '#4caf50';
    pushSpan.textContent = '↑ Push';
    const pullSpan = document.createElement('span');
    pullSpan.style.color = '#f44336';
    pullSpan.textContent = '↓ Pull';
    dragDiv.textContent = 'Drag: ';
    dragDiv.appendChild(pushSpan);
    dragDiv.appendChild(document.createTextNode(' / '));
    dragDiv.appendChild(pullSpan);
    hint.appendChild(dragDiv);

    const shiftDiv = document.createElement('div');
    shiftDiv.style.fontSize = '11px';
    shiftDiv.style.color = '#888';
    shiftDiv.style.marginTop = '2px';
    const shiftB = document.createElement('b');
    shiftB.textContent = 'Shift';
    shiftDiv.textContent = 'Hold ';
    shiftDiv.appendChild(shiftB);
    shiftDiv.appendChild(document.createTextNode(' to invert'));
    hint.appendChild(shiftDiv);
  }

  _showHint() {
    this._createHint();
    const hint = document.getElementById('sculpt-hint');
    if (hint) hint.style.display = 'block';
  }

  _hideHint() {
    const hint = document.getElementById('sculpt-hint');
    if (hint) hint.style.display = 'none';
  }

  _getFaceIndexForIntersection(point, center, scale) {
    const dx = Math.abs(point.x - center.x) / scale[0];
    const dy = Math.abs(point.y - center.y) / scale[1];
    const dz = Math.abs(point.z - center.z) / scale[2];
    const max = Math.max(dx, dy, dz);
    if (max === dx) return point.x < center.x ? 0 : 2;
    if (max === dy) return point.y < center.y ? 4 : 6;
    return point.z < center.z ? 8 : 10;
  }

  activate() {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    this._bindEvents();
    this._showHint();
  }

  deactivate() {
    this.isActive = false;
    this.isDragging = false;
    this.selectedVoxel = null;
    this.dragStartPoint = null;
    this.dragStartPointer = null;
    this.dragNormal = null;
    this.startVoxelData = null;
    if (this.liveLabel) this.liveLabel.style.display = 'none';
    this._removeHighlight();
    this._hideHint();
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

    const voxelGroup = this.voxelEngine.voxelGroup;
    let hit = null;
    let intersections = [];

    for (const mesh of voxelGroup.children) {
      if (!mesh.isInstancedMesh) continue;
      const materialName = mesh.material.name;
      const instMap = this.voxelEngine.keyToInstance.get(materialName);
      if (!instMap) continue;

      for (const [key, instanceId] of instMap) {
        const voxel = this.voxelEngine.getVoxelAt(
          ...key.split(',').map(v => parseInt(v, 10))
        );
        if (!voxel) continue;

        const scale = voxel.scale || [1, 1, 1];
        const position = this.voxelEngine._worldPos({ x: voxel.x, y: voxel.y, z: voxel.z });

        const min = new THREE.Vector3(
          position.x - scale[0] * 0.5,
          position.y - scale[1] * 0.5,
          position.z - scale[2] * 0.5
        );
        const max = new THREE.Vector3(
          position.x + scale[0] * 0.5,
          position.y + scale[1] * 0.5,
          position.z + scale[2] * 0.5
        );

        const box = new THREE.Box3(min, max);
        const inter = new THREE.Vector3();
        const intersected = this.raycaster.ray.intersectBox(box, inter);
        if (intersected) {
          hit = {
            object: mesh,
            instanceId: instanceId,
            point: inter.clone(),
            faceIndex: this._getFaceIndexForIntersection(inter, position, scale)
          };
          break;
        }
      }
      if (hit) break;
    }

    if (!hit) {
      intersections = this.raycaster.intersectObjects(voxelGroup.children, true);
      for (const intr of intersections) {
        if (intr.object.isInstancedMesh && intr.instanceId !== undefined) {
          hit = intr;
          break;
        }
      }
    }

    if (hit && hit.instanceId !== undefined) {
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
        this.dragStartPoint = hit.point ? hit.point.clone() : this.voxelEngine._worldPos({ x, y, z });
        this.dragStartPointer = this.pointer.clone();

        if (hit.face && hit.face.normal) {
          this.dragNormal = hit.face.normal.clone();
        } else {
          const faceIndex = hit.faceIndex !== undefined ? hit.faceIndex : 0;
          const axis = Math.floor(faceIndex / 2);
          const sign = faceIndex % 2 === 0 ? -1 : 1;
          this.dragNormal = axis === 0 ? new THREE.Vector3(sign, 0, 0) :
                           axis === 1 ? new THREE.Vector3(0, sign, 0) :
                           new THREE.Vector3(0, 0, sign);
        }

        const voxel = this.voxelEngine.getVoxelAt(x, y, z);
        if (voxel) {
          this.startVoxelData = {
            x: voxel.x, y: voxel.y, z: voxel.z,
            material: voxel.material,
            scale: voxel.scale ? [...voxel.scale] : [1, 1, 1]
          };
        }

        this._createDragHighlight(hit.point, this.dragNormal);
        this.liveLabel.style.display = 'block';
      }
    }
  }

  _onMouseMove(event) {
    if (!this.isDragging || !this.selectedVoxel || !this.dragStartPoint) return;

    const mouse = this._getMousePos(event);
    this.raycaster.setFromCamera(mouse, this.camera);

    // Calculate pixel movement distance (screen space)
    const deltaPixels = Math.sqrt(
      Math.pow(mouse.x - this.dragStartPointer.x, 2) +
      Math.pow(mouse.y - this.dragStartPointer.y, 2)
    );

    // Apply deformation based on pixel movement
    const dragDistance = deltaPixels;
    const deformation = dragDistance * (this.strength / this.sensitivity);
    const isPull = event.shiftKey;
    const finalDeformation = isPull ? -deformation : deformation;

    const voxel = this.voxelEngine.getVoxelAt(
      this.selectedVoxel.x,
      this.selectedVoxel.y,
      this.selectedVoxel.z
    );

    if (voxel) {
      if (!voxel.scale) voxel.scale = [1, 1, 1];

      const normalAxis = Math.abs(this.dragNormal.x) > 0.5 ? 0 :
                       Math.abs(this.dragNormal.y) > 0.5 ? 1 : 2;

      const baseScale = this.startVoxelData ? this.startVoxelData.scale[normalAxis] : 1;
      const newScale = Math.max(0.1, baseScale + finalDeformation);

      voxel.scale[normalAxis] = newScale;

      this._updateDeformationLabel(finalDeformation, voxel.scale[normalAxis], isPull ? 'Pull' : 'Push');
      this._applyVoxelScale(voxel);
    }
  }

  _onMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;

      if (this.selectedVoxel && this.startVoxelData) {
        const voxel = this.voxelEngine.getVoxelAt(
          this.selectedVoxel.x,
          this.selectedVoxel.y,
          this.selectedVoxel.z
        );

        if (voxel) {
          const endScale = voxel.scale ? [...voxel.scale] : [1, 1, 1];
          this.voxelEngine._pushHistory({
            type: 'sculpt',
            x: this.selectedVoxel.x,
            y: this.selectedVoxel.y,
            z: this.selectedVoxel.z,
            oldScale: this.startVoxelData.scale,
            newScale: endScale,
            material: this.startVoxelData.material
          });

          this.voxelEngine._onVoxelChanged();
        }
      }

      this._removeHighlight();
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

  _createDragHighlight(point, normal) {
    this._removeHighlight();

    const geo = new THREE.RingGeometry(0.25, 0.35, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false
    });

    const highlight = new THREE.Mesh(geo, mat);
    highlight.position.copy(point);
    highlight.position.add(normal.clone().multiplyScalar(0.02));

    const lookAtPoint = point.clone().add(normal);
    highlight.lookAt(lookAtPoint);

    this.dragHighlight = highlight;
    this.scene.add(this.dragHighlight);

    const label = document.createElement('div');
    label.id = 'sculpt-drag-label';
    label.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(255,107,107,0.9);color:#fff;padding:4px 12px;' +
      'border-radius:4px;font-family:sans-serif;font-size:12px;font-weight:bold;' +
      'pointer-events:none;z-index:10001;white-space:nowrap;';
    label.textContent = 'DRAG ↑↓';
    this._dragLabel = label;
    document.body.appendChild(this._dragLabel);
  }

  _removeHighlight() {
    if (this.dragHighlight) {
      this.scene.remove(this.dragHighlight);
      if (this.dragHighlight.geometry) this.dragHighlight.geometry.dispose();
      if (this.dragHighlight.material) this.dragHighlight.material.dispose();
      this.dragHighlight = null;
    }
    if (this._dragLabel) {
      this._dragLabel.remove();
      this._dragLabel = null;
    }
  }

  _updateDeformationLabel(deformation, currentScale, mode) {
    if (!this.liveLabel) return;

    const absDeformation = Math.abs(deformation);
    const direction = deformation >= 0 ? '+' : '-';

    this.liveLabel.textContent = '';

    const titleDiv = document.createElement('div');
    titleDiv.style.fontWeight = 'bold';
    titleDiv.style.marginBottom = '8px';
    titleDiv.textContent = 'Sculpting';
    this.liveLabel.appendChild(titleDiv);

    const modeDiv = document.createElement('div');
    modeDiv.textContent = `Mode: ${mode}`;
    this.liveLabel.appendChild(modeDiv);

    const scaleDiv = document.createElement('div');
    scaleDiv.textContent = `Current scale: ${currentScale.toFixed(2)} mm`;
    this.liveLabel.appendChild(scaleDiv);

    const defDiv = document.createElement('div');
    defDiv.style.marginTop = '4px';
    const defSpan = document.createElement('span');
    defSpan.style.color = deformation >= 0 ? '#4caf50' : '#f44336';
    defSpan.textContent = `${direction}${absDeformation.toFixed(2)} mm`;
    defDiv.textContent = 'Deformation: ';
    defDiv.appendChild(defSpan);
    this.liveLabel.appendChild(defDiv);
  }

  destroy() {
    this.deactivate();
    if (this.liveLabel && this.liveLabel.parentNode) {
      this.liveLabel.parentNode.removeChild(this.liveLabel);
    }
    const hint = document.getElementById('sculpt-hint');
    if (hint) hint.remove();
  }
}

export default SculptTool;