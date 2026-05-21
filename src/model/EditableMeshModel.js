/**
 * EditableMeshModel — an independent, editable Three.js mesh
 *
 * This is the "source of truth" in mesh mode (HybridModel.mode === 'mesh').
 * Wraps a THREE.BufferGeometry + THREE.Mesh and exposes a clean API for
 * vertex, edge and face manipulation without touching the voxel engine.
 */
function _getTHREE() {
  return (typeof globalThis !== 'undefined' && globalThis.THREE) || {};
}

const THREE = _getTHREE();

export class EditableMeshModel {
  /** The Three.js mesh that is rendered in the scene */
  constructor(sourceGeometry) {
    // ---------------------------------------------------------------
    // EditableMeshModel needs its own independent copy of the source
    // geometry so vertex edits don't leak back.
    // ---------------------------------------------------------------
    var cloned;
    if (!sourceGeometry) {
      // No geometry given: create empty BufferGeometry
      var T = globalThis.THREE || {};
      cloned = T.BufferGeometry ? new T.BufferGeometry() : {};
    } else if (typeof sourceGeometry.clone === 'function') {
      cloned = sourceGeometry.clone();
    } else {
      cloned = (function shallowCloneBufferGeometry(g) {
        var posAttr = null;
        if (g.attributes && g.attributes.position && g.attributes.position.array) {
          var a = g.attributes.position.array;
          posAttr = { array: new ArrayBuffer(a.byteLength), count: a.length / 3, needsUpdate: false };
          new Float32Array(posAttr.array).set(a);
        }
        return Object.assign({}, g, {
          attributes: posAttr
            ? Object.assign({}, g.attributes, { position: posAttr })
            : (g.attributes || {}),
        });
      })(sourceGeometry);
    }
    this.geometry = cloned;
    this._positions = (this.geometry.attributes && this.geometry.attributes.position && this.geometry.attributes.position.array)
      ? this.geometry.attributes.position.array
      : new Float32Array(0);

    this.mesh = new THREE.Mesh(this.geometry, new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.55,
      roughness: 0.40,
      side: THREE.DoubleSide,
    }));
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Geometry queries
  // ═══════════════════════════════════════════════════════════════════════

  /** Number of vertices in the mesh */
  get vertexCount() {
    return this._positions.length / 3;
  }

  /** Number of faces (triangles) */
  get faceCount() {
    return this.geometry.index
      ? this.geometry.index.count / 3
      : this._positions.length / 9;
  }

  /** Bounding sphere (recomputed after edits) */
  get boundingSphere() {
    this.geometry.computeBoundingSphere();
    return this.geometry.boundingSphere || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Vertex operations
  // ═══════════════════════════════════════════════════════════════════════

  /** Move a single vertex by delta (immediately applied) */
  moveVertex(vertexIndex, delta) {
    const i = vertexIndex * 3;
    this._positions[i]   += delta.x;
    this._positions[i+1] += delta.y;
    this._positions[i+2] += delta.z;
    this._flagUpdate();
  }

  /** Move an arbitrary set of vertices by a shared delta */
  moveVertices(ops) {
    for (const op of ops) {
      this.moveVertex(op.vertexIndex, op.delta);
    }
  }

  /** Set a vertex position exactly */
  setVertex(vertexIndex, pos) {
    const i = vertexIndex * 3;
    this._positions[i]   = pos.x;
    this._positions[i+1] = pos.y;
    this._positions[i+2] = pos.z;
    this._flagUpdate();
  }

  /** Get a vertex world position */
  getVertex(vertexIndex, worldMatrix) {
    const i = vertexIndex * 3;
    const v = new THREE.Vector3(this._positions[i], this._positions[i+1], this._positions[i+2]);
    if (worldMatrix) v.applyMatrix4(worldMatrix);
    return v;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Shared state helpers
  // ═══════════════════════════════════════════════════════════════════════

  _flagUpdate() {
    this.geometry.getAttribute('position').needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  /** Returns a snapshot of all current vertex positions */
  snapshotVertices() {
    return Float32Array.from(this._positions);
  }

  /** Restore all vertex positions from a Float32Array snapshot */
  restoreVertices(snapshot) {
    this._positions.set(snapshot);
    this._flagUpdate();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Boolean / CSG operations
  // ═══════════════════════════════════════════════════════════════════════

  /** Use require() so top-level dynamic import pattern stays intact */
  _booleanOps() {
    return require('../boolean/BooleanOperations.js');
  }

  /**
   * Subtract `other` from this mesh (A - B), in-place.
   * @param {THREE.Mesh} other
   * @returns {EditableMeshModel} this
   */
  subtract(other) {
    const { BooleanOperations } = this._booleanOps();
    const result = BooleanOperations.perform(this.mesh, other, 'subtract');
    this._replaceWith(result.geometry);
    return this;
  }

  /**
   * Union this mesh with `other` (A ∪ B), in-place.
   * @param {THREE.Mesh} other
   * @returns {EditableMeshModel} this
   */
  union(other) {
    const { BooleanOperations } = this._booleanOps();
    const result = BooleanOperations.perform(this.mesh, other, 'union');
    this._replaceWith(result.geometry);
    return this;
  }

  /**
   * Intersect this mesh with `other` (A ∩ B), in-place.
   * @param {THREE.Mesh} other
   * @returns {EditableMeshModel} this
   */
  intersect(other) {
    const { BooleanOperations } = this._booleanOps();
    const result = BooleanOperations.perform(this.mesh, other, 'intersect');
    this._replaceWith(result.geometry);
    return this;
  }

  /**
   * Create a primitive, position it, then subtract from this mesh.
   * @param {string} type 'box'|'cylinder'|'sphere'|'cone'|'pyramid'|'torus'
   * @param {Object} params { position, rotation, scale, size/radius/… }
   * @returns {EditableMeshModel} this
   */
  addPrimitiveAndSubtract(type, params = {}) {
    const { BooleanOperations } = this._booleanOps();
    const geo = BooleanOperations._createPrimitive
      ? BooleanOperations._createPrimitive(type, params.size || params)
      : (() => {
          // Inline fallback so we don't depend on a non-existent API
          const sizes = params.size || [1, 1, 1];
          if (type === 'box' || type === 'cube') {
            return new THREE.BoxGeometry(sizes[0], sizes[1], sizes[2]);
          }
          if (type === 'cylinder') {
            const r = params.radius || 1;
            return new THREE.CylinderGeometry(r, r, params.height || 2, 24);
          }
          if (type === 'sphere') {
            return new THREE.SphereGeometry(params.radius || 1, 16, 16);
          }
          if (type === 'cone') {
            return new THREE.ConeGeometry(params.radius || 1, params.height || 2, 24);
          }
          if (type === 'pyramid') {
            return new THREE.CylinderGeometry(0, (params.baseSize || 2) / 2, params.height || 2, 4, 1);
          }
          throw new Error(`Unknown primitive: ${type}`);
        })();

    const mesh = new THREE.Mesh(geo);
    if (params.position) mesh.position.copy(params.position);
    if (params.rotation)  mesh.rotation.copy(params.rotation);
    if (params.scale)     mesh.scale.copy(params.scale);
    mesh.updateMatrixWorld(true);
    return this.subtract(mesh);
  }

  /** Internal: swap out geometry after a boolean or edit operation */
  _replaceWith(newGeometry) {
    this.geometry.dispose();
    this.geometry = newGeometry;
    this.mesh.geometry = this.geometry;
    this._positions = this.geometry.attributes.position.array;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingBox();
    this.geometry.computeBoundingSphere();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Resource lifecycle
  // ═══════════════════════════════════════════════════════════════════════

  dispose() {
    this.geometry.dispose();
    if (this.mesh.material && typeof this.mesh.material.dispose === 'function') {
      this.mesh.material.dispose();
    }
  }
}
