import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('captionAPI', {
  onText: (callback: (text: string) => void) => {
    ipcRenderer.on('caption:text', (_event, text) => callback(text))
  },
  onClear: (callback: () => void) => {
    ipcRenderer.on('caption:clear', () => callback())
  }
})
