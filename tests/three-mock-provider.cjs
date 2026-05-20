// ══════════════════════════════════════════════════════════════════════════════
// three-mock-provider.cjs  —  Intercepts THREE for Node ESM + CJS
//
//  Uses Module.register (Node 20+, stable public API) to intercept
//  `import * as THREE from 'three'` at the ESM resolver level — before
//  Node ever reaches node_modules.  CJS require('three') is still handled
//  by the Module._resolveFilename fallback.
// ══════════════════════════════════════════════════════════════════════════════
'use strict';

const path         = require('path');
const Module       = require('module');
const { pathToFileURL } = require('url');

const MOCK_DIR   = __dirname;
const MOCK_ESM   = path.resolve(MOCK_DIR, 'three-mock.js');
const MOCK_URL   = pathToFileURL(MOCK_ESM).href;

// ── 1. ESM INTERCEPTION ────────────────────────────────────────────────────────
// Module.register runs BEFORE the file-system resolver.
// Every ESM  `import 'three'` / `import * as THREE from 'three'`  is resolved
// to the mock URL and returns the named-export namespace defined in three-mock.js.
if (typeof Module.register === 'function') {
  Module.register('three', MOCK_URL);
}

// ── 2. CJS INTERCEPTION ────────────────────────────────────────────────────────
// Module.register handles ESM; _resolveFilename handles CJS require('three').
const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request === 'three')             return MOCK_ESM;
  return origResolveFilename.call(this, request, parent, ...rest);
};

// ── 3. NODE_PATH — sandbox tests/ at the front of search paths ─────────────────
Module._initPaths = (() => {
  const origInit = Module._initPaths;
  return function () {
    const p = process.env.NODE_PATH || '';
    process.env.NODE_PATH = [MOCK_DIR, p].filter(Boolean).join(path.delimiter || ';');
    origInit.call(this);
  };
})();
