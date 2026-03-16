import './caption-styles.css'

declare global {
  interface Window {
    captionAPI: {
      onText: (callback: (text: string) => void) => void
      onClear: (callback: () => void) => void
    }
  }
}

const captionEl = document.getElementById('caption')!

window.captionAPI.onText((text) => {
  captionEl.textContent = text
  captionEl.classList.add('visible')
})

window.captionAPI.onClear(() => {
  captionEl.classList.remove('visible')
  captionEl.textContent = ''
})
