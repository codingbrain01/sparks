interface Window {
  electronAPI?: {
    platform: 'win32' | 'darwin' | 'linux' | string
    isElectron: true
    closeApp: () => void
  }
}
