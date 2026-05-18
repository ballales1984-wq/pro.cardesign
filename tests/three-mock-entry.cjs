// ═══════════════════════════════════════════════════════════════════════════════
// three-mock-entry.cjs
// Risolve 'three' → tests/three-mock.js PRIMA che Node risolva da node_modules.
// Deve essere caricato con --require o require() prima di qualsiasi import ESM.
// ═══════════════════════════════════════════════════════════════════════════════
const path = require('path');
const Module = require('module');
const { pathToFileURL } = require('url');

const THREE_MOCK_ESM = path.resolve(__dirname, 'three-mock.js');
const THREE_MOCK_URL  = pathToFileURL(THREE_MOCK_ESM).href;

// Pre-carica il mock ESM nella cache di Node
import(THREE_MOCK_URL).then(mod => {
  Module._cache[THREE_MOCK_URL] = {
    id: THREE_MOCK_URL,
    filename: THREE_MOCK_ESM,
    loaded: true,
    exports: mod,
  };
}).catch(err => {
  console.error('[three-mock-entry] preload failed:', err.message);
});

// Intercetta TUTTE le richieste di 'three' PRIMA che Node risolva da node_modules
const origResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request === 'three') return THREE_MOCK_ESM;  // restituisce percorso ESM diretto
  return origResolve.call(this, request, parent, ...rest);
};
