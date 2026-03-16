/* eslint-disable @typescript-eslint/no-explicit-any */
// This preload script runs inside the hidden scraper BrowserWindow.
// It monkey-patches XHR and fetch so that when warn.pbs.org makes a
// request matching */warn_out/*, we capture the response body and
// send it to the main process via IPC.

const { ipcRenderer } = require('electron')

// --- Monkey-patch XMLHttpRequest ---
const OrigXHR = (window as any).XMLHttpRequest
const originalOpen = OrigXHR.prototype.open
const originalSend = OrigXHR.prototype.send

OrigXHR.prototype.open = function (method: string, url: string, ...args: any[]) {
  this._easUrl = url
  return originalOpen.apply(this, [method, url, ...args])
}

OrigXHR.prototype.send = function (...args: any[]) {
  if (this._easUrl && String(this._easUrl).includes('/warn_out/')) {
    this.addEventListener('load', function (this: any) {
      try {
        const data = JSON.parse(this.responseText)
        ipcRenderer.send('scraper:alert-data', data)
      } catch {
        // not JSON, ignore
      }
    })
  }
  return originalSend.apply(this, args)
}

// --- Monkey-patch fetch ---
const originalFetch = (window as any).fetch
;(window as any).fetch = async function (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response: Response = await originalFetch.apply(this, [input, init])
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url

  if (url.includes('/warn_out/')) {
    try {
      const cloned = response.clone()
      const data = await cloned.json()
      ipcRenderer.send('scraper:alert-data', data)
    } catch {
      // not JSON, ignore
    }
  }
  return response
}
