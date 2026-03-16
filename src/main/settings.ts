import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface UserLocation {
  name: string
  lat: number
  lng: number
  stateFips?: string
}

export interface TtsSettings {
  enabled: boolean
  voice: string // SpeechSynthesis voice name, empty = system default
  rate: number // 0.5–2.0
  pitch: number // 0–2
  volume: number // 0–100
}

export interface AppSettings {
  alertsEnabled: boolean
  alertVolume: number // 0–100
  location: UserLocation | null
  tts: TtsSettings
}

const DEFAULTS: AppSettings = {
  alertsEnabled: true,
  alertVolume: 75,
  location: null,
  tts: {
    enabled: true,
    voice: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 80
  }
}

let settings: AppSettings = { ...DEFAULTS }
let settingsPath = ''

export function initSettings(): void {
  settingsPath = join(app.getPath('userData'), 'settings.json')
  if (existsSync(settingsPath)) {
    try {
      const raw = readFileSync(settingsPath, 'utf-8')
      const parsed = JSON.parse(raw)
      settings = { ...DEFAULTS, ...parsed }
    } catch {
      settings = { ...DEFAULTS }
    }
  }
}

export function getSettings(): AppSettings {
  return { ...settings }
}

export function saveSettings(updated: Partial<AppSettings>): AppSettings {
  settings = { ...settings, ...updated }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
  return { ...settings }
}
