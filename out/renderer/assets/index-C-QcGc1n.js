import { l as leafletSrcExports } from "./leaflet-BlAy2-mF.js";
let currentMap = null;
function escapeHtml$2(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function formatTime$1(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
function getTextByType(texts, type, lang = "English") {
  const t = texts.find((t2) => t2.type === type && t2.language === lang);
  return t ? t.value : null;
}
function getSeverityColor(severity) {
  switch (severity) {
    case "Extreme":
      return "#dc2626";
    case "Severe":
      return "#ea580c";
    case "Moderate":
      return "#ca8a04";
    case "Minor":
      return "#2563eb";
    default:
      return "#6b7280";
  }
}
function parseCircle(value) {
  if (typeof value === "string") {
    const commaMatch = value.match(
      /^\s*([-\d.]+)\s*,\s*([-\d.]+)\s+([-\d.]+)\s*$/
    );
    if (commaMatch) {
      const lat = parseFloat(commaMatch[1]);
      const lng = parseFloat(commaMatch[2]);
      const radiusKm = parseFloat(commaMatch[3]);
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm)) {
        return { kind: "circle", center: [lat, lng], radiusMeters: radiusKm * 1e3 };
      }
    }
    const spaceMatch = value.match(
      /^\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*$/
    );
    if (spaceMatch) {
      const lat = parseFloat(spaceMatch[1]);
      const lng = parseFloat(spaceMatch[2]);
      const radiusKm = parseFloat(spaceMatch[3]);
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm)) {
        return { kind: "circle", center: [lat, lng], radiusMeters: radiusKm * 1e3 };
      }
    }
  }
  if (Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === "number")) {
    return {
      kind: "circle",
      center: [value[0], value[1]],
      radiusMeters: value[2] * 1e3
    };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value.center && typeof value.center === "object") {
      const lat2 = value.center.lat ?? value.center.latitude;
      const lng2 = value.center.lng ?? value.center.lon ?? value.center.longitude;
      const r2 = value.radius ?? value.radius_km;
      if (typeof lat2 === "number" && typeof lng2 === "number" && typeof r2 === "number") {
        return { kind: "circle", center: [lat2, lng2], radiusMeters: r2 * 1e3 };
      }
    }
    const lat = value.lat ?? value.latitude;
    const lng = value.lng ?? value.lon ?? value.longitude;
    const r = value.radius ?? value.radius_km;
    if (typeof lat === "number" && typeof lng === "number" && typeof r === "number") {
      return { kind: "circle", center: [lat, lng], radiusMeters: r * 1e3 };
    }
  }
  return null;
}
function extractGeometries(areas) {
  const geometries = [];
  for (const area of areas) {
    if (area.type === "polygon" && Array.isArray(area.value)) {
      geometries.push({
        kind: "polygon",
        coords: area.value
      });
    } else if (area.type === "circle") {
      const circle = parseCircle(area.value);
      if (circle) geometries.push(circle);
    }
  }
  return geometries;
}
function getAreaDescription$1(areas) {
  const desc = areas.find((a) => a.type === "area_description");
  return desc ? String(desc.value) : null;
}
async function geocodeDescription(description) {
  try {
    const q = encodeURIComponent(description.split(";")[0].trim());
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`,
      { headers: { "User-Agent": "EASViewer/1.0" } }
    );
    const results = await resp.json();
    if (results.length > 0) {
      return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
    }
  } catch {
  }
  return null;
}
async function initMap(containerId, geometries, severity, areaDescription) {
  if (currentMap) {
    currentMap.remove();
    currentMap = null;
  }
  const mapEl = document.getElementById(containerId);
  if (!mapEl) return;
  const map = leafletSrcExports.map(containerId, {
    zoomControl: true,
    scrollWheelZoom: true,
    dragging: true
  });
  currentMap = map;
  leafletSrcExports.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18
  }).addTo(map);
  const color = getSeverityColor(severity);
  const allBounds = [];
  for (const geo of geometries) {
    if (geo.kind === "polygon") {
      const latLngs = geo.coords.map(
        ([lat, lng]) => [lat, lng]
      );
      const polygon = leafletSrcExports.polygon(latLngs, {
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.25
      }).addTo(map);
      allBounds.push(polygon.getBounds());
    } else if (geo.kind === "circle") {
      const circleBounds = leafletSrcExports.latLng(geo.center).toBounds(geo.radiusMeters * 2);
      allBounds.push(circleBounds);
      leafletSrcExports.circle(geo.center, {
        radius: geo.radiusMeters,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.25
      }).addTo(map);
    }
  }
  if (allBounds.length > 0) {
    let combined = allBounds[0];
    for (let i = 1; i < allBounds.length; i++) {
      combined = combined.extend(allBounds[i]);
    }
    map.fitBounds(combined, { padding: [30, 30] });
  } else if (areaDescription) {
    const coords = await geocodeDescription(areaDescription);
    if (coords) {
      map.setView(coords, 9);
      leafletSrcExports.circleMarker(coords, {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.5,
        weight: 2
      }).addTo(map).bindPopup(areaDescription).openPopup();
    } else {
      map.setView([39.8, -98.5], 4);
    }
  } else {
    map.setView([39.8, -98.5], 4);
  }
  setTimeout(() => map.invalidateSize(), 100);
}
function showDetail(alert) {
  const container = document.getElementById("alert-detail");
  container.classList.remove("hidden");
  const areas = alert.areas.filter((a) => a.type === "area_description").map((a) => String(a.value)).join("; ");
  const description = getTextByType(alert.texts, "cap_description");
  const instruction = getTextByType(alert.texts, "cap_instruction");
  container.innerHTML = `
    <div class="detail-panel">
      <button class="detail-close" id="detail-close-btn">&times;</button>
      <h2 class="detail-event">${escapeHtml$2(alert.event)}</h2>

      <div id="detail-map" class="detail-map"></div>

      <div class="detail-grid">
        <div class="detail-field">
          <label>Severity</label>
          <span>${escapeHtml$2(alert.severity)}</span>
        </div>
        <div class="detail-field">
          <label>Urgency</label>
          <span>${escapeHtml$2(alert.urgency)}</span>
        </div>
        <div class="detail-field">
          <label>Certainty</label>
          <span>${escapeHtml$2(alert.certainty)}</span>
        </div>
        <div class="detail-field">
          <label>Response</label>
          <span>${escapeHtml$2(alert.response_type)}</span>
        </div>
        <div class="detail-field">
          <label>Status</label>
          <span>${escapeHtml$2(alert.status)}</span>
        </div>
        <div class="detail-field">
          <label>Sender</label>
          <span>${escapeHtml$2(alert.sender)}</span>
        </div>
      </div>

      <div class="detail-section">
        <label>Areas</label>
        <p>${escapeHtml$2(areas || "Unknown")}</p>
      </div>

      <div class="detail-section">
        <label>Sent</label>
        <span>${formatTime$1(alert.sent)}</span>
        &nbsp;&bull;&nbsp;
        <label>Expires</label>
        <span>${formatTime$1(alert.expires)}</span>
      </div>

      ${description ? `<div class="detail-section">
              <label>Description</label>
              <pre class="detail-text">${escapeHtml$2(description)}</pre>
            </div>` : ""}

      ${instruction ? `<div class="detail-section">
              <label>Instructions</label>
              <pre class="detail-text">${escapeHtml$2(instruction)}</pre>
            </div>` : ""}

      ${alert.is_cancelled ? '<div class="alert-badge cancelled-badge">CANCELLED</div>' : ""}
      ${alert.is_out_of_date ? '<div class="alert-badge expired-badge">EXPIRED</div>' : ""}
    </div>
  `;
  document.getElementById("detail-close-btn").addEventListener("click", hideDetail);
  const geometries = extractGeometries(alert.areas);
  const areaDesc = getAreaDescription$1(alert.areas);
  requestAnimationFrame(() => {
    initMap("detail-map", geometries, alert.severity, areaDesc);
  });
}
function hideDetail() {
  if (currentMap) {
    currentMap.remove();
    currentMap = null;
  }
  const container = document.getElementById("alert-detail");
  container.classList.add("hidden");
  container.innerHTML = "";
}
function getSeverityClass(severity) {
  switch (severity) {
    case "Extreme":
      return "severity-extreme";
    case "Severe":
      return "severity-severe";
    case "Moderate":
      return "severity-moderate";
    case "Minor":
      return "severity-minor";
    default:
      return "severity-unknown";
  }
}
function getAreaDescription(areas) {
  const desc = areas.find((a) => a.type === "area_description");
  return desc ? String(desc.value) : "Unknown area";
}
function getHeadline(texts) {
  const headline = texts.find((t) => t.type === "cap_headline" && t.language === "English");
  return headline ? headline.value : "";
}
function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  } catch {
    return iso;
  }
}
function renderAlerts(alerts) {
  const container = document.getElementById("alert-list");
  container.innerHTML = "";
  if (alerts.length === 0) {
    container.innerHTML = '<div class="no-alerts">No active alerts at this time.</div>';
    return;
  }
  const sorted = [...alerts].sort(
    (a, b) => new Date(b.sent).getTime() - new Date(a.sent).getTime()
  );
  for (const alert of sorted) {
    const card = document.createElement("div");
    card.className = `alert-card ${getSeverityClass(alert.severity)}`;
    if (alert.is_cancelled) card.classList.add("cancelled");
    const headline = getHeadline(alert.texts);
    const area = getAreaDescription(alert.areas);
    card.innerHTML = `
      <div class="alert-card-header">
        <span class="alert-event">${escapeHtml$1(alert.event)}</span>
        <span class="alert-severity-badge">${escapeHtml$1(alert.severity)}</span>
      </div>
      <div class="alert-area">${escapeHtml$1(area)}</div>
      ${headline ? `<div class="alert-headline">${escapeHtml$1(headline)}</div>` : ""}
      <div class="alert-meta">
        <span class="alert-sender">${escapeHtml$1(alert.sender)}</span>
        <span class="alert-times">
          Sent: ${formatTime(alert.sent)} &bull; Expires: ${formatTime(alert.expires)}
        </span>
      </div>
      ${alert.is_cancelled ? '<div class="alert-badge cancelled-badge">CANCELLED</div>' : ""}
      ${alert.is_out_of_date ? '<div class="alert-badge expired-badge">EXPIRED</div>' : ""}
    `;
    card.addEventListener("click", () => showDetail(alert));
    container.appendChild(card);
  }
}
function escapeHtml$1(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
const STATE_FIPS = {
  "alabama": "01",
  "al": "01",
  "alaska": "02",
  "ak": "02",
  "arizona": "04",
  "az": "04",
  "arkansas": "05",
  "ar": "05",
  "california": "06",
  "ca": "06",
  "colorado": "08",
  "co": "08",
  "connecticut": "09",
  "ct": "09",
  "delaware": "10",
  "de": "10",
  "florida": "12",
  "fl": "12",
  "georgia": "13",
  "ga": "13",
  "hawaii": "15",
  "hi": "15",
  "idaho": "16",
  "id": "16",
  "illinois": "17",
  "il": "17",
  "indiana": "18",
  "in": "18",
  "iowa": "19",
  "ia": "19",
  "kansas": "20",
  "ks": "20",
  "kentucky": "21",
  "ky": "21",
  "louisiana": "22",
  "la": "22",
  "maine": "23",
  "me": "23",
  "maryland": "24",
  "md": "24",
  "massachusetts": "25",
  "ma": "25",
  "michigan": "26",
  "mi": "26",
  "minnesota": "27",
  "mn": "27",
  "mississippi": "28",
  "ms": "28",
  "missouri": "29",
  "mo": "29",
  "montana": "30",
  "mt": "30",
  "nebraska": "31",
  "ne": "31",
  "nevada": "32",
  "nv": "32",
  "new hampshire": "33",
  "nh": "33",
  "new jersey": "34",
  "nj": "34",
  "new mexico": "35",
  "nm": "35",
  "new york": "36",
  "ny": "36",
  "north carolina": "37",
  "nc": "37",
  "north dakota": "38",
  "nd": "38",
  "ohio": "39",
  "oh": "39",
  "oklahoma": "40",
  "ok": "40",
  "oregon": "41",
  "or": "41",
  "pennsylvania": "42",
  "pa": "42",
  "rhode island": "44",
  "ri": "44",
  "south carolina": "45",
  "sc": "45",
  "south dakota": "46",
  "sd": "46",
  "tennessee": "47",
  "tn": "47",
  "texas": "48",
  "tx": "48",
  "utah": "49",
  "ut": "49",
  "vermont": "50",
  "vt": "50",
  "virginia": "51",
  "va": "51",
  "washington": "53",
  "wa": "53",
  "west virginia": "54",
  "wv": "54",
  "wisconsin": "55",
  "wi": "55",
  "wyoming": "56",
  "wy": "56",
  "district of columbia": "11",
  "dc": "11",
  "puerto rico": "72",
  "pr": "72",
  "guam": "66",
  "gu": "66",
  "american samoa": "60",
  "as": "60",
  "u.s. virgin islands": "78",
  "vi": "78"
};
function stateToFips(state) {
  return STATE_FIPS[state.toLowerCase()];
}
const TTS_DEFAULTS = { enabled: true, voice: "", rate: 1, pitch: 1, volume: 80 };
let currentSettings = {
  alertsEnabled: true,
  alertVolume: 75,
  location: null,
  tts: { ...TTS_DEFAULTS }
};
let searchTimeout = null;
let onSettingsChanged = null;
function setOnSettingsChanged(cb) {
  onSettingsChanged = cb;
}
function getLocalSettings() {
  return currentSettings;
}
async function initSettings() {
  currentSettings = await window.easAPI.getSettings();
  renderSettings();
}
function renderSettings() {
  const container = document.getElementById("settings-view");
  const tts = currentSettings.tts || TTS_DEFAULTS;
  container.innerHTML = `
    <div class="settings-content">
      <h2 class="settings-title">Settings</h2>

      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-text">
            <label class="settings-label">Enable Alerts</label>
            <p class="settings-desc">Receive and display emergency alerts from PBS WARN</p>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggle-alerts" ${currentSettings.alertsEnabled ? "checked" : ""} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-text">
            <label class="settings-label">Alert Volume</label>
            <p class="settings-desc">Volume for the alert notification sound</p>
          </div>
          <span class="volume-value" id="volume-value">${currentSettings.alertVolume}%</span>
        </div>
        <div class="volume-slider-wrap">
          <input
            type="range"
            id="volume-slider"
            class="volume-slider"
            min="0"
            max="100"
            step="1"
            value="${currentSettings.alertVolume}"
          />
        </div>
        <button class="volume-test-btn" id="volume-test-btn">
          <span class="volume-test-icon" id="volume-test-icon">&#9654;</span>
          Test Sound
        </button>
      </div>

      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-text">
            <label class="settings-label">Alert Popup</label>
            <p class="settings-desc">Preview the popup notification that appears for new alerts</p>
          </div>
          <button class="volume-test-btn" id="demo-popup-btn">Demo Popup</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-text">
            <label class="settings-label">Text-to-Speech</label>
            <p class="settings-desc">Read alert descriptions aloud when a new alert arrives</p>
          </div>
          <label class="toggle">
            <input type="checkbox" id="toggle-tts" ${tts.enabled ? "checked" : ""} />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div id="tts-options" class="${tts.enabled ? "" : "hidden"}">
          <div class="settings-row" style="margin-top:14px">
            <div class="settings-row-text">
              <label class="settings-label">Voice</label>
            </div>
            <select id="tts-voice" class="settings-select">
              <option value="">System Default</option>
            </select>
          </div>

          <div class="settings-row" style="margin-top:14px">
            <div class="settings-row-text">
              <label class="settings-label">Speed</label>
            </div>
            <span class="volume-value" id="tts-rate-value">${tts.rate.toFixed(1)}x</span>
          </div>
          <div class="volume-slider-wrap">
            <input type="range" id="tts-rate" class="volume-slider" min="0.5" max="2.0" step="0.1" value="${tts.rate}" />
          </div>

          <div class="settings-row" style="margin-top:14px">
            <div class="settings-row-text">
              <label class="settings-label">Pitch</label>
            </div>
            <span class="volume-value" id="tts-pitch-value">${tts.pitch.toFixed(1)}</span>
          </div>
          <div class="volume-slider-wrap">
            <input type="range" id="tts-pitch" class="volume-slider" min="0" max="2" step="0.1" value="${tts.pitch}" />
          </div>

          <div class="settings-row" style="margin-top:14px">
            <div class="settings-row-text">
              <label class="settings-label">TTS Volume</label>
            </div>
            <span class="volume-value" id="tts-vol-value">${tts.volume}%</span>
          </div>
          <div class="volume-slider-wrap">
            <input type="range" id="tts-volume" class="volume-slider" min="0" max="100" step="1" value="${tts.volume}" />
          </div>

          <button class="volume-test-btn" id="tts-test-btn">
            <span class="volume-test-icon" id="tts-test-icon">&#9654;</span>
            Test TTS
          </button>
        </div>
      </div>

      <div class="settings-section">
        <label class="settings-label">Location</label>
        <p class="settings-desc">Set your location to filter alerts relevant to your area</p>

        <div class="location-search-wrap">
          <input
            type="text"
            id="location-input"
            class="settings-input"
            placeholder="Search city, county, or state..."
            value="${currentSettings.location ? escapeAttr(currentSettings.location.name) : ""}"
            autocomplete="off"
          />
          <div id="location-results" class="location-results hidden"></div>
        </div>

        ${currentSettings.location ? `<div class="location-current">
                <span class="location-pin">&#9679;</span>
                <span class="location-name">${escapeHtml(currentSettings.location.name)}</span>
                <span class="location-coords">${currentSettings.location.lat.toFixed(4)}, ${currentSettings.location.lng.toFixed(4)}</span>
                <button id="location-clear" class="location-clear">&times;</button>
              </div>` : ""}
      </div>
    </div>
  `;
  document.getElementById("toggle-alerts").addEventListener("change", async (e) => {
    const checked = e.target.checked;
    currentSettings = await window.easAPI.saveSettings({ alertsEnabled: checked });
    onSettingsChanged?.();
  });
  const volumeSlider = document.getElementById("volume-slider");
  const volumeValue = document.getElementById("volume-value");
  volumeSlider.addEventListener("input", () => {
    volumeValue.textContent = `${volumeSlider.value}%`;
  });
  volumeSlider.addEventListener("change", async () => {
    const vol = parseInt(volumeSlider.value, 10);
    currentSettings = await window.easAPI.saveSettings({ alertVolume: vol });
    onSettingsChanged?.();
  });
  const testBtn = document.getElementById("volume-test-btn");
  const testIcon = document.getElementById("volume-test-icon");
  testBtn.addEventListener("click", () => {
    if (alertAudio && !alertAudio.paused) {
      stopAlertSound();
      testBtn.classList.remove("playing");
      testIcon.textContent = "▶";
    } else {
      playAlertSound(currentSettings.alertVolume, () => {
        testBtn.classList.remove("playing");
        testIcon.textContent = "▶";
      });
      testBtn.classList.add("playing");
      testIcon.textContent = "■";
    }
  });
  const demoBtn = document.getElementById("demo-popup-btn");
  demoBtn.addEventListener("click", async () => {
    demoBtn.setAttribute("disabled", "");
    const origText = demoBtn.textContent;
    for (let i = 3; i > 0; i--) {
      demoBtn.textContent = `${i}...`;
      await new Promise((r) => setTimeout(r, 1e3));
    }
    demoBtn.textContent = origText;
    demoBtn.removeAttribute("disabled");
    window.easAPI.demoPopup();
  });
  document.getElementById("toggle-tts").addEventListener("change", async (e) => {
    const checked = e.target.checked;
    const newTts = { ...currentSettings.tts, enabled: checked };
    currentSettings = await window.easAPI.saveSettings({ tts: newTts });
    document.getElementById("tts-options").classList.toggle("hidden", !checked);
    onSettingsChanged?.();
  });
  const voiceSelect = document.getElementById("tts-voice");
  function populateVoices() {
    const voices = speechSynthesis.getVoices();
    voiceSelect.innerHTML = '<option value="">System Default</option>';
    for (const v of voices) {
      const opt = document.createElement("option");
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      if (v.name === (currentSettings.tts?.voice || "")) opt.selected = true;
      voiceSelect.appendChild(opt);
    }
  }
  populateVoices();
  speechSynthesis.onvoiceschanged = populateVoices;
  voiceSelect.addEventListener("change", async () => {
    const newTts = { ...currentSettings.tts, voice: voiceSelect.value };
    currentSettings = await window.easAPI.saveSettings({ tts: newTts });
    onSettingsChanged?.();
  });
  const ttsRate = document.getElementById("tts-rate");
  const ttsRateValue = document.getElementById("tts-rate-value");
  ttsRate.addEventListener("input", () => {
    ttsRateValue.textContent = `${parseFloat(ttsRate.value).toFixed(1)}x`;
  });
  ttsRate.addEventListener("change", async () => {
    const newTts = { ...currentSettings.tts, rate: parseFloat(ttsRate.value) };
    currentSettings = await window.easAPI.saveSettings({ tts: newTts });
    onSettingsChanged?.();
  });
  const ttsPitch = document.getElementById("tts-pitch");
  const ttsPitchValue = document.getElementById("tts-pitch-value");
  ttsPitch.addEventListener("input", () => {
    ttsPitchValue.textContent = parseFloat(ttsPitch.value).toFixed(1);
  });
  ttsPitch.addEventListener("change", async () => {
    const newTts = { ...currentSettings.tts, pitch: parseFloat(ttsPitch.value) };
    currentSettings = await window.easAPI.saveSettings({ tts: newTts });
    onSettingsChanged?.();
  });
  const ttsVol = document.getElementById("tts-volume");
  const ttsVolValue = document.getElementById("tts-vol-value");
  ttsVol.addEventListener("input", () => {
    ttsVolValue.textContent = `${ttsVol.value}%`;
  });
  ttsVol.addEventListener("change", async () => {
    const newTts = { ...currentSettings.tts, volume: parseInt(ttsVol.value, 10) };
    currentSettings = await window.easAPI.saveSettings({ tts: newTts });
    onSettingsChanged?.();
  });
  const ttsTestBtn = document.getElementById("tts-test-btn");
  const ttsTestIcon = document.getElementById("tts-test-icon");
  ttsTestBtn.addEventListener("click", () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      ttsTestBtn.classList.remove("playing");
      ttsTestIcon.textContent = "▶";
    } else {
      const ttsConf = currentSettings.tts || TTS_DEFAULTS;
      const utter = new SpeechSynthesisUtterance(
        "The National Weather Service has issued a Tornado Warning for your area. Take shelter now."
      );
      utter.rate = ttsConf.rate;
      utter.pitch = ttsConf.pitch;
      utter.volume = ttsConf.volume / 100;
      if (ttsConf.voice) {
        const v = speechSynthesis.getVoices().find((v2) => v2.name === ttsConf.voice);
        if (v) utter.voice = v;
      }
      utter.onend = () => {
        ttsTestBtn.classList.remove("playing");
        ttsTestIcon.textContent = "▶";
      };
      speechSynthesis.speak(utter);
      ttsTestBtn.classList.add("playing");
      ttsTestIcon.textContent = "■";
    }
  });
  const input = document.getElementById("location-input");
  input.addEventListener("input", () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const query = input.value.trim();
    if (query.length < 2) {
      hideResults();
      return;
    }
    searchTimeout = setTimeout(() => searchLocation(query), 350);
  });
  input.addEventListener("focus", () => {
    const query = input.value.trim();
    if (query.length >= 2) {
      searchLocation(query);
    }
  });
  const clearBtn = document.getElementById("location-clear");
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      currentSettings = await window.easAPI.saveSettings({ location: null });
      onSettingsChanged?.();
      renderSettings();
    });
  }
}
async function searchLocation(query) {
  const resultsEl = document.getElementById("location-results");
  resultsEl.classList.remove("hidden");
  resultsEl.innerHTML = '<div class="location-result-item loading">Searching...</div>';
  try {
    const q = encodeURIComponent(query);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=us&addressdetails=1`,
      { headers: { "User-Agent": "EASViewer/1.0" } }
    );
    const results = await resp.json();
    if (results.length === 0) {
      resultsEl.innerHTML = '<div class="location-result-item loading">No results found</div>';
      return;
    }
    resultsEl.innerHTML = "";
    for (const r of results) {
      const name = r.display_name;
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      const stateName = r.address?.state;
      const stateCode = r.address?.["ISO3166-2-lvl4"];
      let stateFips;
      if (stateName) stateFips = stateToFips(stateName);
      if (!stateFips && stateCode) stateFips = stateToFips(stateCode.replace("US-", ""));
      const item = document.createElement("div");
      item.className = "location-result-item";
      item.textContent = name;
      item.addEventListener("click", async () => {
        const location = { name, lat, lng, stateFips };
        currentSettings = await window.easAPI.saveSettings({ location });
        onSettingsChanged?.();
        hideResults();
        renderSettings();
      });
      resultsEl.appendChild(item);
    }
  } catch {
    resultsEl.innerHTML = '<div class="location-result-item loading">Search failed</div>';
  }
}
function hideResults() {
  const el = document.getElementById("location-results");
  if (el) {
    el.classList.add("hidden");
    el.innerHTML = "";
  }
}
document.addEventListener("click", (e) => {
  const target = e.target;
  if (!target.closest(".location-search-wrap")) {
    hideResults();
  }
});
let alertAudio = null;
function playAlertSound(volume, onEnded) {
  const vol = volume ?? currentSettings.alertVolume;
  if (vol === 0) return;
  if (!alertAudio) {
    alertAudio = new Audio("/alert.mp3");
  }
  alertAudio.onended = onEnded ?? null;
  alertAudio.volume = vol / 100;
  alertAudio.currentTime = 0;
  alertAudio.play().catch(() => {
  });
}
function stopAlertSound() {
  if (alertAudio && !alertAudio.paused) {
    alertAudio.pause();
    alertAudio.currentTime = 0;
    alertAudio.onended = null;
  }
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function escapeAttr(text) {
  return text.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
document.body.style.opacity = "1";
const statusEl = document.getElementById("status");
const alertListEl = document.getElementById("alert-list");
const settingsViewEl = document.getElementById("settings-view");
let allAlerts = [];
function updateStatus(count) {
  if (count === 0) {
    statusEl.textContent = "No active alerts";
  } else {
    statusEl.textContent = `${count} active alert${count !== 1 ? "s" : ""}`;
  }
}
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if (yi > lat !== yj > lat && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
function filterByLocation(alerts) {
  const settings = getLocalSettings();
  if (!settings.location) return alerts;
  const { lat, lng, stateFips } = settings.location;
  if (!stateFips) return alerts;
  const PROXIMITY_KM = 50;
  return alerts.filter((alert) => {
    const areas = alert.areas || [];
    const polygons = areas.filter((a) => a.type === "polygon" && Array.isArray(a.value));
    const circles = areas.filter((a) => a.type === "circle" && a.value);
    const alertStates = areas.filter((a) => a.type === "state").map((a) => String(a.value));
    if (alertStates.length > 0 && !alertStates.includes(stateFips)) {
      return false;
    }
    if (polygons.length === 0 && circles.length === 0) {
      return alertStates.length > 0;
    }
    for (const p of polygons) {
      if (pointInPolygon(lat, lng, p.value)) return true;
      const coords = p.value;
      const centLat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
      const centLng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
      if (haversineKm(lat, lng, centLat, centLng) <= PROXIMITY_KM) return true;
    }
    for (const c of circles) {
      let cLat, cLng, radiusKm;
      const v = c.value;
      if (v && typeof v === "object" && v.center) {
        cLat = v.center.lat ?? v.center.latitude;
        cLng = v.center.lng ?? v.center.lon ?? v.center.longitude;
        radiusKm = v.radius ?? v.radius_km;
      } else if (typeof v === "string") {
        const m = v.match(/^\s*([-\d.]+)\s*,\s*([-\d.]+)\s+([-\d.]+)\s*$/);
        if (m) {
          cLat = parseFloat(m[1]);
          cLng = parseFloat(m[2]);
          radiusKm = parseFloat(m[3]);
        }
      }
      if (cLat != null && cLng != null && radiusKm != null) {
        if (haversineKm(lat, lng, cLat, cLng) <= radiusKm) return true;
      }
    }
    return false;
  });
}
function processAlerts(alerts) {
  allAlerts = alerts;
  refreshDisplay();
}
function refreshDisplay() {
  const settings = getLocalSettings();
  const filtered = settings.alertsEnabled ? filterByLocation(allAlerts) : [];
  updateStatus(filtered.length);
  renderAlerts(filtered);
}
function initTabs() {
  const tabs = document.querySelectorAll("#tabs .tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.tab;
      if (target === "alerts") {
        alertListEl.classList.remove("hidden");
        settingsViewEl.classList.add("hidden");
      } else if (target === "settings") {
        alertListEl.classList.add("hidden");
        settingsViewEl.classList.remove("hidden");
      }
    });
  });
}
function showSetup() {
  return new Promise((resolve) => {
    const overlay = document.getElementById("setup-overlay");
    const input = document.getElementById("setup-location-input");
    const resultsEl = document.getElementById("setup-location-results");
    const selectedEl = document.getElementById("setup-selected");
    const selectedName = document.getElementById("setup-selected-name");
    const continueBtn = document.getElementById("setup-continue");
    const skipBtn = document.getElementById("setup-skip");
    overlay.classList.remove("hidden");
    let searchTimeout2 = null;
    let pending = null;
    function hideResults2() {
      resultsEl.classList.add("hidden");
      resultsEl.innerHTML = "";
    }
    async function search(query) {
      resultsEl.classList.remove("hidden");
      resultsEl.innerHTML = '<div class="location-result-item loading">Searching...</div>';
      try {
        const q = encodeURIComponent(query);
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=us&addressdetails=1`,
          { headers: { "User-Agent": "DesktopEAS/1.0" } }
        );
        const results = await resp.json();
        if (results.length === 0) {
          resultsEl.innerHTML = '<div class="location-result-item loading">No results found</div>';
          return;
        }
        resultsEl.innerHTML = "";
        for (const r of results) {
          const name = r.display_name;
          const lat = parseFloat(r.lat);
          const lng = parseFloat(r.lon);
          const stateName = r.address?.state;
          const stateCode = r.address?.["ISO3166-2-lvl4"];
          let stateFips;
          if (stateName) stateFips = stateToFips(stateName);
          if (!stateFips && stateCode) stateFips = stateToFips(stateCode.replace("US-", ""));
          const item = document.createElement("div");
          item.className = "location-result-item";
          item.textContent = name;
          item.addEventListener("click", () => {
            pending = { name, lat, lng, stateFips };
            selectedName.textContent = name;
            selectedEl.classList.remove("hidden");
            hideResults2();
            input.value = name;
          });
          resultsEl.appendChild(item);
        }
      } catch {
        resultsEl.innerHTML = '<div class="location-result-item loading">Search failed</div>';
      }
    }
    input.addEventListener("input", () => {
      if (searchTimeout2) clearTimeout(searchTimeout2);
      const query = input.value.trim();
      if (query.length < 2) {
        hideResults2();
        return;
      }
      searchTimeout2 = setTimeout(() => search(query), 350);
    });
    continueBtn.addEventListener("click", async () => {
      if (pending) {
        await window.easAPI.saveSettings({ location: pending });
        await initSettings();
      }
      overlay.classList.add("hidden");
      resolve();
    });
    skipBtn.addEventListener("click", () => {
      overlay.classList.add("hidden");
      resolve();
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".setup-search-wrap")) hideResults2();
    });
  });
}
async function init() {
  await initSettings();
  const settings = getLocalSettings();
  if (!settings.location) {
    await showSetup();
  }
  initTabs();
  setOnSettingsChanged(() => refreshDisplay());
  window.easAPI.onAlertsUpdate((alerts2) => processAlerts(alerts2));
  const alerts = await window.easAPI.getAlerts();
  if (alerts && alerts.length > 0) {
    processAlerts(alerts);
  }
  document.getElementById("alert-detail").addEventListener("click", (e) => {
    if (e.target.id === "alert-detail") {
      hideDetail();
    }
  });
}
init();
