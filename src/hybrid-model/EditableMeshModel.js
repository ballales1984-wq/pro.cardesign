/**
 * EditableMeshModel — Hybrid wrapper around a Three.js mesh
 * Provides in-place boolean operations (union, subtract, intersect)
 * without requiring a separate voxel or brick layer.
 *
 * Architecture:
 *   geometry  – the current BufferGeometry
 *   mesh      – the visible THREE.Mesh
 *   positionAttr / vertices — cached arrays for quick access
 */

import * as THREE from 'three';
import { BooleanOperations } from '../boolean/BooleanOperations.js';
import { createPrimitive } from '../geometry/primitives.js';
import { Decimator } from '../boolean/Decimator.js';

export class EditableMeshModel {
  /**
   * @param {THREE.BufferGeometry} geometry
   * @param {THREE.Material} [material]
   */
  constructor(geometry, material) {
    this.geometry = geometry.clone();
    const mat = material || new THREE.MeshStandardMaterial({
      metalness: 0.7,
      roughness: 0.3,
    });
    this.mesh = new THREE.Mesh(this.geometry, mat);

    // Cached references for direct read/write
    this.positionAttr = this.geometry.attributes.position;
    this.vertices = this.positionAttr.array;

    // Ensure clean state
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }

  // ─── Boolean operations ─────────────────────────────────────────────────────

  subtract(otherMesh) {
    const resultMesh = BooleanOperations.perform(this.mesh, otherMesh, 'subtract');
    this._replaceWith(resultMesh.geometry);
  }

  union(otherMesh) {
    const resultMesh = BooleanOperations.perform(this.mesh, otherMesh, 'union');
    this._replaceWith(resultMesh.geometry);
  }

  intersect(otherMesh) {
    const resultMesh = BooleanOperations.perform(this.mesh, otherMesh, 'intersect');
    this._replaceWith(resultMesh.geometry);
  }

  /**
   * Creates a geometric primitive, places it at the given transform,
   * then subtracts it from this mesh — e.g. drilling a cylindrical hole.
   *
   * @param {string} type  — one of 'box', 'cylinder', 'sphere', 'cone', 'pyramid', 'torus'
   * @param {Object} params — { position, rotation, scale, size/radius/height/… }
   */
  addPrimitiveAndSubtract(type, params = {}) {
    const primGeo = createPrimitive(type, params.size || params);
    const primMesh = new THREE.Mesh(primGeo);
    primMesh.position.copy(params.position || new THREE.Vector3());
    primMesh.rotation.copy(params.rotation || new THREE.Euler());
    primMesh.scale.copy(params.scale || new THREE.Vector3(1, 1, 1));
    primMesh.updateMatrixWorld(true);
    this.subtract(primMesh);
  }

  /**
   * Replaces current geometry with the result of another editable model's mesh.
   * @param {EditableMeshModel} other
   * @param {'union' | 'subtract' | 'intersect'} op
   */
  combineWith(other, op = 'union') {
    const resultMesh = BooleanOperations.perform(this.mesh, other.mesh, op);
    this._replaceWith(resultMesh.geometry);
  }

  // ─── Preview helpers ────────────────────────────────────────────────────────

  /**
   * Returns a low-poly clone of this mesh for fast live preview.
   * @param {number} [quality=0.1]
   * @returns {THREE.Mesh}
   */
  createLowPolyPreview(quality = 0.1) {
    return Decimator.createPreviewVersion(this.mesh, quality);
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  _replaceWith(newGeometry) {
    this.geometry.dispose();
    this.geometry = newGeometry;
    this.mesh.geometry = this.geometry;
    this.positionAttr = this.geometry.attributes.position;
    this.vertices = this.positionAttr.array;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }

  /** Returns a cloned EditableMeshModel sharing the same geometry & material */
  clone() {
    return new EditableMeshModel(this.geometry, this.mesh.material);
  }

  /** Free resources */
  dispose() {
    this.geometry.dispose();
  }
}
