/**
 * MeshPointEditTool - editable point-mesh layer generated from current voxels.
 *
 * This tool keeps the voxel model intact and creates an overlay BufferGeometry
 * that can be reshaped by dragging surface points.
 */

import * as THREE from 'three';
import { voxelToMesh } from '../geometry/converters/voxelToMesh.js';

const POINT_COLOR = 0x34d399;
const ACTIVE_POINT_COLOR = 0xff6b6b;
const MESH_COLOR = 0x38bdf8;
const POSITION_EPSILON = 1e-5;

export class MeshPointEditTool {
  constructor(voxelEngine, scene, camera, renderer) {
    this.voxelEngine = voxelEngine;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;

    this.isActive = false;
    this.isDragging = false;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.dragPlane = null;
    this.dragStartWorld = null;
    this.dragStartVertex = null;

    this.mesh = null;
    this.points = null;
    this.geometry = null;
    this.selectedVertexIndex = null;
    this.linkedVertexIndices = [];
    this.startPositions = null;
    this._boundCanvas = null;
    this._label = null;
    this._previousVoxelGroupVisible = null;
    this._isCommitted = false;
    this._onLabelClick = null;
    this._onKeyDown = null;
    this._sourceMaterialName = null;

    this._createLabel();
  }

  activate() {
    this.isActive = true;
    document.body.style.cursor = 'crosshair';
    if (!this.geometry) this.createLayerFromVoxels();
    this._setLayerVisible(true);
    if (this.points) this.points.visible = true;
    this._setVoxelLayerVisible(false);
    this._bindEvents();
    this._updateLabel();
  }

    deactivate() {
        this.isActive = false;
        this.isDragging = false;
        this.selectedVertexIndex = null;
        this.linkedVertexIndices = [];
        this._unbindEvents();
        if (this._label) this._label.style.display = 'none';
        if (this.geometry) {
            this.finishEditing();
        } else {
            this._setVoxelLayerVisible(true);
        }
        document.body.style.cursor = '';
    }

  createLayerFromVoxels(options = {}) {
    this.clearLayer();
    const sourceVoxels = Array.from(this.voxelEngine.voxelsIterator());
    this._sourceMaterialName = this._resolveSourceMaterial(sourceVoxels);

    const result = voxelToMesh(sourceVoxels, {
      voxelSize: this.voxelEngine.voxelSize || 1.0,
      flatCubes: options.flatCubes !== undefined ? options.flatCubes : true,
      faceSubdivisions: options.faceSubdivisions || 4,
    });

    this.geometry = result.geometry;
    this.geometry.computeVertexNormals?.();
    this.geometry.computeBoundingBox?.();
    this.geometry.computeBoundingSphere?.();

    const meshMaterial = new THREE.MeshStandardMaterial({
      color: MESH_COLOR,
      transparent: true,
      opacity: 0.72,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: true,
      wireframe: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, meshMaterial);
    this.mesh.name = '_meshPointEditLayer';
    this.scene.add(this.mesh);

    const pointMaterial = new THREE.PointsMaterial({
      color: POINT_COLOR,
      size: options.pointSize || 0.09,
      sizeAttenuation: true,
      depthTest: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, pointMaterial);
    this.points.name = '_meshPointEditPoints';
    this.scene.add(this.points);
    this._isCommitted = false;

    return result;
  }

  clearLayer() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.material?.dispose?.();
      this.mesh = null;
    }
    if (this.points) {
      this.scene.remove(this.points);
      this.points.material?.dispose?.();
      this.points = null;
    }
    if (this.geometry) {
      this.geometry.dispose?.();
      this.geometry = null;
    }
    this._isCommitted = false;
    this._setVoxelLayerVisible(true);
    this.selectedVertexIndex = null;
    this.linkedVertexIndices = [];
  }

  commitEdits() {
    if (!this.geometry || !this.mesh) return false;
    this._flagGeometryChanged(true);
    this._applyFinalMaterial();
    this._isCommitted = true;
    this.mesh.visible = true;
    if (this.points) this.points.visible = false;
    // Note: Do NOT hide voxel layer here - that's handled by activate/deactivate
    this.voxelEngine?._notify?.('Nuova versione mesh confermata', 'success');
    return true;
  }

  finishEditing() {
    if (!this.commitEdits()) return false;
    this.isActive = false;
    this.isDragging = false;
    this.selectedVertexIndex = null;
    this.linkedVertexIndices = [];
    this.dragPlane = null;
    this.dragStartWorld = null;
    this.dragStartVertex = null;
    this.startPositions = null;
    if (this._label) this._label.style.display = 'none';
    this._unbindEvents();
    document.body.style.cursor = '';
    return true;
  }

  hasCommittedMesh() {
    return this._isCommitted && !!this.geometry && !!this.mesh;
  }

  get vertexCount() {
    const attr = this.geometry?.getAttribute?.('position') || this.geometry?.attributes?.position;
    return attr?.count || 0;
  }

  getSelectedVertex() {
    if (this.selectedVertexIndex === null) return null;
    return this._getVertex(this.selectedVertexIndex);
  }

  moveVertex(vertexIndex, delta, linked = true) {
    if (!this.geometry || vertexIndex === null || vertexIndex === undefined) return false;
    const indices = linked ? this._linkedVerticesAt(vertexIndex) : [vertexIndex];
    const pos = this._positionAttr();
    if (!pos) return false;

    for (const idx of indices) {
      pos.setXYZ(
        idx,
        pos.getX(idx) + delta.x,
        pos.getY(idx) + delta.y,
        pos.getZ(idx) + delta.z
      );
    }
    this._flagGeometryChanged();
    return true;
  }

  setVertex(vertexIndex, worldPos, linked = true) {
    if (!this.geometry || vertexIndex === null || vertexIndex === undefined) return false;
    const indices = linked ? this._linkedVerticesAt(vertexIndex) : [vertexIndex];
    const pos = this._positionAttr();
    if (!pos) return false;

    const base = this._getVertex(vertexIndex);
    const delta = worldPos.clone().sub(base);
    for (const idx of indices) {
      pos.setXYZ(
        idx,
        pos.getX(idx) + delta.x,
        pos.getY(idx) + delta.y,
        pos.getZ(idx) + delta.z
      );
    }
    this._flagGeometryChanged();
    return true;
  }

  snapshotVertices() {
    const pos = this._positionAttr();
    return pos?.array ? Float32Array.from(pos.array) : new Float32Array(0);
  }

  restoreVertices(snapshot) {
    const pos = this._positionAttr();
    if (!pos || !snapshot || snapshot.length !== pos.array.length) return false;
    pos.array.set(snapshot);
    this._flagGeometryChanged();
    return true;
  }

  toJSON() {
    const pos = this._positionAttr();
    return {
      vertexCount: this.vertexCount,
      committed: this._isCommitted,
      material: this._sourceMaterialName,
      positions: pos?.array ? Array.from(pos.array) : [],
    };
  }

  fromJSON(data) {
    if (!data?.positions) return false;
    if (!this.geometry) this.createLayerFromVoxels();
    const pos = this._positionAttr();
    if (!pos || data.positions.length !== pos.array.length) return false;
    pos.array.set(data.positions);
    this._isCommitted = !!data.committed;
    this._sourceMaterialName = data.material || this._sourceMaterialName;
    if (this.mesh) this.mesh.visible = true;
    if (this.points) this.points.visible = !this._isCommitted;
    if (this._isCommitted) {
      this._applyFinalMaterial();
      this._setVoxelLayerVisible(false);
    }
    this._flagGeometryChanged();
    return true;
  }

  destroy() {
    this.deactivate();
    this.clearLayer();
    if (this._label?.parentNode) this._label.parentNode.removeChild(this._label);
  }

  _bindEvents() {
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onKeyDown = this._onKeyDownHandler.bind(this);
    this._boundCanvas = this.renderer.domElement;
    this._boundCanvas.addEventListener('pointerdown', this._onMouseDown);
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pointermove', this._onMouseMove);
      window.addEventListener('pointerup', this._onMouseUp);
      window.addEventListener('keydown', this._onKeyDown);
    }
  }

  _unbindEvents() {
    if (this._boundCanvas) this._boundCanvas.removeEventListener('pointerdown', this._onMouseDown);
    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('pointermove', this._onMouseMove);
      window.removeEventListener('pointerup', this._onMouseUp);
      window.removeEventListener('keydown', this._onKeyDown);
    }
  }

  _onKeyDownHandler(event) {
    if (!this.isActive) return;
    if (event.key === 'Enter') {
      this.finishEditing();
      event.preventDefault?.();
      event.stopPropagation?.();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.selectedVertexIndex !== null) {
        this.deleteVertices([this.selectedVertexIndex], true);
        this._updateLabel();
      }
      event.preventDefault?.();
      event.stopPropagation?.();
    }
  }

  _onMouseDown(event) {
    if (!this.isActive || event.button !== 0 || !this.points) return;
    const mouse = this._getMousePos(event);
    this.raycaster.setFromCamera(mouse, this.camera);
    if (this.raycaster.params?.Points) this.raycaster.params.Points.threshold = 0.16;

    const hits = this.raycaster.intersectObject(this.points, false);
    if (!hits.length || hits[0].index === undefined) return;

    this.selectedVertexIndex = hits[0].index;
    this.linkedVertexIndices = this._linkedVerticesAt(this.selectedVertexIndex);
    this.isDragging = true;
    this.dragStartWorld = hits[0].point.clone();
    this.dragStartVertex = this._getVertex(this.selectedVertexIndex);
    this.startPositions = this.snapshotVertices();

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    this.dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, this.dragStartWorld);
    this._setPointColor(ACTIVE_POINT_COLOR);
    this._updateLabel();
    event.stopPropagation();
  }

  _onMouseMove(event) {
    if (!this.isActive || !this.isDragging || !this.dragPlane) return;
    this.raycaster.setFromCamera(this._getMousePos(event), this.camera);
    const worldHit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, worldHit)) return;

    const delta = worldHit.clone().sub(this.dragStartWorld);
    const pos = this._positionAttr();
    if (!pos || !this.startPositions) return;
    pos.array.set(this.startPositions);
    this._flagGeometryChanged(false);
    this.moveVertex(this.selectedVertexIndex, delta, true);
    this._updateLabel();
  }

  _onMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.dragPlane = null;
    this.dragStartWorld = null;
    this.dragStartVertex = null;
    this.startPositions = null;
    this._setPointColor(POINT_COLOR);
    this._updateLabel();
  }

  _getMousePos(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return this.pointer;
  }

  _positionAttr() {
    return this.geometry?.getAttribute?.('position') || this.geometry?.attributes?.position || null;
  }

  _getVertex(index) {
    const pos = this._positionAttr();
    return new THREE.Vector3(pos.getX(index), pos.getY(index), pos.getZ(index));
  }

  _linkedVerticesAt(vertexIndex) {
    const pos = this._positionAttr();
    if (!pos) return [];
    const base = this._getVertex(vertexIndex);
    const linked = [];
    for (let i = 0; i < pos.count; i++) {
      if (
        Math.abs(pos.getX(i) - base.x) <= POSITION_EPSILON &&
        Math.abs(pos.getY(i) - base.y) <= POSITION_EPSILON &&
        Math.abs(pos.getZ(i) - base.z) <= POSITION_EPSILON
      ) {
        linked.push(i);
      }
    }
    return linked;
  }

  _flagGeometryChanged(updateNormals = true) {
    const pos = this._positionAttr();
    if (pos) pos.needsUpdate = true;
    if (updateNormals) this.geometry.computeVertexNormals?.();
    this.geometry.computeBoundingBox?.();
    this.geometry.computeBoundingSphere?.();
  }

  _resolveSourceMaterial(voxels) {
    if (voxels.length > 0 && voxels[0].material) return voxels[0].material;
    return this.voxelEngine?.activeMaterial || 'steel';
  }

  _materialProps(materialName) {
    const material = this.voxelEngine?.materialDB?.get?.(materialName) || null;
    return {
      color: material?.color ?? MESH_COLOR,
      roughness: material?.roughness ?? 0.45,
      metalness: material?.metalness ?? 0.2,
      transparent: !!material?.transparent,
      opacity: material?.opacity ?? 1.0,
    };
  }

  _makeMaterialForSource(materialName) {
    const props = this._materialProps(materialName);
    return new THREE.MeshStandardMaterial({
      color: props.color,
      roughness: props.roughness,
      metalness: props.metalness,
      transparent: props.transparent,
      opacity: props.opacity,
      side: THREE.DoubleSide,
      depthWrite: !props.transparent,
      wireframe: false,
    });
  }

  _applyFinalMaterial() {
    if (!this.mesh) return;
    const oldMaterial = this.mesh.material;
    this.mesh.material = this._makeMaterialForSource(this._sourceMaterialName);
    oldMaterial?.dispose?.();
  }

  _setLayerVisible(visible) {
    if (this.mesh) this.mesh.visible = visible;
    if (this.points) this.points.visible = visible;
  }

  _setVoxelLayerVisible(visible) {
    const group = this.voxelEngine?.voxelGroup;
    if (!group) return;
    if (!visible) {
      if (this._previousVoxelGroupVisible === null) {
        this._previousVoxelGroupVisible = group.visible !== false;
      }
      group.visible = false;
      return;
    }
    if (this._previousVoxelGroupVisible !== null) {
      group.visible = this._previousVoxelGroupVisible;
      this._previousVoxelGroupVisible = null;
    }
  }

  _setPointColor(color) {
    if (this.points?.material?.color?.set) this.points.material.color.set(color);
  }

  _createLabel() {
    const el = document.createElement('div');
    el.id = 'mesh-point-edit-live-label';
    el.style.cssText =
      'position:fixed;top:20px;right:20px;' +
      'background:rgba(0,0,0,0.92);color:#34d399;' +
      'padding:12px 16px;border-radius:8px;' +
      'font-family:monospace;font-size:12px;' +
      'border:1px solid #34d399;display:none;' +
      'z-index:10000;pointer-events:auto;min-width:210px;';
    this._onLabelClick = (event) => {
      if (event.target?.id === 'mesh-point-finish') {
        this.finishEditing();
        event.preventDefault?.();
        event.stopPropagation?.();
      }
    };
    el.addEventListener('click', this._onLabelClick);
    document.body.appendChild(el);
    this._label = el;
  }

    _updateLabel() {
        if (!this._label || !this.isActive) return;
        const selected = this.getSelectedVertex();
        this._label.style.display = 'block';
        this._label.innerHTML =
          '<div style="font-weight:bold;margin-bottom:8px;">Mesh punti</div>' +
          `<div>Vertici: ${this.vertexCount}</div>` +
          `<div>Collegati: ${this.linkedVertexIndices.length || 0}</div>` +
          (selected
            ? `<div>Selezionato: #${this.selectedVertexIndex}</div>` +
              `<div>X:${selected.x.toFixed(2)} Y:${selected.y.toFixed(2)} Z:${selected.z.toFixed(2)}</div>`
            : '<div>Seleziona un punto superficie</div>') +
          '<div style="margin-top:8px;font-size:11px;color:#aaa;">Canc: Elimina punti selezionati</div>' +
          '<button id="mesh-point-finish" type="button" ' +
          'style="margin-top:10px;width:100%;padding:7px;border:1px solid #34d399;' +
          'background:#063b32;color:#d1fae5;border-radius:6px;cursor:pointer;">' +
          'Fine modifica</button>';
      }
}

export default MeshPointEditTool;
