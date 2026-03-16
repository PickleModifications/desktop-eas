import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron'
import { join } from 'path'

let tray: Tray | null = null

export function createTray(mainWindow: BrowserWindow): Tray {
  const iconPath = join(__dirname, '../../resources/icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Desktop EAS')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Desktop EAS',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        ;(app as any).isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  return tray
}

export function updateTrayTooltip(alertCount: number): void {
  if (tray) {
    tray.setToolTip(
      alertCount > 0 ? `Desktop EAS — ${alertCount} active alert${alertCount !== 1 ? 's' : ''}` : 'Desktop EAS — No active alerts'
    )
  }
}
