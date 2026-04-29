import 'dotenv/config'
import { join } from 'path'
import { app, BrowserWindow, ipcMain, dialog, globalShortcut } from 'electron'
import { mkdir, readFile, writeFile, copyFile } from 'fs/promises'
import { existsSync } from 'fs'
import { basename } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { createTray, destroyTray } from './tray'
import { openImportWindow } from './importWindow'
import { initDatabase, searchFiles, getFileContent, saveFile, createFolder, listVaultFiles, renameFile, deleteFile, deleteFolder, moveFile, getVaultPath } from './services/database'
import { enrichFile, enrichInbox, enrichFileWithConfirmation, loadFolderMap, saveFolderMap } from './services/enrich'
import { queryVault } from './services/query'
import { runMaintenance } from './services/maintain'
import { resolveContentType } from './services/resolver'
import { startAutoAIEngine, stopAutoAIEngine, readAutoAISettings, writeAutoAISettings } from './services/autoAIEngine'
import { callAI } from './services/aiService'
import { convertWithJS, canConvertWithJS, needsMarkitdownConversion, getSupportedExtensions, canTranscribeAudio } from './services/converters'
import { showBubble, hideBubble, setVaultPath } from './services/clipboard'
import { askQuestion, createSession, loadSessions, deleteSession, loadMessages, saveMessages } from './services/chat'
import { rebuildGraph, loadGraph } from './services/graph'
import { transcribeAudio } from './services/whisper'
import { generateFileTemplate } from './services/frontmatter'
import { fetchURL, saveURLToVault } from './services/urlFetch'

// Config file for persisting app state
const configPath = join(app.getPath('userData'), 'config.json')

async function readConfig(): Promise<Record<string, unknown>> {
  try {
    if (existsSync(configPath)) {
      return JSON.parse(await readFile(configPath, 'utf-8'))
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
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Background graph rebuild (OpenWiki-inspired: 5s delay)
function triggerGraphRebuild(): void {
  setTimeout(() => {
    rebuildGraph().then(r => {
      log.info(`[Graph] background rebuild: ${r.nodes} nodes, ${r.edges} edges`)
      mainWindow?.webContents.send('graph:updated', r)
    }).catch(e => log.error('[Graph] rebuild failed:', e.message))
  }, 5000)
}

// IPC Handlers
function setupIpcHandlers(): void {
  // File rename
  ipcMain.handle('file:rename', async (_, oldPath: string, newName: string) => {
    return renameFile(oldPath, newName)
  })

  // File move to another folder (newParentDir is relative to vault root, no leading slash)
  ipcMain.handle('file:move', async (_, filePath: string, newParentDir: string) => {
    return moveFile(filePath, newParentDir)
  })

  // File delete
  ipcMain.handle('file:delete', async (_, filePath: string) => {
    return deleteFile(filePath)
  })

  // Folder delete
  ipcMain.handle('folder:delete', async (_, folderPath: string) => {
    return deleteFolder(folderPath)
  })

  // Vault operations
  ipcMain.handle('vault:getLast', async () => {
    const config = await readConfig()
    const vaultPath = config.lastVaultPath as string | undefined
    if (vaultPath && existsSync(vaultPath)) {
      await initDatabase(vaultPath)
      await startAutoAIEngine()
      setVaultPath(vaultPath)
      showBubble(); triggerGraphRebuild()
      return vaultPath
    }
    return null
  })

  ipcMain.handle('vault:open', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: '选择 Vault 文件夹'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const vaultPath = result.filePaths[0]
      await initDatabase(vaultPath)
      await writeConfig({ lastVaultPath: vaultPath })
      await startAutoAIEngine()
      setVaultPath(vaultPath)
      showBubble(); triggerGraphRebuild()
      return vaultPath
    }
    return null
  })

  ipcMain.handle('vault:create', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '新建知识库',
      buttonLabel: '创建知识库',
      nameFieldStringValue: '我的知识库',
      properties: ['createDirectory']
    })
    if (!result.canceled && result.filePath) {
      const vaultPath = result.filePath
      await mkdir(vaultPath, { recursive: true })
      await initDatabase(vaultPath)
      await writeConfig({ lastVaultPath: vaultPath })
      await startAutoAIEngine()
      setVaultPath(vaultPath)
      showBubble(); triggerGraphRebuild()

      // Phase 0.5: 最小结构 - 目录通过AI和用户协商后创建
      await mkdir(join(vaultPath, '0-收集'), { recursive: true })

      // .raw/ 原始文件目录
      const rawDirs = ['文档', '截图', '来源']
      const rawPath = join(vaultPath, '.raw')
      for (const sub of rawDirs) {
        await mkdir(join(rawPath, sub), { recursive: true })
      }

      // RESOLVER.md - 不写死目录，只写判断逻辑
      await writeFile(join(vaultPath, 'RESOLVER.md'), `# 知识库决策树

> 任何知识入库前，AI必须先读此文件

## 决策流程

收到内容后，判断：

1. **是用户提问？**
   → 走 query 技能

2. **是外部文件/链接？**
   → 走 ingest 技能

3. **是待处理的新内容？**
   → 走 enrich 技能

### enrich 判断逻辑

enrich 判断内容类型（type）：
- 有人名 → 和用户协商 → type: person
- 有公司名 → 和用户协商 → type: company
- 有项目特征 → 和用户协商 → type: project
- 有会议特征 → 和用户协商 → type: meeting
- ...

**目录由 type 决定，不写死。**
**每次遇到新类型，和用户协商创建新目录。**

---

*本文件由 AI 维护，如有争议由人类裁决。*
`, 'utf-8')

      // schema.md - 双层页面规范
      await writeFile(join(vaultPath, 'schema.md'), `# 知识库规范

## 页面结构

每页分为上下两部分，以 \`---\` 分隔：

### 上方：编译真相（当前状态）

\`\`\`yaml
---
title: 页面标题
type: collection  # person / company / project / meeting / deal / concept / research / collection
status: active     # active / archived
summary: 一句话摘要
confidence: low    # high / medium / low
tags: []
openThreads:
  - [ ] 待确认创始人背景
seeAlso:
  - [[相关页面A]]
relationships:
  - type: invested_in
    target: 目标名称
    confidence: EXTRACTED  # EXTRACTED / INFERRED / AMBIGUOUS
    source: 来源
created: 2026-04-27
updated: 2026-04-27
---

## 基本信息
- 待补充...

## Open Threads
- [ ] 待补充...

## See Also
- [[相关页面]]

---   <!-- 分界线，以下永不修改 -->

## 时间线（Append-only）

## [2026-04-27] 创建 | 页面初始化
\`\`\`

### 下方：时间线（永不重写）
- 格式：\`## [日期] 操作类型 | 内容\`
- 只追加，不修改历史记录

## frontmatter 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| title | ✅ | 页面标题 |
| type | ✅ | 内容类型，决定存放位置 |
| status | ✅ | active=活跃，archived=归档 |
| summary | 建议 | 一句话摘要 |
| confidence | 建议 | 置信度 |
| tags | 建议 | 标签 |
| openThreads | 建议 | 待办事项 |
| seeAlso | 建议 | 关联页面 |
| relationships | 建议 | 关系抽取 |
| created | ✅ | 创建日期 |
| updated | ✅ | 更新日期 |

## 双链格式

使用 \`[[页面名称]]\` 进行双向链接。
AI 自动维护反向链接。

## Enrich 触发规则

每条信号（会议/邮件/网页/对话）自动触发 enrich，
不依赖人工想起更新。

## 目录弹性原则

**技能只看 type，不看目录路径。**
目录是 AI 和用户协商出来的，可调整。
调整目录时，AI 自动更新所有文件的 frontmatter.type。
`, 'utf-8')

      // index.md - 内容目录
      await writeFile(join(vaultPath, 'index.md'), `# 知识索引

> 本文件由 AI 自动维护，随内容变化更新

---

## 内容目录

目录随 AI 和用户协商逐步创建：

| 目录 | 类型 | 页数 |
|------|------|------|
| 0-收集 | collection | - |

---

## 活跃页面

（AI 自动更新）

`, 'utf-8')

      // log.md - 操作日志
      await writeFile(join(vaultPath, 'log.md'), `# 操作日志

> 格式：\`## [日期] 操作类型 | 内容\`

---

`, 'utf-8')

      return vaultPath
    }
    return null
  })


  ipcMain.handle('vault:clear', async () => {
    await writeConfig({})
    await stopAutoAIEngine()
    hideBubble()
    return true
  })

  ipcMain.handle('vault:path', async () => {
    return getVaultPath()
  })

  // Auto AI settings
  ipcMain.handle('autoAI:get', async () => {
    return await readAutoAISettings()
  })

  ipcMain.handle('autoAI:save', async (_, settings: any) => {
    await writeAutoAISettings(settings)
    if (settings.enabled) {
      await startAutoAIEngine()
    } else {
      await stopAutoAIEngine()
    }
    return true
  })

  // AI Provider settings
  ipcMain.handle('provider:get', async () => {
    return readAutoAISettings()?.then(s => s?.provider || 'qwen').catch(() => 'qwen')
  })
  ipcMain.handle('provider:set', async (_, provider: string) => {
    const settings = await readAutoAISettings() || { enabled: true, interval: 60, onClassify: true, onTags: true, onSummary: true }
    ;(settings as any).provider = provider
    await writeAutoAISettings(settings)
    return true
  })

  // File operations
  ipcMain.handle('file:list', async () => {
    return listVaultFiles()
  })

  ipcMain.handle('file:search', async (_, query: string) => {
    return searchFiles(query)
  })

  ipcMain.handle('file:read', async (_, filePath: string) => {
    return getFileContent(filePath)
  })

  ipcMain.handle('file:create', async (_, filePath: string, title: string, type?: string) => {
    const content = generateFileTemplate(title, type)
    return saveFile(filePath, content)
  })

  ipcMain.handle('file:save', async (_, filePath: string, content: string) => {
    return saveFile(filePath, content)
  })

  ipcMain.handle('file:import', async (_, vaultPath: string, filePaths: string[]) => {
    const rawDir = join(vaultPath, 'raw files')
    const mdDir = join(vaultPath, '0-收集')
    await mkdir(rawDir, { recursive: true })
    await mkdir(mdDir, { recursive: true })
    const results: Array<{ name: string; path: string; status: string; error?: string; converted?: boolean; mdPath?: string }> = []
    for (const filePath of filePaths) {
      try {
        const name = basename(filePath)
        const dest = join(rawDir, name)
        await copyFile(filePath, dest)

        // Try JS conversion for supported formats
        if (canConvertWithJS(filePath)) {
          try {
            const markdown = await convertWithJS(filePath)
            const mdName = name.replace(/\.[^.]+$/, '.md')
            const mdDest = join(mdDir, mdName)
            await writeFile(mdDest, markdown, 'utf-8')
            results.push({ name, path: dest, status: 'ok', converted: true, mdPath: mdDest })
            log.info(`[Import] JS converted: ${name} → ${mdName}`)
            // Auto-enrich: classify, tag, summarize the imported file
            enrichFile(mdDest).then(result => {
              if (result.success) log.info(`[Import] auto-enriched: ${mdName} → ${result.message}`)
            }).catch(e => log.warn(`[Import] enrich failed for ${mdName}:`, e.message))
          } catch (convErr: any) {
            log.warn(`[Import] JS conversion failed for ${name}, keeping raw only:`, convErr.message)
            results.push({ name, path: dest, status: 'ok', converted: false })
          }
        } else {
          results.push({ name, path: dest, status: 'ok', converted: false })
        }
      } catch (err: any) {
        log.error('Import error:', err)
        results.push({ name: basename(filePath), path: '', status: 'error', error: err.message })
      }
    }
    return results
  })

  ipcMain.handle('import:fetchUrl', async (_, url: string) => {
    try {
      const result = await fetchURL(url)
      return { title: result.title, content: result.content }
    } catch (err: any) {
      log.error('fetchUrl error:', err)
      throw new Error(err.message || '获取失败')
    }
  })

  ipcMain.handle('import:saveUrl', async (_, vaultPath: string, title: string, content: string) => {
    const rawDir = join(vaultPath, 'raw files')
    if (!existsSync(rawDir)) await mkdir(rawDir, { recursive: true })
    const safeName = title.replace(/[<>\/\|\s]/g, '_').slice(0, 100) + '.md'
    const dest = join(rawDir, safeName)
    await writeFile(dest, `# ${title}\n\n来源: ${vaultPath}\n\n${content}`, 'utf-8')
    return dest
  })

  // URL operations (new)
  ipcMain.handle('url:fetch', async (_, url: string) => {
    try {
      const result = await fetchURL(url)
      return result
    } catch (error) {
      log.error('URL fetch error:', error)
      throw error
    }
  })

  ipcMain.handle('url:save', async (_, url: string, vaultPath: string) => {
    try {
      const result = await fetchURL(url)
      const filePath = await saveURLToVault(url, vaultPath, result)
      
      // Auto-enrich after save
      try {
        await enrichFile(filePath)
      } catch (e) {
        log.warn('Auto-enrich failed for URL import:', e)
      }
      
      return filePath
    } catch (error) {
      log.error('URL save error:', error)
      throw error
    }
  })

  // Format converter handlers (P0-3 fix)
  ipcMain.handle('converter:convert', async (_, filePath: string) => {
    return convertWithJS(filePath)
  })
  ipcMain.handle('converter:supported', async () => {
    return getSupportedExtensions()
  })
  ipcMain.handle('converter:transcribe', async (_, filePath: string) => {
    if (!canTranscribeAudio(filePath)) return { success: false, error: '不支持的音频格式' }
    return { success: false, error: 'Whisper 模型未配置' }
  })

  ipcMain.handle('folder:create', async (_, folderPath: string) => {
    return createFolder(folderPath)
  })

  // AI operations
  ipcMain.handle('ai:classify', async (_, content: string, folders: string[]) => {
    return callAI('classify', { content, folders })
  })

  ipcMain.handle('ai:tags', async (_, content: string) => {
    return callAI('tags', { content })
  })

  ipcMain.handle('ai:summary', async (_, content: string) => {
    return callAI('summary', { content })
  })

  ipcMain.handle('ai:reason', async (_, question: string, context: string[]) => {
    return callAI('reason', { question, context })
  })

  ipcMain.handle('ai:write', async (_, outline: string) => {
    return callAI('write', { outline })
  })

  ipcMain.handle('resolver:classify', async (_, content: string, title?: string) => {
    return resolveContentType(content, title)
  })

  ipcMain.handle('enrich:file', async (_, filePath: string) => {
    return enrichFile(filePath)
  })

  ipcMain.handle('enrich:confirm', async (_, filePath: string, type: string, folder?: string) => {
    return enrichFileWithConfirmation(filePath, type, folder)
  })

  ipcMain.handle('enrich:inbox', async () => {
    return enrichInbox()
  })

  // Folder map (configurable type→folder mapping)
  ipcMain.handle('folderMap:load', async () => {
    return loadFolderMap()
  })
  ipcMain.handle('folderMap:save', async (_, map: Record<string, string>) => {
    await saveFolderMap(map)
    return true
  })

  ipcMain.handle('import:open', async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      openImportWindow(mainWindow)
      return true
    }
    return false
  })

  ipcMain.handle('query:vault', async (_, question: string) => {
    return queryVault(question)
  })

  // RAG Chat (OpenWiki Ask Sidebar inspired)
  ipcMain.handle('chat:ask', async (_, question: string, history: any[]) => {
    return askQuestion(question, history || [])
  })
  ipcMain.handle('chat:sessions', async () => {
    return loadSessions()
  })
  ipcMain.handle('chat:create', async (_, firstQuestion: string) => {
    return createSession(firstQuestion)
  })
  ipcMain.handle('chat:load', async (_, sessionId: string) => {
    return loadMessages(sessionId)
  })
  ipcMain.handle('chat:save', async (_, sessionId: string, messages: any[]) => {
    return saveMessages(sessionId, messages)
  })
  ipcMain.handle('chat:delete', async (_, sessionId: string) => {
    return deleteSession(sessionId)
  })

  ipcMain.handle('graph:rebuild', async () => {
    return rebuildGraph()
  })
  ipcMain.handle('graph:load', async () => {
    return loadGraph()
  })

  ipcMain.handle('maintain:run', async () => {
    return runMaintenance()
  })

  // Clipboard watcher
  ipcMain.handle('clipboard:start', async (_, vaultPath: string) => {
    setVaultPath(vaultPath)
    showBubble(); triggerGraphRebuild()
    return true
  })
  ipcMain.handle('clipboard:stop', async () => {
    hideBubble()
    return true
  })
  ipcMain.handle('clipboard:setVaultPath', async (_, vaultPath: string) => {
    setVaultPath(vaultPath)
    return true
  })
}

app.whenReady().then(() => {
  log.info('App starting...')

  electronApp.setAppUserModelId('com.xiaoyuan.vault')

  // Dock icon stays visible (app also shows in Dock, not just tray)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  setupIpcHandlers()
  createWindow()
  createTray(mainWindow!)

  // Global shortcuts
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send('shortcut:quick-switch')
    }
  })
  log.info('[GlobalShortcut] Cmd+Shift+O (show), Cmd+Shift+F (search) registered')

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
