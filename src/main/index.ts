import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { startScraper, stopScraper } from './scraper'
import { createTray, updateTrayTooltip } from './tray'
import { registerIpcHandlers } from './ipc-handlers'
import { initSettings, getSettings } from './settings'
import { showAlertPopups } from './popup'

let mainWindow: BrowserWindow | null = null
let knownAlertIds = new Set<number>()
let initialLoadDone = false

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    show: false,
    title: 'Desktop EAS',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Close-to-tray behavior
  mainWindow.on('close', (e) => {
    if (!(app as any).isQuitting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  // Load renderer
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  initSettings()
  registerIpcHandlers()

  const win = createWindow()

  createTray(win)

  startScraper((alerts) => {
    updateTrayTooltip(alerts.length)
    if (win && !win.isDestroyed()) {
      win.webContents.send('alerts:update', alerts)
    }

    // First load — seed known IDs without alerting
    if (!initialLoadDone) {
      initialLoadDone = true
      knownAlertIds = new Set(alerts.map((a: any) => a.id))
      return
    }

    // Show popup for genuinely new alerts only
    const settings = getSettings()
    if (settings.alertsEnabled) {
      const newAlerts = alerts.filter((a: any) => !knownAlertIds.has(a.id))
      if (newAlerts.length > 0) {
        showAlertPopups(newAlerts)
      }
    }

    // Accumulate — never remove IDs so a 0-alert scrape doesn't reset state
    for (const a of alerts) {
      knownAlertIds.add(a.id)
    }
  })
})

app.on('before-quit', () => {
  ;(app as any).isQuitting = true
  stopScraper()
})

app.on('window-all-closed', () => {
  // On Windows, don't quit when all windows are closed (tray keeps running)
})
