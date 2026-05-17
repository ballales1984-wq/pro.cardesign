/**
 * VoxelCAD — Electron Main Process Entry (v27+)
 *
 * In Electron 27+, bare `require('electron')` is intercepted at C++ level
 * and returns the exe path string.  The canonical Electron APIs (app,
 * BrowserWindow, …) are injected as globals by the C++ bootstrap.
 *
 * Guard every Electron call with typeof-checks so the file is safe to
 * `require()` from the renderer / tests as well.
 */

'use strict';

const path = require('path');

let mainWindow;

function createWindow() {
  // Guard: may be called from a non-Electron context during tests
  if (typeof BrowserWindow === 'undefined') return;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'VoxelCAD v0.1.0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Vite dev server (port 5176) is the primary target.
  // Fall back to the production build if Vite is not running.
  mainWindow.loadURL('http://localhost:5176').catch(() => {
    if (mainWindow) {
      mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
if (typeof app !== 'undefined') {
  app.whenReady().then(() => {
    console.log('[main.js] main process ready');
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
} else {
  // Running under plain Node/Vite — log for debugging, no-op
  console.log('[main.js] No Electron app global — running under plain Node (ok for renderer)');
}
