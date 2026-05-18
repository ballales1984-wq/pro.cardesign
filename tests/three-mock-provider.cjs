// ══════════════════════════════════════════════════════════════════════════════
// three-mock-provider.cjs  —  Provider mock THREE per Node ESM + CJS
// Registra 'three' direttamente nella cache di sistema PRIMA che ESM lo risolva.
// ══════════════════════════════════════════════════════════════════════════════
const path   = require('path');
const Module = require('module');
const { pathToFileURL } = require('url');

const MOCK_DIR = __dirname;
const MOCK_ESM = path.resolve(MOCK_DIR, 'three-mock.js');
const MOCK_URL = pathToFileURL(MOCK_ESM).href;

// ── 1. PATCH SYNCHRONISATION: registra i percorsi mock PRIMA di qualsiasi import() ──
// Intercetta require('three') (CJS)
const origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request === 'three')          return MOCK_ESM;
  if (request === 'three/package.json') return path.join(MOCK_DIR, 'three-mock-package.json');
  return origResolveFilename.call(this, request, parent, ...rest);
};

// Aggiungi tests/ a tutte le ricerche di moduli Node (effettivo per CJS e sintattico per ESM)
const origNodeModPaths = Module._nodeModulePaths;
Module._nodeModulePaths = function(from) {
  const paths = origNodeModPaths.call(this, from);
  if (!paths.includes(MOCK_DIR)) paths.unshift(MOCK_DIR);
  return paths;
};

Module._initPaths = (() => {
  const origInit = Module._initPaths;
  return function() {
    const p = process.env.NODE_PATH || '';
    process.env.NODE_PATH = [MOCK_DIR, p].filter(Boolean).join(path.delimiter || ';');
    origInit.call(this);
  };
})();

// Pre-cache i file che Node CJS risolverà per 'three'
const filenames = [
  MOCK_ESM,
  path.join(MOCK_DIR, 'three.js'),
  path.join(MOCK_DIR, 'three.mjs'),
];
for (const fn of filenames) {
  // Placeholder: verrà sovrascritto una volta caricato ESM, ma evita null reference fino a quel momento
  if (!Module._cache[fn]) {
    Module._cache[fn] = {
      id: fn,
      filename: fn,
      loaded: false,
      _placeholder: true,
      exports: {},
    };
  }
}

// ── 2. CARICA IL MOCK ESM: popola la cache definitiva ──────────────────────────
import(MOCK_URL).then(esmMod => {
  Module._cache[MOCK_URL] = {
    id: MOCK_URL, filename: MOCK_ESM, loaded: true, exports: esmMod,
  };

  // Aggiorna tutte le entries CJS placeholder con il modulo ESM definitivo
  for (const fn of filenames) {
    if (Module._cache[fn] && Module._cache[fn]._placeholder) {
      Module._cache[fn].loaded = true;
      Module._cache[fn].exports = esmMod;
      delete Module._cache[fn]._placeholder;
    }
  }
}).catch(err => {
  console.error('[three-mock-provider] WARN:', err.message);
});
