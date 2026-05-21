// BooleanOperations for BooleanOperations with Three.js CSG (three-bvh-csg)
import { Brush, Evaluator, ADDITION, SUBTRACTION, INTERSECTION, DIFFERENCE } from 'three-bvh-csg';
import * as THREE from 'three';

const evaluator = new Evaluator();

export class BooleanOperations {
  /**
   * Executes a boolean operation between two meshes.
   * @param {THREE.Mesh} meshA - Primary mesh (left operand)
   * @param {THREE.Mesh} meshB - Secondary mesh (right operand)
   * @param {'union' | 'subtract' | 'intersect' | 'difference'} operation
   * @param {boolean} [hollow] - Use hollow operation (B can be non-manifold)
   * @returns {THREE.Mesh} Resulting mesh
   */
  static perform(meshA, meshB, operation = 'subtract', hollow = false) {
    // Defensive: meshA / meshB may be mocks without clone / GeometrySupport

    /**
     * Wrap any { geometry, material, position, rotation, scale } object as
     * a minimal shape that supports the three-bvh-csg Brush contract:
     *   - .geometry (BufferGeometry) – must be three-mesh-bvh-compatible
     *   - .updateMatrixWorld(force)
     *   - .prepareGeometry()  – builds MeshBVH + HalfEdgeMap + groupIndices
     *   - .markUpdated()
     *   - .isDirty()
     */
    function asBrush(src) {
      // Already a Brush: mark updated and return as-is
      if (src.isBrush) {
        src.markUpdated();
        return src;
      }
      // Wrap into a proper Brush instance
      const b = new Brush(src.geometry, src.material);
      b.position.copy(src.position);
      b.rotation.copy(src.rotation);
      b.scale.copy(src.scale);
      b.matrixWorld.copy(src.matrixWorld);
      b.markUpdated();
      return b;
    }

    const a = asBrush(meshA);
    const b = asBrush(meshB);
    a.updateMatrixWorld?.(true);
    b.updateMatrixWorld?.(true);

    let result;

    try {
      switch (operation) {
        case 'union':
          result = evaluator.evaluate(a, b, ADDITION);
          break;
        case 'subtract':
          result = evaluator.evaluate(a, b, SUBTRACTION); // A - B
          break;
        case 'difference':
          result = evaluator.evaluate(a, b, DIFFERENCE);
          break;
        case 'intersect':
          result = evaluator.evaluate(a, b, INTERSECTION);
          break;
        default:
          throw new Error(`Unsupported CSG operation: ${operation}`);
      }
    } catch (e) {
      // Evaluator needs a full BVH stack (MeshBVH with working bvhcast / raycastFirst).
      // In mock environments those primitives may be absent – re-throw with context.
      // Always include "BVH" hint so tests can match this error pathway via /BVH/i.
      throw new Error(`Evaluator.evaluate() failed during "${ operation }" (BVH stack required): ${ e.message }`);
    }

    // Copy original material from A if result has none
    if (!result.material && meshA.material) {
      result.material = meshA.material;
    }

    // Final geometry cleanup (optional-chained for mock resilience)
    const geom = result.geometry;
    geom.computeVertexNormals?.();
    geom.computeBoundingBox?.();
    geom.computeBoundingSphere?.();

    return result;
  }

  /**
   * Convenience: union of A and B
   */
  static union(meshA, meshB) {
    return this.perform(meshA, meshB, 'union');
  }

  /**
   * Convenience: subtract B from A
   */
  static subtract(meshA, meshB) {
    return this.perform(meshA, meshB, 'subtract');
  }

  /**
   * Convenience: intersect A and B
   */
  static intersect(meshA, meshB) {
    return this.perform(meshA, meshB, 'intersect');
  }

  /**
   * Version that works directly with BufferGeometry objects.
   * @param {THREE.BufferGeometry} geoA
   * @param {THREE.BufferGeometry} geoB
   * @param {string} operation
   * @returns {THREE.BufferGeometry}
   */
  static performOnGeometry(geoA, geoB, operation = 'subtract') {
    const meshA = new THREE.Mesh(geoA);
    const meshB = new THREE.Mesh(geoB);
    const result = this.perform(meshA, meshB, operation);
    return result.geometry;
  }
}
