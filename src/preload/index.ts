import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('easAPI', {
  onAlertsUpdate: (callback: (alerts: unknown[]) => void) => {
    ipcRenderer.on('alerts:update', (_event, alerts) => callback(alerts))
  },
  getAlerts: () => ipcRenderer.invoke('alerts:get-current'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (updated: Record<string, unknown>) => ipcRenderer.invoke('settings:save', updated),
  demoPopup: () => ipcRenderer.invoke('popup:demo')
})
