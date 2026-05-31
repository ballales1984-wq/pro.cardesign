// three-mock-provider.cjs — Mock THREE.js modules for test environment
// This file is loaded before other modules to provide mocked versions of THREE.js components

// Create a proxy that intercepts SimplifyModifier imports
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id.includes('SimplifyModifier')) {
    // Return a mock SimplifyModifier that works with mock geometries
    return {
      SimplifyModifier: class {
        constructor() {}
        modify(geometry, targetCount) {
          // Return the geometry unchanged if it's a mock (no real vertex data)
          if (!geometry || !geometry.attributes || !geometry.attributes.position) {
            return geometry;
          }
          // For mock geometries with limited vertices, just clone and return
          const simplified = geometry.clone();
          if (simplified && simplified.attributes && simplified.attributes.position) {
            return simplified;
          }
          return geometry;
        }
      }
    };
  }
  if (id.includes('onnxruntime-web')) {
    // Return mock for onnxruntime-web
    return {
      InferenceSession: { create: async () => null },
      env: { wasm: { wasmBinary: null } }
    };
  }
  return originalRequire.apply(this, arguments);
};

// Export empty to satisfy require
module.exports = {};