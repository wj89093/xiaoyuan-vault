import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import log from 'electron-log/main'
import { getVaultPath } from './services/database'

let importWindow: BrowserWindow | null = null

export function openImportWindow(parentWindow: BrowserWindow): void {
  if (importWindow) {
    importWindow.focus()
    return
  }

  const vaultPath = getVaultPath()
  if (!vaultPath) {
    if (!parentWindow.isDestroyed()) {
      parentWindow.show()
      parentWindow.focus()
    }
    return
  }

  // Hide main window while import window is open to avoid overlap
  parentWindow.hide()

  const win = new BrowserWindow({
    width: 360,
    height: 440,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Position near cursor
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const workArea = display.workArea
  const x = Math.min(cursor.x - 180, workArea.x + workArea.width - 370)
  const y = Math.max(workArea.y, cursor.y - 460)
  win.setPosition(x, y)

  win.on('closed', () => {
    importWindow = null
    if (!parentWindow.isDestroyed()) {
      parentWindow.show()
      // Notify renderer to refresh file list
      parentWindow.webContents.send('import:completed')
    }
  })

  // Load with hash for ImportApp route
  const hashPath = `file://${join(__dirname, '../renderer/index.html')}#/import`
  void win.loadURL(hashPath).catch?.(() => {})

  win.once('ready-to-show', () => {
    win.show()
    log.info('Import window shown')
  })

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    log.error('Import window failed to load:', code, desc)
  })

  importWindow = win
}

export function closeImportWindow(): void {
  if (importWindow) {
    importWindow.close()
    importWindow = null
  }
}
