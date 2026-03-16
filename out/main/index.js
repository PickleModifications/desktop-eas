"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
let scraperWindow = null;
let pollingInterval = null;
let cachedAlerts = [];
let onAlertsUpdate = null;
function getCachedAlerts() {
  return cachedAlerts;
}
function startScraper(alertCallback) {
  onAlertsUpdate = alertCallback;
  electron.ipcMain.on("scraper:alert-data", (_event, data) => {
    if (data && Array.isArray(data.alerts)) {
      cachedAlerts = data.alerts;
      console.log(`[Scraper] Received ${cachedAlerts.length} alerts`);
      onAlertsUpdate?.(cachedAlerts);
    }
  });
  scraperWindow = new electron.BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "../preload/scraper.js"),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false
    }
  });
  scraperWindow.webContents.loadURL("https://warn.pbs.org/");
  scraperWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`[Scraper] Failed to load: ${errorCode} ${errorDescription}`);
  });
  scraperWindow.webContents.on("did-finish-load", () => {
    console.log("[Scraper] Page loaded");
  });
  pollingInterval = setInterval(() => {
    if (scraperWindow && !scraperWindow.isDestroyed()) {
      console.log("[Scraper] Reloading for fresh data...");
      scraperWindow.webContents.reload();
    }
  }, 6e4);
}
function stopScraper() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (scraperWindow && !scraperWindow.isDestroyed()) {
    scraperWindow.destroy();
    scraperWindow = null;
  }
}
let tray = null;
function createTray(mainWindow2) {
  const iconPath = path.join(__dirname, "../../resources/icon.png");
  const icon = electron.nativeImage.createFromPath(iconPath);
  tray = new electron.Tray(icon.isEmpty() ? electron.nativeImage.createEmpty() : icon);
  tray.setToolTip("Desktop EAS");
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "Open Desktop EAS",
      click: () => {
        mainWindow2.show();
        mainWindow2.focus();
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        electron.app.isQuitting = true;
        electron.app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    mainWindow2.show();
    mainWindow2.focus();
  });
  return tray;
}
function updateTrayTooltip(alertCount) {
  if (tray) {
    tray.setToolTip(
      alertCount > 0 ? `Desktop EAS — ${alertCount} active alert${alertCount !== 1 ? "s" : ""}` : "Desktop EAS — No active alerts"
    );
  }
}
const DEFAULTS = {
  alertsEnabled: true,
  alertVolume: 75,
  location: null,
  tts: {
    enabled: true,
    voice: "",
    rate: 1,
    pitch: 1,
    volume: 80
  }
};
let settings = { ...DEFAULTS };
let settingsPath = "";
function initSettings() {
  settingsPath = path.join(electron.app.getPath("userData"), "settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, "utf-8");
      const parsed = JSON.parse(raw);
      settings = { ...DEFAULTS, ...parsed };
    } catch {
      settings = { ...DEFAULTS };
    }
  }
}
function getSettings() {
  return { ...settings };
}
function saveSettings(updated) {
  settings = { ...settings, ...updated };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  return { ...settings };
}
let popupWindow = null;
let popupQueue = [];
let isShowingPopup = false;
let pendingAlertData = null;
const QUEUE_DELAY_MS = 3e3;
function getPopupUrl() {
  if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    const base = process.env["ELECTRON_RENDERER_URL"].replace(/\/$/, "");
    return `${base}/popup.html`;
  }
  return path.join(__dirname, "../renderer/popup.html");
}
function createPopupWindow() {
  const display = electron.screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  const popupW = 420;
  const popupH = 480;
  const win = new electron.BrowserWindow({
    width: popupW,
    height: popupH,
    x: screenW - popupW - 16,
    y: screenH - popupH - 16,
    frame: false,
    resizable: false,
    skipTaskbar: false,
    show: false,
    transparent: false,
    fullscreenable: false,
    maxHeight: screenH - 32,
    icon: path.join(__dirname, "../../resources/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/popup.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.setAlwaysOnTop(true, "screen-saver");
  return win;
}
async function showNextPopup() {
  if (popupQueue.length === 0) {
    isShowingPopup = false;
    return;
  }
  isShowingPopup = true;
  const alert = popupQueue.shift();
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }
  popupWindow = createPopupWindow();
  popupWindow.on("closed", () => {
    popupWindow = null;
    scheduleNext();
  });
  const settings2 = getSettings();
  pendingAlertData = { alert, volume: settings2.alertVolume, tts: settings2.tts };
  const url = getPopupUrl();
  if (url.startsWith("http")) {
    await popupWindow.loadURL(url);
  } else {
    await popupWindow.loadFile(url);
  }
  popupWindow.showInactive();
  popupWindow.moveTop();
  popupWindow.flashFrame(true);
}
function scheduleNext() {
  if (popupQueue.length > 0) {
    setTimeout(() => showNextPopup(), QUEUE_DELAY_MS);
  } else {
    isShowingPopup = false;
  }
}
function showAlertPopup(alert) {
  popupQueue.push(alert);
  if (!isShowingPopup) {
    showNextPopup();
  }
}
function showAlertPopups(alerts) {
  for (const alert of alerts) {
    showAlertPopup(alert);
  }
}
function dismissPopup() {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.close();
  }
}
electron.ipcMain.handle("popup:get-data", () => {
  return pendingAlertData;
});
electron.ipcMain.on("popup:finished", () => {
  setTimeout(() => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.close();
    }
  }, QUEUE_DELAY_MS);
});
electron.ipcMain.on("popup:resize", (_event, contentHeight) => {
  if (!popupWindow || popupWindow.isDestroyed()) return;
  const display = electron.screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  const maxH = screenH - 32;
  const newH = Math.min(Math.ceil(contentHeight), maxH);
  const popupW = 420;
  popupWindow.setBounds({
    x: screenW - popupW - 16,
    y: screenH - newH - 16,
    width: popupW,
    height: newH
  });
});
let captionWindow = null;
function getCaptionUrl() {
  if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    const base = process.env["ELECTRON_RENDERER_URL"].replace(/\/$/, "");
    return `${base}/caption.html`;
  }
  return path.join(__dirname, "../renderer/caption.html");
}
async function showCaptionWindow() {
  if (captionWindow && !captionWindow.isDestroyed()) return;
  const display = electron.screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  const capW = screenW;
  const capH = 120;
  captionWindow = new electron.BrowserWindow({
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
    icon: path.join(__dirname, "../../resources/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/caption.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  captionWindow.setAlwaysOnTop(true, "screen-saver");
  captionWindow.setIgnoreMouseEvents(true);
  const url = getCaptionUrl();
  if (url.startsWith("http")) {
    await captionWindow.loadURL(url);
  } else {
    await captionWindow.loadFile(url);
  }
  captionWindow.show();
}
function sendCaptionText(text) {
  if (captionWindow && !captionWindow.isDestroyed()) {
    captionWindow.webContents.send("caption:text", text);
  }
}
function clearCaption() {
  if (captionWindow && !captionWindow.isDestroyed()) {
    captionWindow.webContents.send("caption:clear");
  }
}
function closeCaptionWindow() {
  if (captionWindow && !captionWindow.isDestroyed()) {
    captionWindow.close();
  }
  captionWindow = null;
}
function registerIpcHandlers() {
  electron.ipcMain.handle("alerts:get-current", () => {
    return getCachedAlerts();
  });
  electron.ipcMain.handle("settings:get", () => {
    return getSettings();
  });
  electron.ipcMain.handle("settings:save", (_event, updated) => {
    return saveSettings(updated);
  });
  electron.ipcMain.on("popup:dismiss", () => {
    closeCaptionWindow();
    dismissPopup();
  });
  electron.ipcMain.handle("caption:show", () => {
    return showCaptionWindow();
  });
  electron.ipcMain.on("caption:text", (_event, text) => {
    sendCaptionText(text);
  });
  electron.ipcMain.on("caption:clear", () => {
    clearCaption();
  });
  electron.ipcMain.on("caption:close", () => {
    closeCaptionWindow();
  });
  electron.ipcMain.handle("popup:demo", () => {
    const alerts = getCachedAlerts();
    if (alerts.length > 0) {
      showAlertPopup(alerts[0]);
    } else {
      showAlertPopup({
        id: 0,
        event: "Tornado Warning",
        severity: "Extreme",
        urgency: "Immediate",
        certainty: "Observed",
        sender: "NWS Demo",
        sent: (/* @__PURE__ */ new Date()).toISOString(),
        expires: new Date(Date.now() + 36e5).toISOString(),
        received: (/* @__PURE__ */ new Date()).toISOString(),
        last_modified: (/* @__PURE__ */ new Date()).toISOString(),
        is_cancelled: false,
        is_out_of_date: false,
        response_type: "Shelter",
        status: "Actual",
        areas: [
          { type: "area_description", value: "Demo County" },
          {
            type: "polygon",
            value: [
              [39, -98.6],
              [39, -98.4],
              [38.8, -98.4],
              [38.8, -98.6],
              [39, -98.6]
            ]
          }
        ],
        texts: [
          { language: "English", type: "cmac_short_text", value: "NWS: TORNADO WARNING in this area. Take shelter now." },
          { language: "English", type: "cap_headline", value: "Tornado Warning issued for Demo County" },
          { language: "English", type: "cap_instruction", value: "TAKE COVER NOW! This is a demo alert." }
        ]
      });
    }
  });
}
let mainWindow = null;
let knownAlertIds = /* @__PURE__ */ new Set();
let initialLoadDone = false;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 950,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    show: false,
    title: "Desktop EAS",
    icon: path.join(__dirname, "../../resources/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.on("close", (e) => {
    if (!electron.app.isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  if (!electron.app.isPackaged && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  return mainWindow;
}
electron.app.whenReady().then(() => {
  initSettings();
  registerIpcHandlers();
  const win = createWindow();
  createTray(win);
  startScraper((alerts) => {
    updateTrayTooltip(alerts.length);
    if (win && !win.isDestroyed()) {
      win.webContents.send("alerts:update", alerts);
    }
    if (!initialLoadDone) {
      initialLoadDone = true;
      knownAlertIds = new Set(alerts.map((a) => a.id));
      return;
    }
    const settings2 = getSettings();
    if (settings2.alertsEnabled) {
      const newAlerts = alerts.filter((a) => !knownAlertIds.has(a.id));
      if (newAlerts.length > 0) {
        showAlertPopups(newAlerts);
      }
    }
    for (const a of alerts) {
      knownAlertIds.add(a.id);
    }
  });
});
electron.app.on("before-quit", () => {
  electron.app.isQuitting = true;
  stopScraper();
});
electron.app.on("window-all-closed", () => {
});
