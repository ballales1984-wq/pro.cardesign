// geometry/primitives — Parametric primitive factory
// Wraps THREE built-in geometry constructors so dimensions are passed as [W, H, D] arrays
// (mm — 1 Three.js unit = 1 mm)

import * as THREE from 'three';
import {
  createBox,
  createCylinder,
  createSphere,
  createCone,
  createPyramid,
  createTorus,
} from './primitives/index.js';

// ── Public helper ─────────────────────────────────────────────────────────────

/**
 * Factory: returns a new THREE.Mesh for the requested primitive.
 * @param {'box'|'cylinder'|'sphere'|'cone'|'pyramid'|'torus'} type
 * @param {Object} params — parameters specific to each primitive
 * @returns {THREE.Mesh}
 */
export function createPrimitive(type, params = {}) {
  let geometry;

  switch (type) {
    case 'box':
    case 'cube': {
      const [w = 1, h = 1, d = 1] = params.size || [1, 1, 1];
      const segments = params.segments || 1;
      geometry = new THREE.BoxGeometry(w, h, d, segments, segments, segments);
      break;
    }

    case 'cylinder': {
      const {
        radiusTop = params.radius || 1,
        radiusBottom = params.radius || 1,
        height = 2,
        radialSegments = 24,
        heightSegments = 1,
        openEnded = false,
      } = params;
      geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded);
      break;
    }

    case 'sphere': {
      const {
        radius = 1,
        widthSegments = 16,
        heightSegments = 16,
      } = params;
      geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
      break;
    }

    case 'cone': {
      const {
        radius = 1,
        height = 2,
        radialSegments = 24,
      } = params;
      geometry = new THREE.ConeGeometry(radius, height, radialSegments);
      break;
    }

    case 'pyramid': {
      const {
        baseSize = 2,
        height: pyHeight = 2,
      } = params;
      // cylinder with 4 radial segments and topRadius = 0 = pyramid
      geometry = new THREE.CylinderGeometry(0, baseSize / 2, pyHeight, 4, 1);
      break;
    }

    case 'torus': {
      const {
        radius = 1,
        tube = 0.4,
        radialSegments = 16,
        tubularSegments = 48,
        arc = Math.PI * 2,
      } = params;
      geometry = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments, arc);
      break;
    }

    default:
      throw new Error(`Unknown primitive type: ${type}`);
  }

  return geometry;
}

export { createBox, createCylinder, createSphere, createCone, createPyramid, createTorus };
