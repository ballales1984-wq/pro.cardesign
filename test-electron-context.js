// test-electron-context.js
console.log('Starting test...');
try {
  const electron = require('electron');
  console.log('Type of require(\'electron\'):', typeof electron);
  console.log('Value:', electron);
  
  if (typeof electron === 'string') {
    console.log('Got path, trying to spawn...');
    const { spawn } = require('child_process');
    const child = spawn(electron, ['.', '--inspect-brk']);
    child.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });
    child.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
    child.on('close', (code) => {
      console.log(`Child process exited with code ${code}`);
    });
  } else if (electron && typeof electron === 'object') {
    console.log('Got electron object');
    console.log('app:', electron.app);
    console.log('BrowserWindow:', electron.BrowserWindow);
  }
} catch (error) {
  console.error('Error:', error.message);
}