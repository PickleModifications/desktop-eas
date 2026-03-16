"use strict";
const { ipcRenderer } = require("electron");
const OrigXHR = window.XMLHttpRequest;
const originalOpen = OrigXHR.prototype.open;
const originalSend = OrigXHR.prototype.send;
OrigXHR.prototype.open = function(method, url, ...args) {
  this._easUrl = url;
  return originalOpen.apply(this, [method, url, ...args]);
};
OrigXHR.prototype.send = function(...args) {
  if (this._easUrl && String(this._easUrl).includes("/warn_out/")) {
    this.addEventListener("load", function() {
      try {
        const data = JSON.parse(this.responseText);
        ipcRenderer.send("scraper:alert-data", data);
      } catch {
      }
    });
  }
  return originalSend.apply(this, args);
};
const originalFetch = window.fetch;
window.fetch = async function(input, init) {
  const response = await originalFetch.apply(this, [input, init]);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("/warn_out/")) {
    try {
      const cloned = response.clone();
      const data = await cloned.json();
      ipcRenderer.send("scraper:alert-data", data);
    } catch {
    }
  }
  return response;
};
