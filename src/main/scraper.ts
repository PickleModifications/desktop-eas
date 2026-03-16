import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import type { Alert, AlertResponse } from './types'

let scraperWindow: BrowserWindow | null = null
let pollingInterval: ReturnType<typeof setInterval> | null = null
let cachedAlerts: Alert[] = []
let onAlertsUpdate: ((alerts: Alert[]) => void) | null = null

export function getCachedAlerts(): Alert[] {
  return cachedAlerts
}

export function startScraper(alertCallback: (alerts: Alert[]) => void): void {
  onAlertsUpdate = alertCallback

  ipcMain.on('scraper:alert-data', (_event, data: AlertResponse) => {
    if (data && Array.isArray(data.alerts)) {
      cachedAlerts = data.alerts
      console.log(`[Scraper] Received ${cachedAlerts.length} alerts`)
      onAlertsUpdate?.(cachedAlerts)
    }
  })

  scraperWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/scraper.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false
    }
  })

  scraperWindow.webContents.loadURL('https://warn.pbs.org/')

  scraperWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[Scraper] Failed to load: ${errorCode} ${errorDescription}`)
  })

  scraperWindow.webContents.on('did-finish-load', () => {
    console.log('[Scraper] Page loaded')
  })

  // Poll every 60 seconds
  pollingInterval = setInterval(() => {
    if (scraperWindow && !scraperWindow.isDestroyed()) {
      console.log('[Scraper] Reloading for fresh data...')
      scraperWindow.webContents.reload()
    }
  }, 60_000)
}

export function stopScraper(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
  if (scraperWindow && !scraperWindow.isDestroyed()) {
    scraperWindow.destroy()
    scraperWindow = null
  }
}
