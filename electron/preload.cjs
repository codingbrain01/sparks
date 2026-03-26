'use strict'

const { contextBridge } = require('electron')

// Expose a safe, minimal API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,           // 'win32' | 'darwin' | 'linux'
  isElectron: true,
})
