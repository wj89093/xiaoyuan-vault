import { BrowserWindow, screen, ipcMain, BrowserWindow as BW } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { enrichFile } from './enrich'

let bubbleWindow: BrowserWindow | null = null
let cardWindow: BrowserWindow | null = null
let vaultPath = ''
let bubbleLocked = false
let savedPos = { x: -1, y: -1 }

// ============ Public API ============

export function setVaultPath(path: string): void {
  vaultPath = path
}

const BUBBLE_W = 64, BUBBLE_H = 64

/**
 * Show the floating bubble
 */
export function showBubble(): void {
  if (bubbleLocked) return
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.show()
    return
  }

  bubbleLocked = true

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const x = savedPos.x >= 0 ? savedPos.x : width - 80
  const y = savedPos.y >= 0 ? savedPos.y : height - 120

  ensureIPC()  // register IPC handlers before bubble starts sending events

  bubbleWindow = new BrowserWindow({
    width: BUBBLE_W, height: BUBBLE_H,
    x, y,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true, hasShadow: false,
    show: false,
    webPreferences: {
      sandbox: false,
      contextIsolation: false,
      nodeIntegration: true,
    },
  })

  // Load bubble HTML from local file so File.path is accessible in drag events
  bubbleWindow.loadURL(`data:text/html;charset=utf-8,${getBubbleHTML()}`)

  bubbleWindow.once('ready-to-show', () => {
    bubbleLocked = false
    bubbleWindow?.showInactive()
  })
  bubbleWindow.setVisibleOnAllWorkspaces(true)
  bubbleWindow.setAlwaysOnTop(true, 'floating')

  bubbleWindow.on('close', () => {
    // Save position before closing
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      const [px, py] = bubbleWindow.getPosition()
      savedPos = { x: px, y: py }
    }
  })

  bubbleWindow.on('closed', () => {
    bubbleWindow = null
    if (bubbleLocked) return
    respawnBubble()
  })
}

function getBubbleHTML(): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;overflow:hidden;user-select:none}
.bubble{
  width:48px;height:48px;border-radius:50%;
  background:#ffffff;
  position:absolute;top:8px;left:8px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 2px 12px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.04);
  transition:transform .15s,box-shadow .15s;
  color:#515154;
  cursor:pointer;
}
.bubble:hover{transform:scale(1.08);box-shadow:0 4px 20px rgba(0,0,0,0.12),0 0 0 1px rgba(0,122,255,0.15)}
.bubble.drag-over{transform:scale(1.15);box-shadow:0 0 0 3px #007aff,0 6px 24px rgba(0,122,255,0.2)}
</style></head><body>
<div class="bubble" id="bubble"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
<script>
var ipc = require('electron').ipcRenderer
var b = document.getElementById('bubble')

// Drag to move
var sx, sy, dragging = false, moved = false
b.addEventListener('mousedown', function(e) { sx=e.screenX; sy=e.screenY; dragging=true; moved=false; e.preventDefault() })
document.addEventListener('mousemove', function(e) {
  if(!dragging) return
  if(Math.abs(e.screenX-sx)>2||Math.abs(e.screenY-sy)>2) moved=true
  if(moved){
    ipc.send('bubble:move', e.screenX-sx, e.screenY-sy)
    sx=e.screenX; sy=e.screenY
  }
})
document.addEventListener('mouseup', function() { dragging=false })

// Click to expand (only if not dragged)
b.addEventListener('click', function() { if(!moved) ipc.send('bubble:expand') })

// File drop
document.addEventListener('dragover', function(e) {
  e.preventDefault(); e.stopPropagation();
  b.classList.add('drag-over');
  document.body.style.background = 'rgba(0,122,255,0.08)';
})
document.addEventListener('dragleave', function(e) {
  if (e.target === document.body || !document.body.contains(e.relatedTarget)) {
    b.classList.remove('drag-over');
    document.body.style.background = 'transparent';
  }
})
document.addEventListener('drop', function(e) {
  e.preventDefault(); e.stopPropagation();
  b.classList.remove('drag-over');
  document.body.style.background = 'transparent';
  var files = Array.from(e.dataTransfer.files || [])
  console.log('[Bubble renderer] drop dataTransfer.files length:', files.length)
  if (files.length === 0) {
    var types = e.dataTransfer.types;
    console.log('[Bubble renderer] dataTransfer types:', types);
    var txt = e.dataTransfer.getData('text/plain') || '';
    console.log('[Bubble renderer] text/plain data length:', txt.length);
    if (txt) { ipc.send('bubble:drop', { filePaths: [], text: txt }); }
    return;
  }
  var paths = files.map(function(f) { return f.path || '' }).filter(Boolean)
  console.log('[Bubble renderer] drop event, files:', files.length, 'paths:', paths)
  ipc.send('bubble:drop', { filePaths: paths, text: '' })
  // Visual feedback: flash green
  b.style.background = '#34c759';
  b.style.color = '#fff';
  setTimeout(function() {
    b.style.background = '#ffffff';
    b.style.color = '#515154';
  }, 600);
})
</script></body></html>`
}

function respawnBubble(): void {
  setTimeout(() => {
    try {
      bubbleLocked = false
      showBubble()
    } catch (e) {
      bubbleLocked = false
      console.warn('[Bubble] respawn failed:', e)
    }
  }, 800)
}

export function hideBubble(): void {
  bubbleLocked = true
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.close()
    bubbleWindow = null
  }
}

// ============ IPC handlers (registered once) ============

let ipcSetup = false
function ensureIPC(): void {
  if (ipcSetup) return
  ipcSetup = true

  ipcMain.on('bubble:expand', () => {
    if (bubbleWindow) {
      bubbleLocked = true  // prevent respawn while closing
      const pos = (() => {
        if (bubbleWindow && !bubbleWindow.isDestroyed()) {
          const [x, y] = bubbleWindow.getPosition()
          return { x: x + 32, y: y + 32 }
        }
        return screen.getCursorScreenPoint()
      })()
      bubbleWindow.close()
      bubbleWindow = null
      showCaptureCard(pos.x - 250, pos.y + 10)
    }
  })

  ipcMain.on('bubble:move', (_event, dx: number, dy: number) => {
    if (bubbleWindow && !bubbleWindow.isDestroyed()) {
      const [x, y] = bubbleWindow.getPosition()
      bubbleWindow.setPosition(x + dx, y + dy)
    }
  })


  ipcMain.handle('bubble:save', async (_event, data: { files: string[]; text: string }) => {
    console.log('[Bubble] bubble:save received:', JSON.stringify(data))
    try {
      const collectDir = join(vaultPath, '0-收集')
      if (!existsSync(collectDir)) await mkdir(collectDir, { recursive: true })

      if (data.files && data.files.length > 0) {
        const { copyFile } = await import('fs/promises')
        const { basename } = await import('path')
        for (const srcPath of data.files) {
          if (!existsSync(srcPath)) { console.log('[Bubble] file not found:', srcPath); continue }
          const dest = join(collectDir, basename(srcPath))
          await copyFile(srcPath, dest)
          enrichFile(dest).catch(() => {})
          console.log('[Bubble] copied:', srcPath, '->', dest)
        }
      }
      if (data.text) {
        await saveToVault(data.text)
      }
      console.log('[Bubble] bubble:save completed')
      return { ok: true }
    } catch (e) {
      console.error('[Bubble] bubble:save error:', e)
      return { ok: false, error: String(e) }
    }
  })

  ipcMain.on('bubble:drop', async (_event, data: { filePaths: string[]; text: string }) => {
    console.log('[Bubble] bubble:drop received:', JSON.stringify(data))
    if (!bubbleWindow) { console.log('[Bubble] no bubble window'); return }

    // vaultPath not set yet — open vault picker first
    if (!vaultPath) {
      const { dialog } = await import('electron')
      const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (result.canceled || !result.filePaths[0]) {
        console.log('[Bubble] vault picker cancelled')
        return
      }
      const p = result.filePaths[0]
      const { initDatabase } = await import('./database')
      const { writeConfig } = await import('../index')
      await initDatabase(p)
      await writeConfig({ lastVaultPath: p })
      setVaultPath(p)
      console.log('[Bubble] vaultPath set to:', p)
    }

    if (data.filePaths && data.filePaths.length > 0) {
      console.log('[Bubble] importing', data.filePaths.length, 'files')
      try {
        const result = await importFilesToVault(data.filePaths)
        console.log('[Bubble] import result:', result)
      } catch (e) {
        console.error('[Bubble] importFilesToVault error:', e)
      }
    }

    if (data.text) {
      const pos = bubbleWindow.isDestroyed() ? screen.getCursorScreenPoint() : (() => {
        const [x, y] = bubbleWindow.getPosition()
        return { x: x + 32, y: y + 32 }
      })()
      bubbleWindow.close()
      showCaptureCard(pos.x - 250, pos.y + 10, data)
    }
  })
}

function showCaptureCard(centerX: number, centerY: number, dropData?: { filePaths?: string[]; text?: string }): void {
  ensureIPC()

  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.focus()
    if (dropData) {
      cardWindow.webContents.executeJavaScript(`
        (function() {
          window.__bubblePaths = ${JSON.stringify(dropData.filePaths || [])};
          var fpl = window.__bubblePaths;
          var txt = ${JSON.stringify(dropData.text || '')};
          if (fpl.length) {
            var fl = document.getElementById('fileList');
            if (fl) { fl.style.display='block'; fl.innerHTML = fpl.map(function(n){return '<div class="item"><span class="icon">📄</span>'+n.split('/').pop()+'</div>'}).join(''); }
            var c = document.getElementById('content');
            var dh = document.getElementById('dzHint');
            if (c) { c.style.display='block'; c.value = fpl.map(function(n){return '📎 '+n.split('/').pop()}).join('\\n'); }
            if (dh) dh.style.display = 'none';
          }
          if (txt) {
            var c = document.getElementById('content');
            var dh = document.getElementById('dzHint');
            if (c) { c.style.display='block'; c.value = (c.value ? c.value+'\\n'+txt : txt); }
            if (dh) dh.style.display = 'none';
          }
        })()
      `).catch(() => {})
    }
    return
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.card{width:100%;padding:16px;background:#ffffff;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,0.12),0 0 0 1px rgba(0,0,0,0.06)}
.header{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.header-title{font-size:13px;font-weight:600;color:#1d1d1f;flex:1}
.header-hint{font-size:10px;color:#a1a1a6}
#dropzone{border:2px dashed #dcdcde;border-radius:10px;margin-bottom:10px;transition:border-color .2s,background .2s;min-height:80px}
#dropzone.drag-over{border-color:#007aff;background:rgba(0,122,255,0.04)}
.dz-hint{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:6px;color:#6e6e73;font-size:12px;pointer-events:none}
.dz-hint .icon{font-size:22px;opacity:0.6}
#content{width:100%;min-height:80px;padding:10px;background:transparent;border:none;outline:none;color:#1d1d1f;font-size:13px;line-height:1.5;resize:none;font-family:inherit;display:none}
#content::placeholder{color:#6e6e73}
.actions{display:flex;justify-content:flex-end;gap:6px}
.btn{padding:6px 16px;border-radius:8px;font-size:12px;font-weight:500;border:none;cursor:pointer;transition:all .15s}
.btn-primary{background:#007aff;color:#fff}.btn-primary:hover{background:#0071e3}
.btn-secondary{background:#f5f5f7;color:#6e6e73;border:1px solid #dcdcde}.btn-secondary:hover{background:#f0f0f2;color:#1d1d1f}
.file-list{display:none;font-size:11px;color:#6e6e73;padding:6px 10px;background:#f5f5f7;border-radius:8px;margin-bottom:10px}
.file-list .item{display:flex;align-items:center;gap:4px;padding:2px 0}
.file-list .icon{font-size:12px}
.saved-toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#34c759;color:#fff;padding:6px 16px;border-radius:16px;font-size:12px;font-weight:500;opacity:0;transition:opacity .3s;pointer-events:none}
.saved-toast.show{opacity:1}
</style></head><body>
<div class="card">
<div class="header">
  <span style="font-size:16px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3v4m0 6v4M5 12h4m6 0h4M3 21l1.5-4.5L9 15l4.5 1.5L15 21l1.5-4.5L21 15l-4.5-1.5L15 9l-1.5 4.5L9 9l-1.5 4.5L3 15l1.5 4.5L3 21z"/></svg></span>
  <span class="header-title">快速捕获</span>
  <span class="header-hint">点击悬浮球打开</span>
</div>
<div class="file-list" id="fileList"></div>
<div id="dropzone">
  <textarea id="content" placeholder="输入内容或粘贴链接..."></textarea>
  <div class="dz-hint" id="dzHint"><span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>点击输入文字，或拖拽文件/文字到此</div>
</div>
<div class="actions">
  <button class="btn btn-secondary" id="minimizeBtn">收起</button>
  <button class="btn btn-primary" id="saveBtn">⏎ 保存到 Vault</button>
</div>
</div>
<div class="saved-toast" id="toast">✅ 已保存到 0-收集/</div>
<script>
var dz = document.getElementById('dropzone')
var content = document.getElementById('content')
var hint = document.getElementById('dzHint')
var fileList = document.getElementById('fileList')
var toast = document.getElementById('toast')
var droppedFiles = []

// Init: inject bubble paths
if (window.__bubblePaths && window.__bubblePaths.length) {
  droppedFiles = window.__bubblePaths.map(function(n){return {name:n.split('/').pop(),path:n}})
  fileList.style.display='block'
  fileList.innerHTML = droppedFiles.map(function(f){return '<div class="item"><span class="icon">📄</span>'+f.name+'</div>'}).join('')
  content.style.display='block'; hint.style.display='none'
  content.value = droppedFiles.map(function(f){return '📎 '+f.name}).join('\\n')
}
var txt = ${JSON.stringify(dropData?.text || '')};
if (txt) { content.style.display='block'; hint.style.display='none'; content.value = (content.value ? content.value+'\\n'+txt : txt) }

// Click dropzone to type
dz.addEventListener('click', function() { content.style.display='block'; hint.style.display='none'; content.focus() })
content.addEventListener('input', function() {
  if (content.value.trim()) { hint.style.display='none' } else { content.style.display='none'; hint.style.display='flex' }
})

// Drag-drop into card
dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('drag-over') })
dz.addEventListener('dragleave', function() { dz.classList.remove('drag-over') })
dz.addEventListener('drop', function(e) {
  e.preventDefault(); dz.classList.remove('drag-over')
  if (e.dataTransfer.files.length > 0) {
    droppedFiles = Array.from(e.dataTransfer.files).map(function(f){return {name:f.name,path:f.path||''}})
    fileList.style.display='block'
    fileList.innerHTML = droppedFiles.map(function(f){return '<div class="item"><span class="icon">📄</span>'+f.name+'</div>'}).join('')
    content.style.display='block'; hint.style.display='none'
    if (!content.value.trim()) content.value = droppedFiles.map(function(f){return '📎 '+f.name}).join('\\n')
  }
  var dt = e.dataTransfer.getData('text/plain')
  if (dt) { content.style.display='block'; hint.style.display='none'; content.value = content.value ? content.value+'\\n'+dt : dt }
})

// Save — use invoke to call main process handler directly (avoids title-based IPC)
document.getElementById('saveBtn').addEventListener('click', async function() {
  var text = content.value.trim()
  if (!text && droppedFiles.length === 0) return
  var btn = document.getElementById('saveBtn')
  btn.textContent = '保存中...'; btn.disabled = true
  try {
    var api = window.api || require('electron').ipcRenderer
    await api.invoke('bubble:save', { files: droppedFiles, text: text })
    btn.textContent = '已保存!'
    setTimeout(function() { window.close() }, 500)
  } catch(e) {
    btn.textContent = '保存失败'; btn.disabled = false
    console.error('[Bubble card] save error:', e)
  }
})

// Minimize
document.getElementById('minimizeBtn').addEventListener('click', function() { window.close() })
</script></body></html>`

  cardWindow = new BrowserWindow({
    width: 400, height: 300,
    x: Math.max(0, centerX - 200), y: Math.max(0, centerY),
    frame: false, transparent: true,
    alwaysOnTop: false, resizable: false,
    skipTaskbar: true, hasShadow: true,
    webPreferences: {
      sandbox: false, contextIsolation: false,
      nodeIntegration: true,
    },
  })

  cardWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  cardWindow.setVisibleOnAllWorkspaces(true)

  let blurTimer: ReturnType<typeof setTimeout> | null = null
  // Disabled: blur-to-close causes premature close when card loses focus during save
  // cardWindow.on('blur', () => {
  //   blurTimer = setTimeout(() => {
  //     if (cardWindow && !cardWindow.isDestroyed()) cardWindow.close()
  //   }, 8000)
  // })
  // cardWindow.on('focus', () => {
  //   if (blurTimer) { clearTimeout(blurTimer); blurTimer = null }
  // })

  cardWindow.on('closed', async () => {
    if (blurTimer) clearTimeout(blurTimer)
    // Capture title BEFORE nulling the window reference
    const raw = cardWindow && !cardWindow.isDestroyed()
      ? cardWindow.webContents.getTitle()
      : ''
    cardWindow = null

    if (raw && raw.startsWith('SAVE:')) {
      try {
        const data = JSON.parse(raw.replace('SAVE:', ''))
        const allPaths = (data.files || []).map((f: any) => f.path).filter(Boolean)
        if (allPaths.length > 0) {
          const { rename } = await import('fs/promises')
          const { basename } = await import('path')
          const collectDir = join(vaultPath, '0-收集')
          if (!existsSync(collectDir)) await mkdir(collectDir, { recursive: true })
          for (const srcPath of allPaths) {
            if (!existsSync(srcPath)) continue
            const dest = join(collectDir, basename(srcPath))
            await rename(srcPath, dest).catch(async (renErr) => {
              if (renErr.code === 'EXDEV') {
                const { copyFile, unlink } = await import('fs/promises')
                await copyFile(srcPath, dest)
                await unlink(srcPath)
              } else throw renErr
            })
            enrichFile(dest).catch(() => {})
          }
        }
        if (data.text) await saveToVault(data.text)
      } catch (e) {
        console.error('[Bubble] cardWindow closed handler error:', e)
      }
    }
    respawnBubble()
  })
}

async function importFilesToVault(filePaths: string[]): Promise<{imported: number; vaultPath: string; collectDir: string}> {
  if (!vaultPath || !filePaths.length) {
    console.log('[Bubble] importFilesToVault: no vaultPath or empty filePaths', { vaultPath, filePaths })
    return { imported: 0, vaultPath, collectDir: '' }
  }
  console.log('[Bubble] importFilesToVault: starting', { vaultPath, filePaths })
  const collectDir = join(vaultPath, '0-收集')
  try {
    if (!existsSync(collectDir)) await mkdir(collectDir, { recursive: true })
    const { rename } = await import('fs/promises')
    const { basename } = await import('path')
    let imported = 0
    for (const srcPath of filePaths) {
      if (!existsSync(srcPath)) {
        console.log('[Bubble] file not found:', srcPath)
        continue
      }
      const dest = join(collectDir, basename(srcPath))
      await rename(srcPath, dest).catch(async (renErr) => {
        if (renErr.code === 'EXDEV') {
          const { copyFile, unlink } = await import('fs/promises')
          await copyFile(srcPath, dest)
          await unlink(srcPath)
        } else throw renErr
      })
      enrichFile(dest).catch(() => {})
      imported++
      console.log('[Bubble] copied:', srcPath, '->', dest)
    }
    console.log('[Bubble] Imported', imported, 'files to', collectDir)
    return { imported, vaultPath, collectDir }
  } catch (e) {
    console.error('[Bubble] importFilesToVault error:', e)
    return { imported: 0, vaultPath, collectDir }
  }
}

async function saveToVault(content: string): Promise<void> {
  if (!vaultPath) return
  const collectDir = join(vaultPath, '0-收集')
  if (!existsSync(collectDir)) await mkdir(collectDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const isURL = /^https?:\/\/[^\s]+$/i.test(content.trim())
  const prefix = isURL ? 'web' : 'clip'
  const filename = `${prefix}-${timestamp}.md`

  const title = content.split('\n')[0].slice(0, 50).replace(/["#*`\[\]]/g, '')
  const frontmatter = [
    '---', `title: "${title || '快速捕获'}"`,
    `type: ${isURL ? 'web-clip' : 'note'}`,
    `source: bubble-card`, `created: ${new Date().toISOString().slice(0, 10)}`,
    `tags: [quick-capture, ${isURL ? 'url' : 'note'}]`,
    '---', '', content,
  ].join('\n')

  const filePath = join(collectDir, filename)
  await writeFile(filePath, frontmatter, 'utf-8')
  enrichFile(filePath).catch(() => {})
  console.log('[Bubble] Saved:', filename)
}

// ============ Legacy stubs ============
export function startClipboardWatcher(): void {}
export function stopClipboardWatcher(): void {}
export function registerSpotlightShortcut(): void {}
export function unregisterSpotlightShortcut(): void {}
export function closeSpotlight(): void {}
