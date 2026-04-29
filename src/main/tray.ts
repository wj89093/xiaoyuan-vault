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
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEASURBVDiNpZM9SwNBEIafuZhEEkQsLAQ7C+xsLfwDFgtbG+xsrGxttNZGCwtbC2trY6GFjYWFhYggYmEhSCQXLm9jxmR3d3t2l0Q8gp+ZnZ2Z+Wb2LYSUEk3TGv9jW0oppZSIiBw+fPh4RFRV9T8tMzMzg+d5xWKx+Ke6q6qTEZGTJ0+enBKRuaOjow87O7uftra2Xgshxmq12k4p5WGMmZ6cnPxCRH4RkT8iotPpdLZWq7Xr9XpPJiLyr2IAW9u2/0gpV8+cOfO9v79/sl6v/9rZ2Xk3HA6fLy4u/mGM+S0lfwGj0ejJwcHBh3K5/Kler78dDofP+v3+48Fg8Kjb7T4ZDAaP2u32g3q9/mBmZuZBs9l80Gq1HjabrXv1ev1eq9W60+l0bjebzdutVutWu92+2W63b7Tb7evtdvt6u92+0Wq1rrVarWvt9v9Nq9W61mq1rjWbzWutVutqs9m82mw2r7ZarSvN5v9Nq9W63Wq2rrWarNq1Xy9Wq1Xq1Wq3Xq1X69Wq9Xa9Xq9Wq1Wq1Wq1XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5XK5'
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
