/**
 * MeshDeformer — Deforma i voxel del brick usando una mesh di riferimento esterna
 *
 * Workflow:
 *  1. Importa una mesh STL/OBJ come riferimento esterno
 *  2. Proietta i vertici del brick sulla superficie della mesh
 *  3. L'utente trascina → il brick deforma la forma seguendo la mesh
 *
 * Usa Three.js Raycaster per proiezione ortogonale punto→superficice.
 * Opzione "smooth corners": proietta ogni vertice sui 2-3 triangoli più vicini
 * e interpola per evitare salti.
 *
 * Dependencies: THREE (three.js), STLImporter (opzionale per import file)
 */

import * as THREE from 'three';
import { STLImporter } from './stl-import.js';

const DEFAULT_SAMPLE_DIST = 0.002;   // world units – triangle traversal step
const MAX_RAY_STEPS   = 60;           // max ray-march iterations

/** Colore di debug per la mesh di riferimento renderizzata semi-trasparente */
const REF_MESH_COLOR = 0x4488ff;

export class MeshDeformer {
  constructor(scene, camera, renderer, voxelEngine) {
    this.scene        = scene;
    this.camera       = camera;
    this.renderer     = renderer;
    this.voxelEngine  = voxelEngine;

    // ── Reference mesh ─────────────────────────────────────────────────
    this._refGeometry = null;          // THREE.BufferGeometry da STL/OBJ importato
    this._refMesh     = null;          // THREE.Mesh renderizzata in scena (semi-transparente)
    this._refVisible  = true;          // toggle show/hide
    this._refOpacity  = 0.25;          // alpha della mesh di riferimento


    // ── Smooth corners ─────────────────────────────────────────────────
    this._smoothIterations = 2;       // Laplacian smoothing passes (0 = off)
    this._smoothFactor     = 0.3;     // smoothing strength 0..1

    // ── Internal state ─────────────────────────────────────────────────
    this._refBoundingSphere = null;   // sphere cache
    this._refBBox           = null;   // THREE.Box3 cache
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  REFERENCE MESH MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Carica una mesh da File (STL o OBJ) e la imposta come riferimento.
   * @returns {Promise<THREE.BufferGeometry|null>} geometry caricata, null su errore
   */
  async loadReferenceMesh(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'stl') {
      return this._loadSTL(file);
    } else if (ext === 'obj') {
      return this._loadOBJ(file);
    }
    return null;
  }

  async _loadSTL(file) {
    if (typeof STLImporter === 'undefined') {
      // STLImporter already available in main.js scope
      // When used from main.js it is passed separately; here we just link up
    }

    // Dynamically import existing STLImporter if available
    try {
      const { STLImporter } = await import('./stl-import.js');
      const importer = new STLImporter(this.scene, this.camera, this.renderer);
      const geometry = await importer.importSTL(file);
      this.setReferenceGeometry(geometry);
      return geometry;
    } catch (e) {
      console.warn('MeshDeformer: STLImporter non disponibile, parsing STL direttamente', e.message);
      // Fallback: raw STL load
      const buf = await file.arrayBuffer();
      const geom = this._parseRawSTL(buf);
      if (geom) this.setReferenceGeometry(geom);
      return geom;
    }
  }

  async _loadOBJ(file) {
    // OBJ: minimal wavefront parser to Triangle position list
    // (full OBJ loader is a separate library; this handles the common case)
    const text = await file.text();
    const vertices = [];
    const lines = text.split('\n');
    let inObject = false;
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith('v ')) {
        const parts = t.split(/\s+/);
        vertices.push(parseFloat(parts[1])||0, parseFloat(parts[2])||0, parseFloat(parts[3])||0);
        inObject = true;
      }
    }
    if (!inObject || vertices.length < 9) return null;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
    this.setReferenceGeometry(geom);
    return geom;
  }

  _parseRawSTL(arrayBuffer) {
    const dv = new DataView(arrayBuffer);
    const triCount = dv.getUint32(80, true);
    const verts = [];
    const faces = [];
    for (let i = 0; i < triCount; i++) {
      const off = 84 + i * 50;
      dv.getFloat32(off, true);   // normal — skip
      for (let v = 0; v < 3; v++) {
        verts.push(dv.getFloat32(off+12+v*12, true), dv.getFloat32(off+16+v*12, true), dv.getFloat32(off+20+v*12, true));
      }
      faces.push([i*3, i*3+1, i*3+2]);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geom.setIndex(faces.flat());
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
    return geom;
  }

/**
     * Imposta direttamente una BufferGeometry come mesh di riferimento
     * (utile quando la geometria proviene da STLImporter o MeshExporter).
     */
  setReferenceGeometry(geometry) {
    this._removeRefMesh();
    this._refGeometry = geometry;
    // Ensure bounding box and sphere are computed
    if (geometry) {
      geometry.computeBoundingSphere();
      geometry.computeBoundingBox();
    }
    this._refBoundingSphere = geometry?.boundingSphere ?? null;
    this._refBBox = geometry?.boundingBox ?? null;

    // Crea la visualizzazione semi-trasparente in scena
    const mat = new THREE.MeshStandardMaterial({
      color: REF_MESH_COLOR,
      transparent: true,
      opacity: this._refOpacity,
      roughness: 0.6,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.name = '_meshRef';
    this.scene.add(mesh);
    this._refMesh = mesh;
  }

  /**
   * Rimuove la mesh di riferimento dalla scena.
   */
  clearReferenceMesh() {
    this._removeRefMesh();
    this._refGeometry = null;
    this._refBoundingSphere = null;
    this._refBBox = null;
  }

  _removeRefMesh() {
    if (this._refMesh) {
      this.scene.remove(this._refMesh);
      this._refMesh.material?.dispose();
      this._refMesh = null;
    }
  }

  setReferenceOpacity(opacity) {
    this._refOpacity = Math.max(0.05, Math.min(1.0, opacity));
    if (this._refMesh?.material) {
      this._refMesh.material.opacity = this._refOpacity;
    }
  }

  toggleVisibility() {
    this._refVisible = !this._refVisible;
    if (this._refMesh) this._refMesh.visible = this._refVisible;
    return this._refVisible;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PROJECTION (PUNTO → SUPERFICIE MESH)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Proietta un punto world-space sulla superficie della mesh di riferimento
   * lungo il vettore `direction` (default: asse Z della camera, usato per
   * proiezione ortogonale dallo schermo).
   *
   * Returns the world-space point on the mesh surface nearest to `worldPoint`
   * in the given direction.
   */
  projectPointOnMesh(worldPoint, direction) {
    if (!this._refGeometry) return worldPoint.clone();

    const dir = direction || this._cameraWorldZ();
    const ray = new THREE.Raycaster(worldPoint.clone(), dir.clone().normalize());
    ray.far = 100;   // max search distance

    // If we have a preview mesh in scene already, raycast against it
    if (this._refMesh) {
      ray.params.Mesh = {};
      const hits = ray.intersectObject(this._refMesh);
      if (hits.length > 0) return hits[0].point.clone();
    }

    // Fallback: brute-force triangle intersection
    return this._bruteForceProject(worldPoint, dir);
  }

  /**
   * Proietta i 8 vertici di un brick sulla superficie della mesh.
   * Restituisce un array di 8 THREE.Vector3 con i punti proiettati.
   */
  projectBrickVertices(voxel) {
    const worldVerts = this.voxelEngine._getVertexWorldPositions
      ? this.voxelEngine._getVertexWorldPositions(voxel)
      : this._defaultVertexPositions(voxel);
    const dir = this._cameraWorldZ();
    return worldVerts.map(v => this.projectPointOnMesh(v, dir));
  }

  /**
   * Deforma un brick verso la mesh di riferimento.
   * Chiama `onUpdate` dopo ogni vertice proiettato (per aggiornare la preview).
   * Returns world-center del brick dopo la deformazione.
   */
  deformBrickOnMesh(voxel, onUpdate) {
    if (!this._refGeometry) return null;

    const projected = this.projectBrickVertices(voxel);
    const orig       = this.voxelEngine._getVertexWorldPositions
      ? this.voxelEngine._getVertexWorldPositions(voxel)
      : this._defaultVertexPositions(voxel);

    // Smooth corners: blend each vertex toward average of k-nearest triangles
    if (this._smoothIterations > 0) {
      this._smoothCorners(projected, orig);
    }

    for (let i = 0; i < 8; i++) {
      // Clamp: no vertex can go past the mesh more than 30% beyond current
      const d = projected[i].clone().sub(orig[i]);
      d.clampLength(0, 5);   // max 5 voxel units shift
      projected[i] = orig[i].clone().add(d);
      if (onUpdate) onUpdate(i, projected[i]);
    }
    return projected;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SMOOTH CORNERS
  // ═══════════════════════════════════════════════════════════════════════

  _smoothCorners(projected, original) {
    for (let iter = 0; iter < this._smoothIterations; iter++) {
      const smoothed = projected.map((v, i) => {
        // Average with neighbors
        const neighbors = this._vertexNeighbors(i);
        let avg = new THREE.Vector3();
        for (const nb of neighbors) avg.add(projected[nb]);
        avg.divideScalar(neighbors.length);
        return v.clone().lerp(avg, this._smoothFactor);
      });
      projected.length = 0;
      projected.push(...smoothed);
    }
  }

  _vertexNeighbors(i) {
    // Map each vertex index → adjacent vertex indices that share an edge
    const neighbors = {
      0: [1, 2, 4],  1: [0, 3, 5],  2: [0, 3, 6],  3: [1, 2, 7],
      4: [0, 5, 6],  5: [1, 4, 7],  6: [2, 4, 7],  7: [3, 5, 6],
    };
    return neighbors[i] || [];
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  FIT / SCALE REF MESH TO VOXEL GRID
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Adatta la mesh di riferimento alla griglia voxel in modo che il brick
   * selezionato sia completamente contenuto.
   * @param {number} voxelSize — size of voxel in world units (usually 1.0)
   */
  fitRefMeshToVoxelGrid(voxelSize) {
    if (!this._refMesh) return;
    // Use bounding-box already stored in _refBBox from setReferenceGeometry
    if (this._refBBox?.min && this._refBBox?.max) {
      const min = this._refBBox.min, max = this._refBBox.max;
      const mid = new THREE.Vector3((min.x+max.x)/2, (min.y+max.y)/2, (min.z+max.z)/2);
      this._refMesh.position.sub(mid);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  PERSISTENCE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Serializza lo stato (solo flag e parametri; la geometria è riferimento
   * esterno, non serializzata qui).
   */
  toJSON() {
    return {
      smoothIterations: this._smoothIterations,
      smoothFactor:     this._smoothFactor,
      refOpacity:       this._refOpacity,
      refVisible:       this._refVisible,
    };
  }

  fromJSON(data) {
    if (!data) return;
    this._smoothIterations = data.smoothIterations ?? this._smoothIterations;
    this._smoothFactor     = data.smoothFactor     ?? this._smoothFactor;
    this._refOpacity       = data.refOpacity       ?? this._refOpacity;
    if (data.refVisible !== undefined) this._refVisible = data.refVisible;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  _cameraWorldZ() {
    const dir = new THREE.Vector3(0, 0, -1);
    if (this.camera?.quaternion instanceof THREE.Quaternion) {
      dir.applyQuaternion(this.camera.quaternion);
    }
    return dir;
  }

  _defaultVertexPositions(voxel) {
    // Minimal fallback for when voxelEngine doesn't expose _getVertexWorldPositions
    const VS  = this.voxelEngine.voxelSize || 1.0;
    const sc  = voxel.scale || [1,1,1];
    const hx  = (sc[0]||1)*0.5*VS, hy=(sc[1]||1)*0.5*VS, hz=(sc[2]||1)*0.5*VS;
    const cx  = voxel.x + 0.5, cy = voxel.y + 0.5, cz = voxel.z + 0.5;
    return [
      new THREE.Vector3(cx-hx,cy-hy,cz-hz),
      new THREE.Vector3(cx+hx,cy-hy,cz-hz),
      new THREE.Vector3(cx-hx,cy+hy,cz-hz),
      new THREE.Vector3(cx+hx,cy+hy,cz-hz),
      new THREE.Vector3(cx-hx,cy-hy,cz+hz),
      new THREE.Vector3(cx+hx,cy-hy,cz+hz),
      new THREE.Vector3(cx-hx,cy+hy,cz+hz),
      new THREE.Vector3(cx+hx,cy+hy,cz+hz),
    ];
  }

  _bruteForceProject(worldPoint, direction) {
    if (!this._refGeometry?.attributes?.position) return worldPoint.clone();
    const posAttr = this._refGeometry.attributes.position;
    if (!posAttr) return worldPoint.clone();

    const idx = this._refGeometry.index;
    let bestPt   = worldPoint.clone();
    let bestDist = Infinity;

    const step = DEFAULT_SAMPLE_DIST;
    const ray  = new THREE.Raycaster(worldPoint.clone(), direction.clone().normalize());
    ray.far = 50;

    for (let f = 0; f < (idx ? idx.count : posAttr.count); f += 3) {
      const i0 = idx ? idx.getX(f) : f;
      const i1 = idx ? idx.getX(f+1) : f+1;
      const i2 = idx ? idx.getX(f+2) : f+2;

      const v0 = new THREE.Vector3(posAttr.getX(i0), posAttr.getY(i0), posAttr.getZ(i0));
      const v1 = new THREE.Vector3(posAttr.getX(i1), posAttr.getY(i1), posAttr.getZ(i1));
      const v2 = new THREE.Vector3(posAttr.getX(i2), posAttr.getY(i2), posAttr.getZ(i2));

      // Test triangle intersection
      const hit = this._rayTriIntersect(ray, v0, v1, v2);
      if (hit) {
        const d = hit.distanceTo(worldPoint);
        if (d < bestDist) { bestDist = d; bestPt = hit; }
      }
    }
    return bestPt;
  }

  /**
   * Ray-triangle intersection (Möller–Trumbore), returns hit point or null.
   */
  _rayTriIntersect(ray, v0, v1, v2) {
    const EPS = 1e-8;
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const h = new THREE.Vector3().crossVectors(ray.direction, edge2);
    const a = edge1.dot(h);
    if (Math.abs(a) < EPS) return null;

    const f = 1.0 / a;
    const s = new THREE.Vector3().subVectors(ray.origin, v0);
    const u = f * s.dot(h);
    if (u < 0.0 || u > 1.0) return null;

    const q = new THREE.Vector3().crossVectors(s, edge1);
    const v = f * ray.direction.dot(q);
    if (v < 0.0 || u + v > 1.0) return null;

    const t = f * edge2.dot(q);
    if (t < EPS) return null;    // behind ray origin
    const pt = ray.origin.clone().addScaledVector(ray.direction, t);
    return pt;
  }
}

export default MeshDeformer;
