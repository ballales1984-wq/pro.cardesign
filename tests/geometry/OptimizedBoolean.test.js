// tests/geometry/OptimizedBoolean.test.js
import * as THREE from 'three';
import { GeometryDecimator } from '../../src/geometry/Decimator.js';

// Mock the prepareForCSG function from the module
jest.mock('../../src/geometry/OptimizedBoolean.js', () => {
  const actual = jest.requireActual('../../src/geometry/OptimizedBoolean.js');
  return {
    ...actual,
    prepareForCSG: (mesh) => {
      // Just return the mesh as is for testing
      return mesh;
    }
  };
});

// We need to mock the GeometryDecimator as well to control its behavior
jest.mock('../../src/geometry/Decimator.js');

import { OptimizedBoolean } from '../../src/geometry/OptimizedBoolean.js';

describe('OptimizedBoolean', () => {
  let optimizedBoolean;
  let mockGeometry;
  let mockParams;

  beforeEach(() => {
    optimizedBoolean = new OptimizedBoolean();
    mockGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
    mockGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    mockParams = {
      position: new THREE.Vector3(1, 0, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1)
    };
  });

  test('should prepare a tool mesh and cache it', () => {
    const result = optimizedBoolean.getPreparedTool(mockGeometry, mockParams);
    expect(result).toBeInstanceOf(THREE.Mesh);
    expect(result.geometry).toBeDefined();
    // Check that the cache was set
    expect(optimizedBoolean.brushCache.size).toBe(1);
  });

  test('should return a cached tool on subsequent calls', () => {
    // First call
    optimizedBoolean.getPreparedTool(mockGeometry, mockParams);
    const cacheSizeFirst = optimizedBoolean.brushCache.size;
    // Second call with same geometry
    const result2 = optimizedBoolean.getPreparedTool(mockGeometry, mockParams);
    expect(optimizedBoolean.brushCache.size).toBe(cacheSizeFirst);
    // The result should be a mesh (cloned from cached)
    expect(result2).toBeInstanceOf(THREE.Mesh);
  });

  test('should apply transformations from params', () => {
    const result = optimizedBoolean.getPreparedTool(mockGeometry, mockParams);
    expect(result.position).toEqual(mockParams.position);
    expect(result.rotation).toEqual(mockParams.rotation);
    expect(result.scale).toEqual(mockParams.scale);
  });

  test('should call decimator with correct parameters for CSG', () => {
    // We have mocked the GeometryDecimator, so we can check if its methods were called
    const decimateForCSGMock = jest.fn();
    // Replace the decimator's method with our mock
    optimizedBoolean.decimator.decimateForCSG = decimateForCSGMock;
    optimizedBoolean.getPreparedTool(mockGeometry, mockParams);
    expect(decimateForCSGMock).toHaveBeenCalledWith(mockGeometry, 'medium');
  });
});