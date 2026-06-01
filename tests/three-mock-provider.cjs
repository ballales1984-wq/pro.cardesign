// three-mock-provider.cjs — Mock THREE.js modules for test environment
// This file is loaded before other modules to provide mocked versions of THREE.js components

// Store the mock for ESM access via global
global.SimplifyModifierMock = class {
  constructor() {}
  modify(geometry, targetCount) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) {
      return geometry;
    }
    const simplified = geometry.clone();
    if (simplified && simplified.attributes && simplified.attributes.position) {
      return simplified;
    }
    return geometry;
  }
};

// Create a proxy that intercepts SimplifyModifier imports
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id.includes('SimplifyModifier')) {
    return {
      SimplifyModifier: global.SimplifyModifierMock
    };
  }
  if (id.includes('onnxruntime-web')) {
    return {
      InferenceSession: { create: async () => null },
      env: { wasm: { wasmBinary: null } }
    };
  }
  return originalRequire.apply(this, arguments);
};

// Export empty to satisfy require - also makes SimplifyModifier available as global
module.exports = {};

// Suppress multiple THREE.js warning in test environment
const originalWarn = console.warn;
console.warn = function(...args) {
  if (args[0] && args[0].includes && args[0].includes('Multiple instances of Three.js')) {
    return; // Suppress this warning
  }
  originalWarn.apply(console, args);
};