import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import log from 'electron-log/main'
import { openImportWindow } from './importWindow'

let tray: Electron.Tray | null = null

export function createTray(mainWindow: Electron.BrowserWindow): Electron.Tray {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'resources', 'icon.png')
    : join(__dirname, '../../resources/icon.png')

  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    log.warn('Tray icon not found, using fallback')
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAANklEQVR4nGNgGLyg6v9/FEyGxi1omAiDsGvENIg2BhCnGY8hw8CAgY8FVEPITEjYDSJRI70BAIlX/REcJpYbAAAAAElFTkSuQmCC'
    )
  } else {
    icon = icon.resize({ width: 16, height: 16 })
  }

  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开晓园 Vault',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      }
    },
    {
      label: '快速导入文件...',
      click: () => {
        openImportWindow(mainWindow)
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        (app as any).isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('晓园 Vault')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  tray.on('double-click', () => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  log.info('Tray created')
  return tray
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
