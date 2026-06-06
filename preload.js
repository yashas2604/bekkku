const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('set-ignore-mouse-events', ignore, options);
  },
  dragWindow: (dx, dy) => {
    ipcRenderer.send('drag-window', dx, dy);
  },
  resizeWindow: (width, height) => {
    ipcRenderer.send('resize-window', width, height);
  },
  moveWindow: (x, y) => {
    ipcRenderer.send('move-window', x, y);
  },
  resetPosition: () => {
    ipcRenderer.send('reset-position');
  },
  onToggleSettings: (callback) => {
    ipcRenderer.on('toggle-settings', (_event, value) => callback(value));
  },
  onGlobalMouse: (callback) => {
    ipcRenderer.on('global-mouse', (_event, data) => callback(data));
  }
});
