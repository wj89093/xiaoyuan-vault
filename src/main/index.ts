import 'dotenv/config'

import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { app, BrowserWindow, globalShortcut } from 'electron'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { createTray } from './tray'
import { setMainWindowRef } from './mainWindowRef'
import { triggerGraphRebuild } from './graphUtils'
import { registerAuthHandlers } from './ipc/authHandlers'
import { registerChatHandlers } from './ipc/chatHandlers'
import { registerAIHandlers } from './ipc/aiHandlers'
import { registerURLHandlers } from './ipc/urlHandlers'
import { registerEnrichHandlers } from './ipc/enrichHandlers'
import { registerGraphHandlers } from './ipc/graphHandlers'
import { registerImportHandlers } from './ipc/importHandlers'
import { registerProviderHandlers } from './ipc/providerHandlers'
import { registerAutoAIHandlers } from './ipc/autoAIHandlers'
import { registerClipboardHandlers } from './ipc/clipboardHandlers'
import { registerConverterHandlers } from './ipc/converterHandlers'
import { registerQueryHandlers } from './ipc/queryHandlers'
import { registerResolverHandlers } from './ipc/resolverHandlers'
import { registerMaintainHandlers } from './ipc/maintainHandlers'
import { readConfig, writeConfig } from './services/database'
import { startAgentAdapter } from './services/agentAdapter'
import { registerFileHandlers } from './ipc/fileHandlers'
import { registerVaultHandlers } from './ipc/vaultHandlers'


// Config file for persisting app state
const configPath = join(app.getPath('userData'), 'config.json')

async function readConfig(): Promise<Record<string, unknown>> {
  try {
    if (existsSync(configPath)) {
      return JSON.parse(await readFile(configPath, 'utf-8')) as Record<string, unknown>
    }
  } catch {}
  return {}
}

async function writeConfig(data: Record<string, unknown>): Promise<void> {
  await writeFile(configPath, JSON.stringify(data, null, 2), 'utf-8')
}

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
    show: true,
    center: true,
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
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']).catch?.(() => {})
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  setMainWindowRef(mainWindow)
}



// IPC Handlers
function setupIpcHandlers(): void {
  // Modular IPC handlers (split by domain)
  registerFileHandlers()
  registerVaultHandlers()
  // remaining handlers: auth, chat, ai, url, enrich, graph, import, provider, autoAI, clipboard, converter, query, resolver, maintain
  registerAuthHandlers()
  registerChatHandlers()
  registerAIHandlers()
  registerURLHandlers()
  registerEnrichHandlers()
  registerGraphHandlers()
  registerImportHandlers()
  registerProviderHandlers()
  registerAutoAIHandlers()
  registerClipboardHandlers()
  registerConverterHandlers()
  registerQueryHandlers()
  registerResolverHandlers()
  registerMaintainHandlers()
}

// ─── URL Scheme 注册 ────────────────────────────────────────
app.setAsDefaultProtocolClient('xiaoyuan')

// 处理 xiaoyuan:// URL 回调（macOS）
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleAuthCallback(url)
})

void app.whenReady().then(() => {
  log.info('App starting...')

  electronApp.setAppUserModelId('com.xiaoyuan.vault')

  // Dock icon stays visible (app also shows in Dock, not just tray)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()
  startAgentAdapter().catch(e => log.warn('[AgentAdapter] start failed:', e))
  createWindow()
  createTray(mainWindow!)

  // Global shortcuts
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('shortcut:quick-switch')
    }
  })
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('shortcut:goto-import')
    }
  })
  log.info('[GlobalShortcut] Cmd+Shift+O (show), Cmd+Shift+F (search), Cmd+Shift+I (import) registered')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Prevent app from quitting when all windows closed (stay in tray)
app.on('window-all-closed', () => {
  log.info('All windows closed, staying in tray')
  // Do NOT quit - keep running in tray on all platforms
})

// Handle tray "退出" to allow clean quit via app.exit()
;(app as any).isQuitting = false

app.on('before-quit', (e) => {
  if (!(app as any).isQuitting) {
    e.preventDefault()
    log.info('Quit prevented, hiding to tray')
  }
})
