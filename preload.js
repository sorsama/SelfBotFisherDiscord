const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  windowControls: {
    minimize: () => ipcRenderer.invoke('minimize-window'),
    maximize: () => ipcRenderer.invoke('maximize-window'),
    close: () => ipcRenderer.invoke('close-window'),
    quit: () => ipcRenderer.invoke('quit-app')
  },
  
  // Config methods
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // Bot control methods
  startBot: (config) => ipcRenderer.invoke('start-bot', config),
  stopBot: () => ipcRenderer.invoke('stop-bot'),
  toggleFishing: () => ipcRenderer.invoke('toggle-fishing'),
  
  // Event listeners
  onLogMessage: (callback) => {
    ipcRenderer.on('log-message', (event, value) => callback(value));
  },
  onStatusUpdate: (callback) => {
    ipcRenderer.on('status-update', (event, value) => callback(value));
  },
  onEmbedReceived: (callback) => {
    ipcRenderer.on('embed-message', (event, value) => callback(value));
  }
});

console.log('Preload script loaded successfully!');