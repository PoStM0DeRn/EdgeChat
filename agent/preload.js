const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('agent', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  connect: (opts) => ipcRenderer.invoke('connect-agent', opts),
  disconnect: () => ipcRenderer.invoke('disconnect-agent'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  checkLMStudio: () => ipcRenderer.invoke('check-lmstudio'),
  onStatus: (callback) => {
    ipcRenderer.on('status', (_, status) => callback(status))
  },
})
