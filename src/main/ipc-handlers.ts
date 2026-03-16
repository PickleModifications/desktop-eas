import { ipcMain } from 'electron'
import { getCachedAlerts } from './scraper'
import { getSettings, saveSettings } from './settings'
import { dismissPopup, showAlertPopup } from './popup'
import { showCaptionWindow, sendCaptionText, clearCaption, closeCaptionWindow } from './caption'

export function registerIpcHandlers(): void {
  ipcMain.handle('alerts:get-current', () => {
    return getCachedAlerts()
  })

  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:save', (_event, updated) => {
    return saveSettings(updated)
  })

  ipcMain.on('popup:dismiss', () => {
    closeCaptionWindow()
    dismissPopup()
  })

  ipcMain.handle('caption:show', () => {
    return showCaptionWindow()
  })

  ipcMain.on('caption:text', (_event, text: string) => {
    sendCaptionText(text)
  })

  ipcMain.on('caption:clear', () => {
    clearCaption()
  })

  ipcMain.on('caption:close', () => {
    closeCaptionWindow()
  })

  ipcMain.handle('popup:demo', () => {
    const alerts = getCachedAlerts()
    if (alerts.length > 0) {
      showAlertPopup(alerts[0])
    } else {
      // Show a synthetic demo alert
      showAlertPopup({
        id: 0,
        event: 'Tornado Warning',
        severity: 'Extreme',
        urgency: 'Immediate',
        certainty: 'Observed',
        sender: 'NWS Demo',
        sent: new Date().toISOString(),
        expires: new Date(Date.now() + 3600000).toISOString(),
        received: new Date().toISOString(),
        last_modified: new Date().toISOString(),
        is_cancelled: false,
        is_out_of_date: false,
        response_type: 'Shelter',
        status: 'Actual',
        areas: [
          { type: 'area_description', value: 'Demo County' },
          {
            type: 'polygon',
            value: [
              [39.0, -98.6], [39.0, -98.4],
              [38.8, -98.4], [38.8, -98.6], [39.0, -98.6]
            ]
          }
        ],
        texts: [
          { language: 'English', type: 'cmac_short_text', value: 'NWS: TORNADO WARNING in this area. Take shelter now.' },
          { language: 'English', type: 'cap_headline', value: 'Tornado Warning issued for Demo County' },
          { language: 'English', type: 'cap_instruction', value: 'TAKE COVER NOW! This is a demo alert.' }
        ]
      })
    }
  })
}
