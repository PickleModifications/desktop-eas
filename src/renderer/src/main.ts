import { renderAlerts } from './alerts'
import { hideDetail } from './alert-detail'
import { initSettings, getLocalSettings, setOnSettingsChanged, stateToFips } from './settings'
import './styles.css'

// Reveal body after CSS is applied (inline style hides it to prevent FOUC)
document.body.style.opacity = '1'

declare global {
  interface Window {
    easAPI: {
      onAlertsUpdate: (callback: (alerts: any[]) => void) => void
      getAlerts: () => Promise<any[]>
      getSettings: () => Promise<any>
      saveSettings: (updated: Record<string, unknown>) => Promise<any>
      demoPopup: () => Promise<void>
    }
  }
}

const statusEl = document.getElementById('status')!
const alertListEl = document.getElementById('alert-list')!
const settingsViewEl = document.getElementById('settings-view')!

let allAlerts: any[] = []

function updateStatus(count: number): void {
  if (count === 0) {
    statusEl.textContent = 'No active alerts'
  } else {
    statusEl.textContent = `${count} active alert${count !== 1 ? 's' : ''}`
  }
}

/**
 * Haversine distance in km between two [lat, lng] points.
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Check if a point is inside a polygon using ray casting.
 */
function pointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]
    const [yj, xj] = polygon[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Filter alerts based on user's location setting.
 * An alert is relevant if:
 *  - It has a polygon that contains the user's location (or centroid within 50km)
 *  - It has a circle that encompasses the user's location
 *  - It has no geometry but shares the user's state FIPS code
 */
function filterByLocation(alerts: any[]): any[] {
  const settings = getLocalSettings()
  if (!settings.location) return alerts

  const { lat, lng, stateFips } = settings.location

  // No state-level specificity (e.g. "United States") — show all alerts
  if (!stateFips) return alerts

  const PROXIMITY_KM = 50

  return alerts.filter((alert) => {
    const areas: any[] = alert.areas || []
    const polygons = areas.filter((a: any) => a.type === 'polygon' && Array.isArray(a.value))
    const circles = areas.filter((a: any) => a.type === 'circle' && a.value)
    const alertStates = areas
      .filter((a: any) => a.type === 'state')
      .map((a: any) => String(a.value))

    // First gate: alert must be in the user's state
    if (alertStates.length > 0 && !alertStates.includes(stateFips)) {
      return false
    }

    // If alert has no geometry, state match is sufficient
    if (polygons.length === 0 && circles.length === 0) {
      return alertStates.length > 0
    }

    // Check polygons — inside or within proximity of centroid
    for (const p of polygons) {
      if (pointInPolygon(lat, lng, p.value)) return true
      const coords: number[][] = p.value
      const centLat = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length
      const centLng = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length
      if (haversineKm(lat, lng, centLat, centLng) <= PROXIMITY_KM) return true
    }

    // Check circles
    for (const c of circles) {
      let cLat: number | undefined, cLng: number | undefined, radiusKm: number | undefined
      const v = c.value
      if (v && typeof v === 'object' && v.center) {
        cLat = v.center.lat ?? v.center.latitude
        cLng = v.center.lng ?? v.center.lon ?? v.center.longitude
        radiusKm = v.radius ?? v.radius_km
      } else if (typeof v === 'string') {
        const m = v.match(/^\s*([-\d.]+)\s*,\s*([-\d.]+)\s+([-\d.]+)\s*$/)
        if (m) {
          cLat = parseFloat(m[1])
          cLng = parseFloat(m[2])
          radiusKm = parseFloat(m[3])
        }
      }
      if (cLat != null && cLng != null && radiusKm != null) {
        if (haversineKm(lat, lng, cLat, cLng) <= radiusKm) return true
      }
    }

    return false
  })
}

function processAlerts(alerts: any[]): void {
  allAlerts = alerts
  refreshDisplay()
}

function refreshDisplay(): void {
  const settings = getLocalSettings()
  const filtered = settings.alertsEnabled ? filterByLocation(allAlerts) : []
  updateStatus(filtered.length)
  renderAlerts(filtered)
}

// Tab navigation
function initTabs(): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('#tabs .tab')
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'))
      tab.classList.add('active')

      const target = tab.dataset.tab
      if (target === 'alerts') {
        alertListEl.classList.remove('hidden')
        settingsViewEl.classList.add('hidden')
      } else if (target === 'settings') {
        alertListEl.classList.add('hidden')
        settingsViewEl.classList.remove('hidden')
      }
    })
  })
}

// --- First-time setup ---

interface PendingLocation {
  name: string
  lat: number
  lng: number
  stateFips?: string
}

function showSetup(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.getElementById('setup-overlay')!
    const input = document.getElementById('setup-location-input') as HTMLInputElement
    const resultsEl = document.getElementById('setup-location-results')!
    const selectedEl = document.getElementById('setup-selected')!
    const selectedName = document.getElementById('setup-selected-name')!
    const continueBtn = document.getElementById('setup-continue')!
    const skipBtn = document.getElementById('setup-skip')!

    overlay.classList.remove('hidden')

    let searchTimeout: ReturnType<typeof setTimeout> | null = null
    let pending: PendingLocation | null = null

    function hideResults(): void {
      resultsEl.classList.add('hidden')
      resultsEl.innerHTML = ''
    }

    async function search(query: string): Promise<void> {
      resultsEl.classList.remove('hidden')
      resultsEl.innerHTML = '<div class="location-result-item loading">Searching...</div>'
      try {
        const q = encodeURIComponent(query)
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5&countrycodes=us&addressdetails=1`,
          { headers: { 'User-Agent': 'DesktopEAS/1.0' } }
        )
        const results = await resp.json()
        if (results.length === 0) {
          resultsEl.innerHTML = '<div class="location-result-item loading">No results found</div>'
          return
        }
        resultsEl.innerHTML = ''
        for (const r of results) {
          const name = r.display_name as string
          const lat = parseFloat(r.lat)
          const lng = parseFloat(r.lon)
          const stateName = r.address?.state as string | undefined
          const stateCode = r.address?.['ISO3166-2-lvl4'] as string | undefined
          let stateFips: string | undefined
          if (stateName) stateFips = stateToFips(stateName)
          if (!stateFips && stateCode) stateFips = stateToFips(stateCode.replace('US-', ''))

          const item = document.createElement('div')
          item.className = 'location-result-item'
          item.textContent = name
          item.addEventListener('click', () => {
            pending = { name, lat, lng, stateFips }
            selectedName.textContent = name
            selectedEl.classList.remove('hidden')
            hideResults()
            input.value = name
          })
          resultsEl.appendChild(item)
        }
      } catch {
        resultsEl.innerHTML = '<div class="location-result-item loading">Search failed</div>'
      }
    }

    input.addEventListener('input', () => {
      if (searchTimeout) clearTimeout(searchTimeout)
      const query = input.value.trim()
      if (query.length < 2) { hideResults(); return }
      searchTimeout = setTimeout(() => search(query), 350)
    })

    continueBtn.addEventListener('click', async () => {
      if (pending) {
        await window.easAPI.saveSettings({ location: pending })
        await initSettings()
      }
      overlay.classList.add('hidden')
      resolve()
    })

    skipBtn.addEventListener('click', () => {
      overlay.classList.add('hidden')
      resolve()
    })

    document.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.setup-search-wrap')) hideResults()
    })
  })
}

// --- Main init ---

async function init(): Promise<void> {
  await initSettings()

  // Show first-time setup if no location is set
  const settings = getLocalSettings()
  if (!settings.location) {
    await showSetup()
  }

  initTabs()

  // Re-filter and re-render whenever settings change
  setOnSettingsChanged(() => refreshDisplay())

  // Listen for live updates
  window.easAPI.onAlertsUpdate((alerts) => processAlerts(alerts))

  // Fetch current data on startup (isInitial=true, don't play sound)
  const alerts = await window.easAPI.getAlerts()
  if (alerts && alerts.length > 0) {
    processAlerts(alerts)
  }

  // Click outside detail view to close
  document.getElementById('alert-detail')!.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'alert-detail') {
      hideDetail()
    }
  })
}

init()
