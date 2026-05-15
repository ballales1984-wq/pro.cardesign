/**
 * VoxelCAD — Electron Main Process Entry
 *
 * Uses Electron's built-in global main-process APIs directly.
 * In the Electron main process, these are always available as
 * bare identifiers — no require('electron') needed.
 *
 * Works with Electron v28+ regardless of js2c binding state.
 */
'use strict';

const path = require('path');

/**
 * Verify Electron globals are present.  Runs once at startup.
 * In a correctly-running Electron process these are always set.
 */
function checkGlobals() {
  const missing = [];

  // Best-effort detection — some bundlers don't define these as real globals
  if (typeof app === 'undefined' && !APP_AVAILABLE) missing.push('app');
  if (typeof BrowserWindow === 'undefined' && !BW_AVAILABLE) missing.push('BrowserWindow');

  if (missing.length > 0) {
    console.error('[main.js] ELECTRON GLOBALS MISSING:', missing.join(', '));
    console.error('[main.js]');
    console.error('[main.js] If you are seeing this inside Electron, this is a bug.');
    console.error('[main.js] Otherwise run inside Electron, not plain Node.js:');
    console.error('[main.js]   npx electron .');
    console.error('[main.js]   npm run dev   ← works without Electron (browser fallback)');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Window factory
// ---------------------------------------------------------------------------
let mainWindow;

function createWindow() {
  const BW = typeof BrowserWindow !== 'undefined' ? BrowserWindow : global.BrowserWindow;
  mainWindow = new BW({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'VoxelCAD v0.1.0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  // Vite dev server (port 5176) is the primary target.
  // Falls back to the production build if Vite is not running.
  mainWindow.loadURL('http://localhost:5176').catch(() => {
    if (typeof mainWindow !== 'undefined') mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html').replace(/\\/g, '/'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle  (guarded so it also works when loaded in a browser context)
// ---------------------------------------------------------------------------

// `app` is injected by Electron's node_init via js2c.
// It is NOT available when running under plain Node.js / Vite.
const APP_AVAILABLE = typeof app !== 'undefined';
const BW_AVAILABLE   = typeof BrowserWindow !== 'undefined';

if (!APP_AVAILABLE || !BW_AVAILABLE) {
  checkGlobals();
  /* Run under plain Node/Vite — skip lifecycle, just log for debugging */
  console.log('[main.js] Running under plain Node (not Electron).');
  console.log('[main.js] app:', typeof app, '| BrowserWindow:', typeof BrowserWindow);
} else {
  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
