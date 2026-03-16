import { l as leafletSrcExports } from "./leaflet-BlAy2-mF.js";
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString("en-US", {
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
function getTextByType(texts, type, lang = "English") {
  const t = texts.find((t2) => t2.type === type && t2.language === lang);
  return t ? t.value : null;
}
function getAreaDescription(areas) {
  const desc = areas.find((a) => a.type === "area_description");
  return desc ? String(desc.value) : "Unknown area";
}
function parseCircle(value) {
  if (typeof value === "string") {
    const m = value.match(/^\s*([-\d.]+)\s*,\s*([-\d.]+)\s+([-\d.]+)\s*$/);
    if (m) {
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]), r = parseFloat(m[3]);
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(r)) return { center: [lat, lng], radiusMeters: r * 1e3 };
    }
    const s = value.match(/^\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*$/);
    if (s) {
      const lat = parseFloat(s[1]), lng = parseFloat(s[2]), r = parseFloat(s[3]);
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(r)) return { center: [lat, lng], radiusMeters: r * 1e3 };
    }
  }
  if (Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === "number")) {
    return { center: [value[0], value[1]], radiusMeters: value[2] * 1e3 };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value.center && typeof value.center === "object") {
      const lat2 = value.center.lat ?? value.center.latitude;
      const lng2 = value.center.lng ?? value.center.lon ?? value.center.longitude;
      const r2 = value.radius ?? value.radius_km;
      if (typeof lat2 === "number" && typeof lng2 === "number" && typeof r2 === "number")
        return { center: [lat2, lng2], radiusMeters: r2 * 1e3 };
    }
    const lat = value.lat ?? value.latitude;
    const lng = value.lng ?? value.lon ?? value.longitude;
    const r = value.radius ?? value.radius_km;
    if (typeof lat === "number" && typeof lng === "number" && typeof r === "number")
      return { center: [lat, lng], radiusMeters: r * 1e3 };
  }
  return null;
}
async function geocodeDescription(description) {
  try {
    const q = encodeURIComponent(description.split(";")[0].trim());
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`,
      { headers: { "User-Agent": "EASViewer/1.0" } }
    );
    const results = await resp.json();
    if (results.length > 0) return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
  } catch {
  }
  return null;
}
function renderAlert(alert) {
  const severity = alert.severity || "Unknown";
  const color = getSeverityColor(severity);
  const areas = alert.areas || [];
  const texts = alert.texts || [];
  const badge = document.getElementById("popup-severity-badge");
  badge.textContent = severity;
  badge.style.background = color;
  document.getElementById("popup-event").textContent = alert.event || "Emergency Alert";
  document.getElementById("popup-area").innerHTML = `<span class="popup-label">AREA</span> ${escapeHtml(getAreaDescription(areas))}`;
  const meta = document.getElementById("popup-meta");
  meta.innerHTML = `
    <div class="popup-meta-item">
      <span class="popup-label">SENDER</span>
      <span>${escapeHtml(alert.sender || "Unknown")}</span>
    </div>
    <div class="popup-meta-item">
      <span class="popup-label">URGENCY</span>
      <span>${escapeHtml(alert.urgency || "Unknown")}</span>
    </div>
    <div class="popup-meta-item">
      <span class="popup-label">EXPIRES</span>
      <span>${formatTime(alert.expires)}</span>
    </div>
  `;
  const instruction = getTextByType(texts, "cmac_short_text") || getTextByType(texts, "cap_instruction");
  const instrEl = document.getElementById("popup-instruction");
  if (instruction) {
    instrEl.textContent = instruction;
    instrEl.style.display = "block";
  } else {
    instrEl.style.display = "none";
  }
  initMap(areas, color);
}
async function initMap(areas, color) {
  document.getElementById("popup-map");
  const map = leafletSrcExports.map("popup-map", {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false
  });
  leafletSrcExports.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18
  }).addTo(map);
  const allBounds = [];
  for (const area of areas) {
    if (area.type === "polygon" && Array.isArray(area.value)) {
      const latLngs = area.value.map(
        ([lat, lng]) => [lat, lng]
      );
      const polygon = leafletSrcExports.polygon(latLngs, {
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.3
      }).addTo(map);
      allBounds.push(polygon.getBounds());
    } else if (area.type === "circle") {
      const circle = parseCircle(area.value);
      if (circle) {
        const circleBounds = leafletSrcExports.latLng(circle.center).toBounds(circle.radiusMeters * 2);
        allBounds.push(circleBounds);
        leafletSrcExports.circle(circle.center, {
          radius: circle.radiusMeters,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.3
        }).addTo(map);
      }
    }
  }
  if (allBounds.length > 0) {
    let combined = allBounds[0];
    for (let i = 1; i < allBounds.length; i++) {
      combined = combined.extend(allBounds[i]);
    }
    map.fitBounds(combined, { padding: [20, 20] });
  } else {
    const desc = getAreaDescription(areas);
    const coords = await geocodeDescription(desc);
    if (coords) {
      map.setView(coords, 9);
      leafletSrcExports.circleMarker(coords, {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.5,
        weight: 2
      }).addTo(map);
    } else {
      map.setView([39.8, -98.5], 4);
    }
  }
  setTimeout(() => map.invalidateSize(), 50);
}
function playAlertSound(volume) {
  return new Promise((resolve) => {
    if (volume <= 0) {
      resolve();
      return;
    }
    const audio = new Audio("/alert.mp3");
    audio.volume = volume / 100;
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.play().catch(() => resolve());
  });
}
function cleanTextForTts(raw) {
  return raw.replace(/^[A-Z]{4,}\s*/m, "").replace(/^\s*\*\s*/gm, "").replace(/\b(\d{1,2})(\d{2})\s*(AM|PM)\b/gi, "$1:$2 $3").replace(/\bNWS\b/g, "National Weather Service").replace(/\bCDT\b/g, "Central Daylight Time").replace(/\bCST\b/g, "Central Standard Time").replace(/\bEDT\b/g, "Eastern Daylight Time").replace(/\bEST\b/g, "Eastern Standard Time").replace(/\bMDT\b/g, "Mountain Daylight Time").replace(/\bMST\b/g, "Mountain Standard Time").replace(/\bPDT\b/g, "Pacific Daylight Time").replace(/\bPST\b/g, "Pacific Standard Time").replace(/\bmph\b/gi, "miles per hour").replace(/\bAL\b(?=[\s,.])/g, "Alabama").replace(/\bAK\b(?=[\s,.])/g, "Alaska").replace(/\bAZ\b(?=[\s,.])/g, "Arizona").replace(/\bAR\b(?=[\s,.])/g, "Arkansas").replace(/\bCA\b(?=[\s,.])/g, "California").replace(/\bCO\b(?=[\s,.])/g, "Colorado").replace(/\bCT\b(?=[\s,.])/g, "Connecticut").replace(/\bDE\b(?=[\s,.])/g, "Delaware").replace(/\bFL\b(?=[\s,.])/g, "Florida").replace(/\bGA\b(?=[\s,.])/g, "Georgia").replace(/\bHI\b(?=[\s,.])/g, "Hawaii").replace(/\bID\b(?=[\s,.])/g, "Idaho").replace(/\bIL\b(?=[\s,.])/g, "Illinois").replace(/\bIN\b(?=[\s,.])/g, "Indiana").replace(/\bIA\b(?=[\s,.])/g, "Iowa").replace(/\bKS\b(?=[\s,.])/g, "Kansas").replace(/\bKY\b(?=[\s,.])/g, "Kentucky").replace(/\bLA\b(?=[\s,.])/g, "Louisiana").replace(/\bME\b(?=[\s,.])/g, "Maine").replace(/\bMD\b(?=[\s,.])/g, "Maryland").replace(/\bMA\b(?=[\s,.])/g, "Massachusetts").replace(/\bMI\b(?=[\s,.])/g, "Michigan").replace(/\bMN\b(?=[\s,.])/g, "Minnesota").replace(/\bMS\b(?=[\s,.])/g, "Mississippi").replace(/\bMO\b(?=[\s,.])/g, "Missouri").replace(/\bMT\b(?=[\s,.])/g, "Montana").replace(/\bNE\b(?=[\s,.])/g, "Nebraska").replace(/\bNV\b(?=[\s,.])/g, "Nevada").replace(/\bNH\b(?=[\s,.])/g, "New Hampshire").replace(/\bNJ\b(?=[\s,.])/g, "New Jersey").replace(/\bNM\b(?=[\s,.])/g, "New Mexico").replace(/\bNY\b(?=[\s,.])/g, "New York").replace(/\bNC\b(?=[\s,.])/g, "North Carolina").replace(/\bND\b(?=[\s,.])/g, "North Dakota").replace(/\bOH\b(?=[\s,.])/g, "Ohio").replace(/\bOK\b(?=[\s,.])/g, "Oklahoma").replace(/\bOR\b(?=[\s,.])/g, "Oregon").replace(/\bPA\b(?=[\s,.])/g, "Pennsylvania").replace(/\bRI\b(?=[\s,.])/g, "Rhode Island").replace(/\bSC\b(?=[\s,.])/g, "South Carolina").replace(/\bSD\b(?=[\s,.])/g, "South Dakota").replace(/\bTN\b(?=[\s,.])/g, "Tennessee").replace(/\bTX\b(?=[\s,.])/g, "Texas").replace(/\bUT\b(?=[\s,.])/g, "Utah").replace(/\bVT\b(?=[\s,.])/g, "Vermont").replace(/\bVA\b(?=[\s,.])/g, "Virginia").replace(/\bWA\b(?=[\s,.])/g, "Washington").replace(/\bWV\b(?=[\s,.])/g, "West Virginia").replace(/\bWI\b(?=[\s,.])/g, "Wisconsin").replace(/\bWY\b(?=[\s,.])/g, "Wyoming").replace(/\.{2,}/g, ",").replace(/^[\s\-_=]+$/gm, "").replace(/\n{2,}/g, ". ").replace(/\n/g, " ").replace(/[^\w\s.,;:!?'"\-()/%°]/g, "").replace(/\s{2,}/g, " ").trim();
}
function getVoicesReady() {
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);
  return new Promise((resolve) => {
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
    setTimeout(() => resolve(speechSynthesis.getVoices()), 1e3);
  });
}
async function speakDescription(alert, tts) {
  if (!tts?.enabled) return;
  const texts = alert.texts || [];
  const desc = getTextByType(texts, "cap_description");
  if (!desc) return;
  const cleaned = cleanTextForTts(desc);
  if (!cleaned) return;
  await window.popupAPI.showCaption();
  const utter = new SpeechSynthesisUtterance(cleaned);
  utter.rate = tts.rate ?? 1;
  utter.pitch = tts.pitch ?? 1;
  utter.volume = (tts.volume ?? 80) / 100;
  if (tts.voice) {
    const voices = await getVoicesReady();
    const v = voices.find((v2) => v2.name === tts.voice);
    if (v) utter.voice = v;
  }
  const MAX_LINE = 60;
  const allWords = cleaned.split(/\s+/);
  const lines = [];
  let line = "";
  let lineStart = 0;
  let charPos = 0;
  for (const word of allWords) {
    const wordStart = cleaned.indexOf(word, charPos);
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > MAX_LINE && line) {
      lines.push({ text: line, startChar: lineStart });
      line = word;
      lineStart = wordStart;
    } else {
      if (!line) lineStart = wordStart;
      line = candidate;
    }
    charPos = wordStart + word.length;
  }
  if (line) lines.push({ text: line, startChar: lineStart });
  let currentLineIdx = 0;
  if (lines.length > 0) {
    window.popupAPI.sendCaptionText(lines[0].text);
  }
  utter.onboundary = (e) => {
    if (e.name === "word" || e.name === "sentence") {
      for (let i = currentLineIdx + 1; i < lines.length; i++) {
        if (e.charIndex >= lines[i].startChar) {
          currentLineIdx = i;
          window.popupAPI.sendCaptionText(lines[i].text);
        } else {
          break;
        }
      }
    }
  };
  utter.onend = () => {
    window.popupAPI.clearCaption();
    setTimeout(() => window.popupAPI.closeCaption(), 500);
    window.popupAPI.finished();
  };
  utter.onerror = () => {
    window.popupAPI.clearCaption();
    window.popupAPI.closeCaption();
    window.popupAPI.finished();
  };
  speechSynthesis.speak(utter);
}
document.getElementById("popup-dismiss").addEventListener("click", () => {
  speechSynthesis.cancel();
  window.popupAPI.closeCaption();
  window.popupAPI.dismiss();
});
async function initPopup() {
  const data = await window.popupAPI.getData();
  if (!data) return;
  renderAlert(data.alert);
  requestAnimationFrame(() => {
    const height = document.getElementById("popup").scrollHeight;
    window.popupAPI.resize(height);
  });
  await playAlertSound(data.volume);
  if (!data.tts?.enabled) {
    window.popupAPI.finished();
  } else {
    speakDescription(data.alert, data.tts);
  }
}
initPopup();
