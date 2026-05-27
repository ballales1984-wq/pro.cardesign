/**
 * VoxelCAD - Electron Main Process Entry
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

// Prima di qualsiasi altra init Electron (GPU / WebGL su Windows)
app.disableHardwareAcceleration();

const DEV_PORTS = [5176, 5177];
const DIST_HTML = path.join(__dirname, 'dist', 'index.html');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

function probeDevServerOnce(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { family: 4 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function probeDevServer(url, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    if (await probeDevServerOnce(url)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function findDevUrl() {
  for (const port of DEV_PORTS) {
    const url = `http://127.0.0.1:${port}/index.html`;
    if (await probeDevServer(url)) return url;
  }
  return null;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'VoxelCAD v0.1.0',
    backgroundColor: '#0f1923',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

   mainWindow.once('ready-to-show', () => mainWindow.show());

   const loadDev = !app.isPackaged;

   // Set Content Security Policy
   const ses = mainWindow.webContents.session;
   ses.webRequest.onHeadersReceived((details, callback) => {
     callback({
       responseHeaders: {
         ...details.responseHeaders,
         'Content-Security-Policy': ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'"]
       }
     });
   });

   (async () => {
    try {
      if (loadDev) {
        const devUrl = await findDevUrl();
        if (devUrl) {
          console.log('[electron] dev ->', devUrl);
          await mainWindow.loadURL(devUrl);
          return;
        }
        console.warn('[electron] nessun server Vite su porte', DEV_PORTS.join(', '));
      }
      console.log('[electron] prod ->', DIST_HTML);
      await mainWindow.loadFile(DIST_HTML);
    } catch (err) {
      console.error('[electron] load failed, fallback dist:', err.message);
      await mainWindow.loadFile(DIST_HTML);
    }
  })();

  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
