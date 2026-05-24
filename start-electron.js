const electronPath = require('electron');
console.log('Electron path:', electronPath);

const { spawn } = require('child_process');
const electron = spawn(electronPath, ['.'], { stdio: 'inherit' });
electron.on('close', (code) => console.log('Electron exited with code:', code));