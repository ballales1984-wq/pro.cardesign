/**
 * VoxelCAD — Electron Main Process Entry
 * 
 * Electron 27+ runs this script in the main process context where
 * global variables (app, BrowserWindow, etc.) are injected by Electron.
 */

'use strict';

const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
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
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle - Electron 27+ injects these globals
app.whenReady().then(() => {
  console.log('[main.js] main process ready');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});