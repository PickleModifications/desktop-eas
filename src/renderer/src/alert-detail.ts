import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Alert {
  id: number
  event: string
  severity: string
  urgency: string
  certainty: string
  sender: string
  sent: string
  expires: string
  received: string
  last_modified: string
  is_cancelled: boolean
  is_out_of_date: boolean
  response_type: string
  status: string
  areas: { type: string; value: any }[]
  texts: { language: string; type: string; value: string }[]
}

// Parsed geometry types
interface PolygonGeo {
  kind: 'polygon'
  coords: [number, number][] // [lat, lng][]
}

interface CircleGeo {
  kind: 'circle'
  center: [number, number] // [lat, lng]
  radiusMeters: number
}

type AlertGeometry = PolygonGeo | CircleGeo

let currentMap: L.Map | null = null

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function getTextByType(texts: Alert['texts'], type: string, lang = 'English'): string | null {
  const t = texts.find((t) => t.type === type && t.language === lang)
  return t ? t.value : null
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'Extreme':
      return '#dc2626'
    case 'Severe':
      return '#ea580c'
    case 'Moderate':
      return '#ca8a04'
    case 'Minor':
      return '#2563eb'
    default:
      return '#6b7280'
  }
}

/**
 * Parse circle value from CAP format.
 * CAP circles can come as:
 *   - string: "lat,lng radius" (radius in km)
 *   - string: "lat lng radius"
 *   - object: { lat, lng, radius } or [lat, lng, radius]
 */
function parseCircle(value: any): CircleGeo | null {
  // String format: "38.47,-120.14 10" or "38.47 -120.14 10"
  if (typeof value === 'string') {
    // Try "lat,lng radius" first
    const commaMatch = value.match(
      /^\s*([-\d.]+)\s*,\s*([-\d.]+)\s+([-\d.]+)\s*$/
    )
    if (commaMatch) {
      const lat = parseFloat(commaMatch[1])
      const lng = parseFloat(commaMatch[2])
      const radiusKm = parseFloat(commaMatch[3])
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm)) {
        return { kind: 'circle', center: [lat, lng], radiusMeters: radiusKm * 1000 }
      }
    }
    // Try "lat lng radius" (space-separated)
    const spaceMatch = value.match(
      /^\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*$/
    )
    if (spaceMatch) {
      const lat = parseFloat(spaceMatch[1])
      const lng = parseFloat(spaceMatch[2])
      const radiusKm = parseFloat(spaceMatch[3])
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radiusKm)) {
        return { kind: 'circle', center: [lat, lng], radiusMeters: radiusKm * 1000 }
      }
    }
  }

  // Array format: [lat, lng, radius]
  if (Array.isArray(value) && value.length === 3 && value.every((v: any) => typeof v === 'number')) {
    return {
      kind: 'circle',
      center: [value[0], value[1]],
      radiusMeters: value[2] * 1000
    }
  }

  // Object format
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // WARN API format: { center: { latitude, longitude }, radius }
    if (value.center && typeof value.center === 'object') {
      const lat = value.center.lat ?? value.center.latitude
      const lng = value.center.lng ?? value.center.lon ?? value.center.longitude
      const r = value.radius ?? value.radius_km
      if (typeof lat === 'number' && typeof lng === 'number' && typeof r === 'number') {
        return { kind: 'circle', center: [lat, lng], radiusMeters: r * 1000 }
      }
    }
    // Flat format: { lat, lng, radius }
    const lat = value.lat ?? value.latitude
    const lng = value.lng ?? value.lon ?? value.longitude
    const r = value.radius ?? value.radius_km
    if (typeof lat === 'number' && typeof lng === 'number' && typeof r === 'number') {
      return { kind: 'circle', center: [lat, lng], radiusMeters: r * 1000 }
    }
  }

  return null
}

/**
 * Extract all drawable geometries from an alert's areas array.
 */
function extractGeometries(areas: Alert['areas']): AlertGeometry[] {
  const geometries: AlertGeometry[] = []

  for (const area of areas) {
    if (area.type === 'polygon' && Array.isArray(area.value)) {
      geometries.push({
        kind: 'polygon',
        coords: area.value as [number, number][]
      })
    } else if (area.type === 'circle') {
      const circle = parseCircle(area.value)
      if (circle) geometries.push(circle)
    }
  }

  return geometries
}

/**
 * Get area_description text for geocoding fallback when no geometry exists.
 */
function getAreaDescription(areas: Alert['areas']): string | null {
  const desc = areas.find((a) => a.type === 'area_description')
  return desc ? String(desc.value) : null
}

/**
 * Geocode an area description via Nominatim to get a fallback map center.
 */
async function geocodeDescription(description: string): Promise<[number, number] | null> {
  try {
    const q = encodeURIComponent(description.split(';')[0].trim())
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=us`,
      { headers: { 'User-Agent': 'EASViewer/1.0' } }
    )
    const results = await resp.json()
    if (results.length > 0) {
      return [parseFloat(results[0].lat), parseFloat(results[0].lon)]
    }
  } catch {
    // geocoding failed, ignore
  }
  return null
}

async function initMap(
  containerId: string,
  geometries: AlertGeometry[],
  severity: string,
  areaDescription: string | null
): Promise<void> {
  if (currentMap) {
    currentMap.remove()
    currentMap = null
  }

  const mapEl = document.getElementById(containerId)
  if (!mapEl) return

  const map = L.map(containerId, {
    zoomControl: true,
    scrollWheelZoom: true,
    dragging: true
  })
  currentMap = map

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map)

  const color = getSeverityColor(severity)
  const allBounds: L.LatLngBounds[] = []

  for (const geo of geometries) {
    if (geo.kind === 'polygon') {
      const latLngs: L.LatLngTuple[] = geo.coords.map(
        ([lat, lng]) => [lat, lng] as L.LatLngTuple
      )
      const polygon = L.polygon(latLngs, {
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.25
      }).addTo(map)
      allBounds.push(polygon.getBounds())
    } else if (geo.kind === 'circle') {
      // Compute bounds mathematically — L.circle.getBounds() requires
      // the map to already have a view/projection, which we haven't set yet.
      const circleBounds = L.latLng(geo.center).toBounds(geo.radiusMeters * 2)
      allBounds.push(circleBounds)

      L.circle(geo.center, {
        radius: geo.radiusMeters,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.25
      }).addTo(map)
    }
  }

  if (allBounds.length > 0) {
    // Fit to all drawn shapes
    let combined = allBounds[0]
    for (let i = 1; i < allBounds.length; i++) {
      combined = combined.extend(allBounds[i])
    }
    map.fitBounds(combined, { padding: [30, 30] })
  } else if (areaDescription) {
    // No polygon or circle data — geocode the area description
    const coords = await geocodeDescription(areaDescription)
    if (coords) {
      map.setView(coords, 9)
      L.circleMarker(coords, {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.5,
        weight: 2
      })
        .addTo(map)
        .bindPopup(areaDescription)
        .openPopup()
    } else {
      map.setView([39.8, -98.5], 4)
    }
  } else {
    map.setView([39.8, -98.5], 4)
  }

  setTimeout(() => map.invalidateSize(), 100)
}

export function showDetail(alert: Alert): void {
  const container = document.getElementById('alert-detail')!
  container.classList.remove('hidden')

  const areas = alert.areas
    .filter((a) => a.type === 'area_description')
    .map((a) => String(a.value))
    .join('; ')

  const description = getTextByType(alert.texts, 'cap_description')
  const instruction = getTextByType(alert.texts, 'cap_instruction')

  container.innerHTML = `
    <div class="detail-panel">
      <button class="detail-close" id="detail-close-btn">&times;</button>
      <h2 class="detail-event">${escapeHtml(alert.event)}</h2>

      <div id="detail-map" class="detail-map"></div>

      <div class="detail-grid">
        <div class="detail-field">
          <label>Severity</label>
          <span>${escapeHtml(alert.severity)}</span>
        </div>
        <div class="detail-field">
          <label>Urgency</label>
          <span>${escapeHtml(alert.urgency)}</span>
        </div>
        <div class="detail-field">
          <label>Certainty</label>
          <span>${escapeHtml(alert.certainty)}</span>
        </div>
        <div class="detail-field">
          <label>Response</label>
          <span>${escapeHtml(alert.response_type)}</span>
        </div>
        <div class="detail-field">
          <label>Status</label>
          <span>${escapeHtml(alert.status)}</span>
        </div>
        <div class="detail-field">
          <label>Sender</label>
          <span>${escapeHtml(alert.sender)}</span>
        </div>
      </div>

      <div class="detail-section">
        <label>Areas</label>
        <p>${escapeHtml(areas || 'Unknown')}</p>
      </div>

      <div class="detail-section">
        <label>Sent</label>
        <span>${formatTime(alert.sent)}</span>
        &nbsp;&bull;&nbsp;
        <label>Expires</label>
        <span>${formatTime(alert.expires)}</span>
      </div>

      ${
        description
          ? `<div class="detail-section">
              <label>Description</label>
              <pre class="detail-text">${escapeHtml(description)}</pre>
            </div>`
          : ''
      }

      ${
        instruction
          ? `<div class="detail-section">
              <label>Instructions</label>
              <pre class="detail-text">${escapeHtml(instruction)}</pre>
            </div>`
          : ''
      }

      ${alert.is_cancelled ? '<div class="alert-badge cancelled-badge">CANCELLED</div>' : ''}
      ${alert.is_out_of_date ? '<div class="alert-badge expired-badge">EXPIRED</div>' : ''}
    </div>
  `

  document.getElementById('detail-close-btn')!.addEventListener('click', hideDetail)

  const geometries = extractGeometries(alert.areas)
  const areaDesc = getAreaDescription(alert.areas)

  requestAnimationFrame(() => {
    initMap('detail-map', geometries, alert.severity, areaDesc)
  })
}

export function hideDetail(): void {
  if (currentMap) {
    currentMap.remove()
    currentMap = null
  }
  const container = document.getElementById('alert-detail')!
  container.classList.add('hidden')
  container.innerHTML = ''
}
