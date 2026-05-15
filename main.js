/**
 * VoxelCAD — Electron Main Process Entry
 *
 * Works with Electron v28 (Node 18) and newer.
 *
 * Known issue on some Windows installs:
 *   require('electron') in the main process can return a string path
 *   instead of the Electron API when the js2c binding fails to initialise.
 *
 * Workarounds:
 *   1. Upgrade Electron: npm install electron@latest --save-dev
 *   2. Clean-reinstall: rmdir /s node_modules && npm install
 *   3. Run in browser (dev mode): http://localhost:5176
 */
'use strict';

const path = require('path');

// ---------------------------------------------------------------------------
// Unsafe fallback for environments where the js2c binding injection fails.
// In a well-configured Electron environment require('electron') returns the
// API object directly; in broken installs it falls through to the npm
// package and returns the exe path as a string.
// ---------------------------------------------------------------------------
function loadElectronAPI() {
  let electron;

  try {
    electron = require('electron');
    if (electron && typeof electron === 'object') {
      // js2c injected the API — check for a known key
      if (electron.app !== undefined || 'app' in electron) {
        return electron;
      }
    }
    // {}.toString.call(electron) === '[object String]' → npm package returned a path
    // {}.toString.call(electron) === '[object Function]' → could be getElectronPath()
    console.error('[main] require("electron") did not return the API object.');
    console.error('[main] got:', typeof electron, electron);
  } catch (err) {
    console.error('[main] require("electron") threw:', err.message);
  }

  // --- Last-resort attempt: read from getElectronPath() directly and regebuild ---
  // The npm package's index.js returns the exe path; Electron's built-in
  // node_init.js uses `global.require()` to load the actual API from dist/
  // if js2c injected correctly.  We cannot call that ourselves, so print
  // diagnostics and exit cleanly instead of crashing with a cryptic error.
  console.error('');
  console.error('  FATAL: Electron main-process API is unavailable.');
  console.error('  This is usually caused by:');
  console.error('     npm install electron@latest --save-dev');
  console.error('     rmdir /s node_modules && npm install');
  console.error('  For browser-based development run: npm run dev (Vite only)');
  console.error('');
  process.exit(1);
}

const electronAPI = loadElectronAPI();
const { app, BrowserWindow } = electronAPI;

// ---------------------------------------------------------------------------
// Window factory
// ---------------------------------------------------------------------------
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
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

  // Vite dev server (port 5176) or built production HTML
  const devURL = 'http://localhost:5176';
  const prodURL = path.join(__dirname, 'dist', 'index.html');

  // Try Vite first; fall back to production build
  mainWindow.loadURL(devURL).catch(() => mainWindow.loadFile(prodURL));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
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
