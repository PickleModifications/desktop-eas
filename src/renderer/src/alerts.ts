import { showDetail } from './alert-detail'

interface Alert {
  id: number
  event: string
  severity: string
  urgency: string
  sender: string
  sent: string
  expires: string
  is_cancelled: boolean
  is_out_of_date: boolean
  areas: { type: string; value: any }[]
  texts: { language: string; type: string; value: string }[]
}

function getSeverityClass(severity: string): string {
  switch (severity) {
    case 'Extreme':
      return 'severity-extreme'
    case 'Severe':
      return 'severity-severe'
    case 'Moderate':
      return 'severity-moderate'
    case 'Minor':
      return 'severity-minor'
    default:
      return 'severity-unknown'
  }
}

function getAreaDescription(areas: Alert['areas']): string {
  const desc = areas.find((a) => a.type === 'area_description')
  return desc ? String(desc.value) : 'Unknown area'
}

function getHeadline(texts: Alert['texts']): string {
  const headline = texts.find((t) => t.type === 'cap_headline' && t.language === 'English')
  return headline ? headline.value : ''
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  } catch {
    return iso
  }
}

export function renderAlerts(alerts: Alert[]): void {
  const container = document.getElementById('alert-list')!
  container.innerHTML = ''

  if (alerts.length === 0) {
    container.innerHTML = '<div class="no-alerts">No active alerts at this time.</div>'
    return
  }

  // Sort: most recent first
  const sorted = [...alerts].sort(
    (a, b) => new Date(b.sent).getTime() - new Date(a.sent).getTime()
  )

  for (const alert of sorted) {
    const card = document.createElement('div')
    card.className = `alert-card ${getSeverityClass(alert.severity)}`
    if (alert.is_cancelled) card.classList.add('cancelled')

    const headline = getHeadline(alert.texts)
    const area = getAreaDescription(alert.areas)

    card.innerHTML = `
      <div class="alert-card-header">
        <span class="alert-event">${escapeHtml(alert.event)}</span>
        <span class="alert-severity-badge">${escapeHtml(alert.severity)}</span>
      </div>
      <div class="alert-area">${escapeHtml(area)}</div>
      ${headline ? `<div class="alert-headline">${escapeHtml(headline)}</div>` : ''}
      <div class="alert-meta">
        <span class="alert-sender">${escapeHtml(alert.sender)}</span>
        <span class="alert-times">
          Sent: ${formatTime(alert.sent)} &bull; Expires: ${formatTime(alert.expires)}
        </span>
      </div>
      ${alert.is_cancelled ? '<div class="alert-badge cancelled-badge">CANCELLED</div>' : ''}
      ${alert.is_out_of_date ? '<div class="alert-badge expired-badge">EXPIRED</div>' : ''}
    `

    card.addEventListener('click', () => showDetail(alert))
    container.appendChild(card)
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
