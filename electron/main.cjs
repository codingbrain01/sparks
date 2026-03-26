'use strict'

const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('path')

// Detect dev mode — true when NOT packaged (i.e. running via `electron .`)
const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    // In dev: regular resizable window so DevTools are usable
    // In production: true kiosk (fullscreen, no chrome, blocks OS shortcuts)
    width: 1280,
    height: 800,
    kiosk: !isDev,
    fullscreen: !isDev,
    frame: isDev,
    resizable: isDev,
    autoHideMenuBar: true,

    // Touch / high-DPI support
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      // Enable touch events for touch-screen kiosk hardware
      additionalArguments: ['--touch-events=enabled'],
    },
  })

  // Strip the menu bar entirely
  Menu.setApplicationMenu(null)

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Block navigation away from the app
  win.webContents.on('will-navigate', (event, url) => {
    const appUrl = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../dist/')}`
    if (!url.startsWith(appUrl)) {
      event.preventDefault()
    }
  })

  // Open external links in the system browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Disable right-click context menu in production
  if (!isDev) {
    win.webContents.on('context-menu', (e) => e.preventDefault())
  }

  // Block reload shortcuts in production (Ctrl+R, F5, Ctrl+Shift+R)
  // A stray reload on file:// would break BrowserRouter routing
  if (!isDev) {
    win.webContents.on('before-input-event', (event, input) => {
      const isReload =
        (input.key === 'r' && input.control) ||
        (input.key === 'R' && input.control) ||
        input.key === 'F5'
      if (isReload) event.preventDefault()
    })
  }
}

app.whenReady().then(() => {
  // Enable touch events on Linux/Windows touch-screen kiosks
  app.commandLine.appendSwitch('touch-events', 'enabled')

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
