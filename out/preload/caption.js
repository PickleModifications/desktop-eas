"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("captionAPI", {
  onText: (callback) => {
    electron.ipcRenderer.on("caption:text", (_event, text) => callback(text));
  },
  onClear: (callback) => {
    electron.ipcRenderer.on("caption:clear", () => callback());
  }
});
