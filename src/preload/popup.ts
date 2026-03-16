import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('popupAPI', {
  getData: () => ipcRenderer.invoke('popup:get-data'),
  dismiss: () => ipcRenderer.send('popup:dismiss'),
  finished: () => ipcRenderer.send('popup:finished'),
  resize: (height: number) => ipcRenderer.send('popup:resize', height),
  showCaption: () => ipcRenderer.invoke('caption:show'),
  sendCaptionText: (text: string) => ipcRenderer.send('caption:text', text),
  clearCaption: () => ipcRenderer.send('caption:clear'),
  closeCaption: () => ipcRenderer.send('caption:close')
})
