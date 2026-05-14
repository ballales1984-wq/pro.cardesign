const electron = require('electron');
console.log('Type of electron:', typeof electron);
console.log('Electron value:', electron);
if (electron && typeof electron === 'object') {
  console.log('electron.app:', electron.app);
  console.log('electron.BrowserWindow:', electron.BrowserWindow);
}