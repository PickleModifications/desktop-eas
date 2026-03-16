import { BrowserWindow, screen, app } from 'electron'
import { join } from 'path'

let captionWindow: BrowserWindow | null = null

function getCaptionUrl(): string {
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL'].replace(/\/$/, '')
    return `${base}/caption.html`
  }
  return join(__dirname, '../renderer/caption.html')
}

export async function showCaptionWindow(): Promise<void> {
  if (captionWindow && !captionWindow.isDestroyed()) return

  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize
  const capW = screenW
  const capH = 120

  captionWindow = new BrowserWindow({
    width: capW,
    height: capH,
    x: Math.round((screenW - capW) / 2),
    y: screenH - capH - 8,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    show: false,
    transparent: true,
    focusable: false,
    fullscreenable: false,
    hasShadow: false,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/caption.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  captionWindow.setAlwaysOnTop(true, 'screen-saver')
  captionWindow.setIgnoreMouseEvents(true)

  const url = getCaptionUrl()
  if (url.startsWith('http')) {
    await captionWindow.loadURL(url)
  } else {
    await captionWindow.loadFile(url)
  }

  captionWindow.show()
}

export function sendCaptionText(text: string): void {
  if (captionWindow && !captionWindow.isDestroyed()) {
    captionWindow.webContents.send('caption:text', text)
  }
}

export function clearCaption(): void {
  if (captionWindow && !captionWindow.isDestroyed()) {
    captionWindow.webContents.send('caption:clear')
  }
}

export function closeCaptionWindow(): void {
  if (captionWindow && !captionWindow.isDestroyed()) {
    captionWindow.close()
  }
  captionWindow = null
}
