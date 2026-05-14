// Startup script for the application
const { spawn } = require('child_process');
const path = require('path');

// Kill any existing processes on port 5175
const { exec } = require('child_process');
exec('taskkill /f /im node.exe >nul 2>&1', (error, stdout, stderr) => {
  if (error) {
    console.log('Warning: Could not kill existing node processes');
  }
});

// Start Vite dev server on port 5175
console.log('Starting Vite dev server...');
const viteProcess = exec('npx vite --port 5175 --strictPort');

viteProcess.stdout.on('data', (data) => {
  process.stdout.write(`Vite: ${data}`);
});

viteProcess.stderr.on('data', (data) => {
  process.stderr.write(`Vite stderr: ${data}`);
});

// Wait for Vite to start, then launch Electron
setTimeout(() => {
  console.log('Launching Electron...');
  
  // Get the path to electron executable
  const electronPath = require('electron');
  
  // Spawn Electron with our application
  const electron = spawn(electronPath, ['.']);
  
  electron.stdout.on('data', (data) => {
    process.stdout.write(`Electron: ${data}`);
  });
  
  electron.stderr.on('data', (data) => {
    process.stderr.write(`Electron stderr: ${data}`);
  });
  
  electron.on('close', (code) => {
    console.log(`Electron process exited with code ${code}`);
    viteProcess.kill();
    process.exit(code);
  });
  
  // Handle Electron process errors
  electron.on('error', (err) => {
    console.error('Failed to start Electron:', err);
    viteProcess.kill();
    process.exit(1);
  });
}, 3000); // Wait 3 seconds for Vite to start

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  viteProcess.kill();
  process.exit(0);
});

process.on('exit', (code) => {
  console.log(`About to exit with code: ${code}`);
});