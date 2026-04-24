import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { initDatabase, searchFiles, getFileContent, saveFile, createFolder } from './services/database'
import { callQwenAI } from './services/qwen'

// Configure logging
log.initialize()
log.transports.file.level = 'info'

// Global exception handler
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error)
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    log.info('Main window ready')
  })

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC Handlers
function setupIpcHandlers(): void {
  // Vault operations
  ipcMain.handle('vault:open', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: '选择 Vault 文件夹'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const vaultPath = result.filePaths[0]
      await initDatabase(vaultPath)
      return vaultPath
    }
    return null
  })

  // File operations
  ipcMain.handle('file:list', async () => {
    return searchFiles('')
  })

  ipcMain.handle('file:search', async (_, query: string) => {
    return searchFiles(query)
  })

  ipcMain.handle('file:read', async (_, filePath: string) => {
    return getFileContent(filePath)
  })

  ipcMain.handle('file:save', async (_, filePath: string, content: string) => {
    return saveFile(filePath, content)
  })

  ipcMain.handle('folder:create', async (_, folderPath: string) => {
    return createFolder(folderPath)
  })

  // AI operations
  ipcMain.handle('ai:classify', async (_, content: string, folders: string[]) => {
    return callQwenAI('classify', { content, folders })
  })

  ipcMain.handle('ai:tags', async (_, content: string) => {
    return callQwenAI('tags', { content })
  })

  ipcMain.handle('ai:summary', async (_, content: string) => {
    return callQwenAI('summary', { content })
  })

  ipcMain.handle('ai:reason', async (_, question: string, context: string[]) => {
    return callQwenAI('reason', { question, context })
  })

  ipcMain.handle('ai:write', async (_, outline: string) => {
    return callQwenAI('write', { outline })
  })
}

app.whenReady().then(() => {
  log.info('App starting...')

  electronApp.setAppUserModelId('com.xiaoyuan.vault')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  log.info('All windows closed')
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
