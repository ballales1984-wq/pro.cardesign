/**
 * dev-start.js — Launches Vite and waits for it, then opens Electron.
 * Replaces the fragile shell-scripting in package.json.
 */
const { spawn } = require('child_process');
const http = require('http');

// Poll Vite until it responds with HTTP 200
function onReady(cb) {
  const tryConnect = () => {
    http.get('http://localhost:5176', (res) => {
      if (res.statusCode === 200) return cb();
      res.on('data', () => {}); // drain / consume
      setTimeout(tryConnect, 500);
    }).on('error', () => setTimeout(tryConnect, 500));
  };
  tryConnect();
}

// ── 1. Start Vite ──────────────────────────────────────────────────────────
console.log('  [dev] Starting Vite dev server on http://localhost:5176 ...');
const vite = spawn('npx', ['vite', '--port', '5176', '--strictPort'], {
  cwd: __dirname,
  env: { ...process.env, FORCE_COLOR: '1' },
  stdio: 'inherit',
  shell: true,
});

// ── 2. When Vite is up, start Electron ──────────────────────────────────────
onReady(() => {
  console.log('  [dev] Vite is ready — launching Electron ...');
  const p = require('path');
  const fs = require('fs');
  const electronCLI = p.join(__dirname, 'node_modules', 'electron', 'cli.js');
  console.log('  Electron CLI path:', electronCLI, 'exists:', fs.existsSync(electronCLI));
  // Run electron via node directly: node node_modules/electron/cli.js .
  const electron = spawn(process.execPath, [electronCLI, '.'], {
    cwd: __dirname,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: 'inherit',
    shell: true,
  });

  electron.on('error', (err) => {
    console.error('[dev] Failed to spawn Electron:', err.message);
    process.exit(1);
  });

  electron.on('exit', (code) => {
    console.log('[dev] Electron exited with code', code, '.');
    try { vite.kill('SIGTERM'); } catch (_) {}
    process.exit(code || 0);
  });
});

vite.on('error', (err) => {
  console.error('[dev] Failed to start Vite:', err.message);
  process.exit(1);
});

vite.on('exit', () => {
  console.log('[dev] Vite exited.');
  process.exit(0);
});
