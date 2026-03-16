import { BrowserWindow, screen, app, ipcMain } from 'electron'
import { join } from 'path'
import { getSettings } from './settings'

let popupWindow: BrowserWindow | null = null
let popupQueue: any[] = []
let isShowingPopup = false
let pendingAlertData: any = null
const QUEUE_DELAY_MS = 3000

function getPopupUrl(): string {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    // Dev: renderer URL is e.g. http://localhost:5173/
    const base = process.env['ELECTRON_RENDERER_URL'].replace(/\/$/, '')
    return `${base}/popup.html`
  }
  return join(__dirname, '../renderer/popup.html')
}

function createPopupWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize
  const popupW = 420
  const popupH = 480

  const win = new BrowserWindow({
    width: popupW,
    height: popupH,
    x: screenW - popupW - 16,
    y: screenH - popupH - 16,
    frame: false,
    resizable: false,
    skipTaskbar: false,
    show: false,
    transparent: false,
    fullscreenable: false,
    maxHeight: screenH - 32,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/popup.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Use 'screen-saver' level to appear above fullscreen games
  win.setAlwaysOnTop(true, 'screen-saver')

  return win
}

async function showNextPopup(): Promise<void> {
  if (popupQueue.length === 0) {
    isShowingPopup = false
    return
  }

  isShowingPopup = true
  const alert = popupQueue.shift()!

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
  }

  popupWindow = createPopupWindow()

  popupWindow.on('closed', () => {
    popupWindow = null
    scheduleNext()
  })

  // Store data for when popup requests it
  const settings = getSettings()
  pendingAlertData = { alert, volume: settings.alertVolume, tts: settings.tts }

  const url = getPopupUrl()
  if (url.startsWith('http')) {
    await popupWindow.loadURL(url)
  } else {
    await popupWindow.loadFile(url)
  }

  popupWindow.showInactive()
  popupWindow.moveTop()
  // Flash taskbar to get attention if user is in another app
  popupWindow.flashFrame(true)
}

function scheduleNext(): void {
  if (popupQueue.length > 0) {
    setTimeout(() => showNextPopup(), QUEUE_DELAY_MS)
  } else {
    isShowingPopup = false
  }
}

export function showAlertPopup(alert: any): void {
  popupQueue.push(alert)
  if (!isShowingPopup) {
    showNextPopup()
  }
}

export function showAlertPopups(alerts: any[]): void {
  for (const alert of alerts) {
    showAlertPopup(alert)
  }
}

export function dismissPopup(): void {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close()
  }
}

// Popup requests its alert data once its renderer is ready
ipcMain.handle('popup:get-data', () => {
  return pendingAlertData
})

// Popup signals that sound + TTS have finished — auto-dismiss after delay
ipcMain.on('popup:finished', () => {
  setTimeout(() => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.close()
    }
  }, QUEUE_DELAY_MS)
})

// Popup requests to resize after content renders
ipcMain.on('popup:resize', (_event, contentHeight: number) => {
  if (!popupWindow || popupWindow.isDestroyed()) return
  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize
  const maxH = screenH - 32
  const newH = Math.min(Math.ceil(contentHeight), maxH)
  const popupW = 420
  popupWindow.setBounds({
    x: screenW - popupW - 16,
    y: screenH - newH - 16,
    width: popupW,
    height: newH
  })
})
