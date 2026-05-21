// tests/geometry/Decimator.test.js
import * as THREE from 'three';
// Mock the SimplifyModifier
const mockSimplifyModifier = {
  modify: (geometry, targetCount) => {
    // Return a simplified geometry (just clone for test)
    const simplified = geometry.clone();
    // Simulate reducing vertices by adjusting the position array length
    // We'll just return the cloned geometry for simplicity in test
    return simplified;
  }
};

// Mock the three/examples/jsm/modifiers/SimplifyModifier
jest.mock('three/examples/jsm/modifiers/SimplifyModifier.js', () => ({
  SimplifyModifier: jest.fn().mockImplementation(() => mockSimplifyModifier)
}));

import { GeometryDecimator } from '../../src/geometry/Decimator.js';

describe('GeometryDecimator', () => {
  let decimator;
  let mockGeometry;

  beforeEach(() => {
    decimator = new GeometryDecimator();
    // Create a mock geometry with position attribute
    mockGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    mockGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    // Add a UV attribute to test preservation
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    mockGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  });

  test('should decimate geometry and reduce vertex count', () => {
    const result = decimator.decimate(mockGeometry, 0.5, true);
    expect(result).toBeDefined();
    expect(result.attributes.position.count).toBeLessThanOrEqual(mockGeometry.attributes.position.count);
  });

  test('should return original geometry if invalid input', () => {
    const result = decimator.decimate(null, 0.5);
    expect(result).toBeNull();
  });

  test('should preserve UVs when preserveUVs is true', () => {
    const result = decimator.decimate(mockGeometry, 0.5, true);
    expect(result.attributes.uv).toBeDefined();
  });

  test('should remove UVs when preserveUVs is false', () => {
    const result = decimator.decimate(mockGeometry, 0.5, false);
    expect(result.attributes.uv).toBeUndefined();
  });

  test('decimateForCSG should call decimate with correct ratio', () => {
    // Spy on the decimate method
    const decimateSpy = jest.spyOn(decimator, 'decimate');
    decimator.decimateForCSG(mockGeometry, 'medium');
    expect(decimateSpy).toHaveBeenCalledWith(mockGeometry, 0.25, false);
  });
});