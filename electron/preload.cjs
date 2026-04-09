'use strict'

const { contextBridge, ipcRenderer } = require('electron')

// Expose a safe, minimal API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,           // 'win32' | 'darwin' | 'linux'
  isElectron: true,
  closeApp: () => ipcRenderer.send('close-app'),
})
