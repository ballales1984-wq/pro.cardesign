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
    this._plane = new THREE.Plane(); // Reused plane to reduce allocations

    // Drag state
    this.selectedVoxel = null;
    this.dragStartPoint = null;
    this.dragNormal = null;
    this.startVoxelData = null;

    // Strength settings
    this.strength = 0.5; // mm per drag pixel
    this.sensitivity = 100; // pixels per mm of strength effect

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
     // Title
     const titleDiv = document.createElement('div');
     titleDiv.style.fontWeight = 'bold';
     titleDiv.style.marginBottom = '4px';
     titleDiv.textContent = '🗿 Sculpt Tool';
     hint.appendChild(titleDiv);
     
     // Drag description
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
     
     // Shift hint
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
    console.log('[SculptTool._onMouseDown] isActive:', this.isActive, 'button:', event.button);
    if (!this.isActive || event.button !== 0) return;

    const mouse = this._getMousePos(event);
    console.log('[SculptTool._onMouseDown] pointer:', mouse.x.toFixed(3), mouse.y.toFixed(3));
    this.raycaster.setFromCamera(mouse, this.camera);

    // Intersect with voxel group children (InstancedMeshes)
    const voxelGroup = this.voxelEngine.voxelGroup;
    console.log('[SculptTool._onMouseDown] voxelGroup children:', voxelGroup?.children?.length ?? 'none');
    const intersections = this.raycaster.intersectObjects(
      voxelGroup.children, true
    );
    console.log('[SculptTool] Intersections found:', intersections.length);

    // Find first InstancedMesh hit
    let hit = null;
    for (const intr of intersections) {
      if (intr.object.isInstancedMesh && intr.instanceId !== undefined) {
        hit = intr;
        break;
      }
    }

    if (hit && hit.instanceId !== undefined) {
      const materialName = hit.object.material.name;
      const instanceId = hit.instanceId;
      const keyObj = this.voxelEngine.instanceToKey.get(materialName);
      const key = keyObj ? keyObj[instanceId] : null;

      console.log('[SculptTool] Hit key:', key, 'instanceId:', instanceId);

      if (key) {
         const parts = key.split(',');
         const x = parseInt(parts[0], 10);
         const y = parseInt(parts[1], 10);
         const z = parseInt(parts[2], 10);
         this.isDragging = true;
         this.selectedVoxel = { x, y, z };
         this.dragStartPoint = hit.point.clone();
         // Handle InstancedMesh raycast which may not have face.normal
         this.dragNormal = (hit.face && hit.face.normal) ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);

        // Store original voxel data
        const voxel = this.voxelEngine.getVoxelAt(x, y, z);
        if (voxel) {
          this.startVoxelData = {
            x: voxel.x,
            y: voxel.y,
            z: voxel.z,
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
    if (!this.isActive) return;
    if (!this.isDragging) return;

    const mouse = this._getMousePos(event);
    console.log('[Sculpt._onMouseMove] dragging, pointer:', mouse.x.toFixed(3), mouse.y.toFixed(3));

    if (this.isDragging && this.selectedVoxel && this.dragStartPoint) {
      this.raycaster.setFromCamera(mouse, this.camera);

      // Create plane perpendicular to drag normal at start point
      this._plane.normal.copy(this.dragNormal);
      this._plane.setFromNormalAndCoplanarPoint(this._plane.normal, this.dragStartPoint);

      const intersection = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this._plane, intersection);

      if (intersection) {
        const currentPoint = intersection;
        const startPoint = this.dragStartPoint;

        // Calculate drag distance along normal direction
        let dragDistance = 0;
        if (this.dragNormal.x !== 0) dragDistance = (currentPoint.x - startPoint.x) / this.dragNormal.x;
        else if (this.dragNormal.y !== 0) dragDistance = (currentPoint.y - startPoint.y) / this.dragNormal.y;
        else if (this.dragNormal.z !== 0) dragDistance = (currentPoint.z - startPoint.z) / this.dragNormal.z;

        // Apply strength and sensitivity
        const deformation = dragDistance * (this.strength / this.sensitivity);

        // Determine if we're pushing (positive) or pulling (negative)
        // Shift key = pull (remove material), default = push (add material)
        const isPull = event.shiftKey;
        const finalDeformation = isPull ? -deformation : deformation;

        // Apply deformation to voxel scale along normal axis
        const voxel = this.voxelEngine.getVoxelAt(
          this.selectedVoxel.x,
          this.selectedVoxel.y,
          this.selectedVoxel.z
        );

        console.log('[Sculpt._onMouseMove] voxel found:', !!voxel,
                    'dragDist:', dragDistance.toFixed(4),
                    'deformation:', deformation.toFixed(4),
                    'finalDeform:', finalDeformation.toFixed(4));

        if (voxel) {
          if (!voxel.scale) voxel.scale = [1, 1, 1];

          // Calculate new scale based on normal direction
          const normalAxis = Math.abs(this.dragNormal.x) > 0.5 ? 0 :
                           Math.abs(this.dragNormal.y) > 0.5 ? 1 : 2;

          const baseScale = this.startVoxelData ? this.startVoxelData.scale[normalAxis] : 1;
          const newScale = Math.max(0.1, baseScale + finalDeformation); // Minimum 0.1 to prevent collapsing

          console.log('[Sculpt._onMouseMove] normalAxis:', normalAxis,
                      'baseScale:', baseScale.toFixed(3),
                      'newScale:', newScale.toFixed(3));

          voxel.scale[normalAxis] = newScale;

          // Update live label
          this._updateDeformationLabel(finalDeformation, voxel.scale[normalAxis], isPull ? 'Pull' : 'Push');

          // Apply the scale change to the voxel
          this._applyVoxelScale(voxel);
        }
      }
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
          // Record in history for undo/redo
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
    console.log('[Sculpt._applyVoxelScale] key:', key, 'scale:', voxel.scale?.join(','));
    const materialName = voxel.material;
    const mesh = this.voxelEngine.instancedMeshes.get(materialName);

    if (mesh) {
      const instMap = this.voxelEngine.keyToInstance.get(materialName);
      const instanceId = instMap ? instMap.get(key) : undefined;
      console.log('[Sculpt._applyVoxelScale] instMap exists:', !!instMap, 'instanceId:', instanceId);
      if (instanceId !== undefined) {
        const scale = voxel.scale || [1, 1, 1];
        this.voxelEngine._setInstanceMatrix(
          mesh,
          instanceId,
          this.voxelEngine._worldPos({ x: voxel.x, y: voxel.y, z: voxel.z }),
          new THREE.Vector3(scale[0], scale[1], scale[2])
        );
        console.log('[Sculpt._applyVoxelScale] _setInstanceMatrix DONE, newScale:', scale.join(','));
      } else {
        console.warn('[Sculpt._applyVoxelScale] instanceId is undefined for key:', key);
      }
    } else {
      console.warn('[Sculpt._applyVoxelScale] No mesh for material:', materialName);
    }
  }

  _createDragHighlight(point, normal) {
    this._removeHighlight();

    // Create a larger, more visible indicator for drag plane
    const geo = new THREE.RingGeometry(0.25, 0.35, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff6b6b,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false
    });

    // Orient the highlight to face the camera (billboard) but aligned with drag normal
    const highlight = new THREE.Mesh(geo, mat);
    highlight.position.copy(point);
    highlight.position.add(normal.clone().multiplyScalar(0.02)); // Slight offset

    // Make it face the camera
    const lookAtPoint = point.clone().add(normal);
    highlight.lookAt(lookAtPoint);

    this.dragHighlight = highlight;
    this.scene.add(highlight);

    // Add a visual "DRAG" label
    const label = document.createElement('div');
    label.id = 'sculpt-drag-label';
    label.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'background:rgba(255,107,107,0.9);color:#fff;padding:4px 12px;' +
      'border-radius:4px;font-family:sans-serif;font-size:12px;font-weight:bold;' +
      'pointer-events:none;z-index:10001;white-space:nowrap;';
    label.textContent = 'DRAG ↑↓';
    this._dragLabel = label;
    document.body.appendChild(label);
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

     // Title
     const titleDiv = document.createElement('div');
     titleDiv.style.fontWeight = 'bold';
     titleDiv.style.marginBottom = '8px';
     titleDiv.textContent = 'Sculpting';
     this.liveLabel.appendChild(titleDiv);

     // Mode
     const modeDiv = document.createElement('div');
     modeDiv.textContent = `Mode: ${mode}`;
     this.liveLabel.appendChild(modeDiv);

     // Current scale
     const scaleDiv = document.createElement('div');
     scaleDiv.textContent = `Current scale: ${currentScale.toFixed(2)} mm`;
     this.liveLabel.appendChild(scaleDiv);

     // Deformation
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