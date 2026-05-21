/**
 * geometry/primitives/ — Parametric primitive generators
 *
 * Each function returns a BufferGeometry via globalThis.THREE.
 * THREE is set both in the real app and in the test mock harness.
 */

// ── Private ────────────────────────────────────────────────────────────────

function _getTHREE() {
  return (typeof globalThis !== 'undefined' && globalThis.THREE) || {};
}

function _stubGeo() {
  return {
    attributes: { position: { array: new Float32Array([]), count: 0 } },
    index: null,
    boundingSphere: null,
    boundingBox: null,
    computeVertexNormals: function(){},
    computeBoundingSphere: function(){},
    computeBoundingBox: function(){},
    dispose: function(){},
  };
}

// ── Public API ────────────────────────────────────────────────────────────

export function createCylinder(radiusTop, radiusBottom, height, radialSegments) {
  radialSegments = (radialSegments === undefined) ? 16 : radialSegments;
  var T = _getTHREE();
  if (!T || !T.CylinderGeometry) return _stubGeo();
  return new T.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
}

export function createSphere(radius, widthSegments, heightSegments) {
  widthSegments  = (widthSegments  === undefined) ? 16 : widthSegments;
  heightSegments = (heightSegments === undefined) ? 16 : heightSegments;
  var T = _getTHREE();
  if (!T || !T.SphereGeometry) return _stubGeo();
  return new T.SphereGeometry(radius, widthSegments, heightSegments);
}

export function createCone(radius, height, radialSegments) {
  radialSegments = (radialSegments === undefined) ? 24 : radialSegments;
  var T = _getTHREE();
  if (!T || !T.ConeGeometry) return _stubGeo();
  return new T.ConeGeometry(radius, height, radialSegments);
}

export function createPyramid(baseSize, height) {
  var T = _getTHREE();
  if (!T || !T.CylinderGeometry) return _stubGeo();
  return new T.CylinderGeometry(0, baseSize / 2, height, 4);
}

export function createTorus(radius, tube, radialSegments, tubularSegments) {
  radialSegments  = (radialSegments  === undefined) ? 16 : radialSegments;
  tubularSegments = (tubularSegments === undefined) ? 48 : tubularSegments;
  var T = _getTHREE();
  if (!T || !T.TorusGeometry) return _stubGeo();
  return new T.TorusGeometry(radius, tube, radialSegments, tubularSegments);
}
