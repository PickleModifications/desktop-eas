import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          scraper: resolve(__dirname, 'src/preload/scraper.ts'),
          popup: resolve(__dirname, 'src/preload/popup.ts'),
          caption: resolve(__dirname, 'src/preload/caption.ts')
        }
      }
    }
  },
  renderer: {
    publicDir: resolve(__dirname, 'src/renderer/public'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          popup: resolve(__dirname, 'src/renderer/popup.html'),
          caption: resolve(__dirname, 'src/renderer/caption.html')
        }
      }
    }
  }
})
