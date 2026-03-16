"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("easAPI", {
  onAlertsUpdate: (callback) => {
    electron.ipcRenderer.on("alerts:update", (_event, alerts) => callback(alerts));
  },
  getAlerts: () => electron.ipcRenderer.invoke("alerts:get-current"),
  getSettings: () => electron.ipcRenderer.invoke("settings:get"),
  saveSettings: (updated) => electron.ipcRenderer.invoke("settings:save", updated),
  demoPopup: () => electron.ipcRenderer.invoke("popup:demo")
});
