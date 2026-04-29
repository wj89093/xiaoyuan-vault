import { BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { enrichFile } from './enrich'

let bubbleWindow: BrowserWindow | null = null
let cardWindow: BrowserWindow | null = null
let vaultPath = ''
let bubbleAction = '' // Communicates bubble → main before window closes
let cardAction = ''   // Communicates card → main before window closes
let bubbleLocked = false

// ============ Public API ============

export function setVaultPath(path: string): void {
  vaultPath = path
}

/**
 * Show the floating bubble (persistent, always-on-top)
 */
export function showBubble(): void {
  if (bubbleLocked) return
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.show()
    return
  }

  bubbleLocked = true

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const bubbleSize = 48

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;overflow:hidden;margin:0;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh}
.bubble{
  width:${bubbleSize}px;height:${bubbleSize}px;
  border-radius:50%;
  background:#ffffff;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 2px 12px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.04);
  transition:transform .2s,box-shadow .2s;
  font-size:22px;color:#515154;
  -webkit-app-region:no-drag;cursor:pointer;
}
.bubble:hover{transform:scale(1.08);box-shadow:0 4px 20px rgba(0,0,0,0.12),0 0 0 1px rgba(0,122,255,0.15)}
.bubble.drag-over{transform:scale(1.15);box-shadow:0 0 0 3px #007aff,0 6px 24px rgba(0,122,255,0.2)}
</style></head><body>
<div class="bubble" id="bubble"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
<script>
const bubble = document.getElementById('bubble')
bubble.addEventListener('click', () => { document.title = 'EXPAND'; window.close() })
document.addEventListener('dragover', e => { e.preventDefault(); bubble.classList.add('drag-over') })
document.addEventListener('dragleave', () => bubble.classList.remove('drag-over'))
document.addEventListener('drop', e => {
  e.preventDefault(); bubble.classList.remove('drag-over')
  const files = Array.from(e.dataTransfer.files || [])
  const text = e.dataTransfer.getData('text/plain')
  const uri = e.dataTransfer.getData('text/uri-list')
  const filePaths = files.map(f => (f as any).path || f.name).filter(Boolean)
  document.title = 'DROP:' + JSON.stringify({ filePaths, text:text?text.slice(0,200):'' })
  window.close()
})
</script></body></html>`

  bubbleWindow = new BrowserWindow({
    width: bubbleSize + 16, height: bubbleSize + 16,
    x: width - 80, y: height - 120,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true, hasShadow: false,
    show: false,
    webPreferences: {
      sandbox: false, contextIsolation: false,
      nodeIntegration: false,
    },
  })

  bubbleWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  bubbleWindow.once('ready-to-show', () => {
    bubbleLocked = false
    bubbleWindow?.showInactive()
  })
  bubbleWindow.setVisibleOnAllWorkspaces(true)
  bubbleWindow.setAlwaysOnTop(true, 'floating')

  bubbleWindow.on('close', () => {
    const raw = bubbleWindow && !bubbleWindow.isDestroyed()
      ? bubbleWindow.webContents.getTitle()
      : ''
    // data: URLs return the URL as title — ignore those
    bubbleAction = raw && !raw.startsWith('data:') ? raw : ''
    console.log('[Bubble] close raw:', raw, '→ action:', bubbleAction)
  })

  bubbleWindow.on('closed', () => {
    const action = bubbleAction
    console.log('[Bubble] closed, action:', action)
    bubbleAction = ''
    bubbleWindow = null

    if (action === 'EXPAND') {
      console.log('[Bubble] expanding card...')
      const pos = screen.getCursorScreenPoint()
      showCaptureCard(pos.x - 250, pos.y + 10)
    } else if (action && action.startsWith('DROP:')) {
      try {
        const data = JSON.parse(action.replace('DROP:', ''))
        const pos = screen.getCursorScreenPoint()
        // Show card with dropped content pre-filled
        showCaptureCard(pos.x - 250, pos.y + 10, data)
      } catch {
        respawnBubble()
      }
    } else {
      console.log('[Bubble] respawning (no action)')
      respawnBubble()
    }
  })

  bubbleWindow.on('blur', () => {
    // Keep bubble visible, don't close on blur
  })
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
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.close()
    bubbleWindow = null
  }
}

// ============ Capture Card (expanded view) ============

function showCaptureCard(centerX: number, centerY: number, dropData?: { filePaths?: string[]; text?: string }): void {
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.focus()
    // Send drop data to existing card
    if (dropData) {
      cardWindow.webContents.executeJavaScript(`
        (function() {
          window.__droppedPaths = ${JSON.stringify(dropData.filePaths || [])};
          var fpl = window.__droppedPaths;
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

  console.log('[Card] creating at', centerX, centerY)

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.card{width:480px;margin:0 auto;background:#ffffff;border-radius:10px;padding:24px;box-shadow:0 8px 40px rgba(0,0,0,0.12),0 0 0 1px rgba(0,0,0,0.06)}
.header{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.header-title{font-size:14px;font-weight:600;color:#1d1d1f;flex:1}
.header-hint{font-size:11px;color:#a1a1a6}
#dropzone{position:relative;border:2px dashed #dcdcde;border-radius:8px;margin-bottom:14px;background:#f5f5f7;border-radius:12px;margin-bottom:14px;background:rgba(255,255,255,0.02);transition:border-color .2s,background .2s;min-height:100px}
#dropzone.drag-over{border-color:#007aff;background:rgba(0,122,255,0.04)}}
.dz-hint{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:8px;color:#6e6e73;font-size:13px;pointer-events:none;transition:color .2s}
.dz-hint .icon{font-size:28px;opacity:0.6}
#content{width:100%;min-height:100px;padding:14px;background:transparent;border:none;outline:none;color:#1d1d1f;font-size:14px;line-height:1.6;resize:none;font-family:inherit;display:none}
#content::placeholder{color:#6e6e73}
.actions{display:flex;justify-content:flex-end;gap:8px}
.btn{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:500;border:none;cursor:pointer;transition:all .15s}
.btn-primary{background:#007aff;color:#fff}.btn-primary:hover{background:#0071e3}
.btn-secondary{background:#f5f5f7;color:#6e6e73;border:1px solid #dcdcde}.btn-secondary:hover{background:#f0f0f2;color:#1d1d1f}
.file-list{display:none;font-size:12px;color:#6e6e73;padding:8px 14px;background:#f5f5f7;border-radius:8px;margin-bottom:14px}
.file-list .item{display:flex;align-items:center;gap:6px;padding:3px 0}
.file-list .icon{font-size:14px}
.saved-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#34c759;color:#fff;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:500;opacity:0;transition:opacity .3s;pointer-events:none}
.saved-toast.show{opacity:1}
</style></head><body>
<div class="card">
<div class="header">
  <span style="font-size:16px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4m0 6v4M5 12h4m6 0h4M3 21l1.5-4.5L9 15l4.5 1.5L15 21l1.5-4.5L21 15l-4.5-1.5L15 9l-1.5 4.5L9 9l-1.5 4.5L3 15l1.5 4.5L3 21z"/></svg></span>
  <span class="header-title">快速捕获</span>
  <span class="header-hint">点击悬浮球打开</span>
</div>
<div class="file-list" id="fileList"></div>
<div id="dropzone">
  <textarea id="content" placeholder="输入内容或粘贴链接..."></textarea>
  <div class="dz-hint" id="dzHint"><span class="icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></span>点击输入文字，或拖拽文件/文字到此</div>
</div>
<div class="actions">
  <button class="btn btn-secondary" onclick="minimize()">收起</button>
  <button class="btn btn-primary" onclick="save()">⏎ 保存到 Vault</button>
</div>
</div>
<div class="saved-toast" id="toast">✅ 已保存到 0-收集/</div>
<script>
const dz = document.getElementById('dropzone')
const content = document.getElementById('content')
const hint = document.getElementById('dzHint')
const fileList = document.getElementById('fileList')
const toast = document.getElementById('toast')
let droppedFiles = []
let droppedText = ''
let isEditing = false

// Track editing state to prevent blur-close while typing
content.addEventListener('focus', () => { isEditing = true })
content.addEventListener('blur', () => {
  setTimeout(() => {
    if (document.activeElement !== content) isEditing = false
  }, 200)
})

// Show textarea when clicked
dz.addEventListener('click', () => {
  content.style.display = 'block'
  hint.style.display = 'none'
  content.focus()
})

content.addEventListener('input', () => {
  if (content.value.trim()) {
    hint.style.display = 'none'
  } else {
    content.style.display = 'none'
    hint.style.display = 'flex'
  }
})

// Drag-and-drop
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over') })
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'))
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('drag-over')
  
  // Files from Finder
  if (e.dataTransfer.files.length > 0) {
    droppedFiles = Array.from(e.dataTransfer.files).map(f => ({ name: f.name, path: (f as any).path || "" }))
    fileList.style.display = 'block'
    fileList.innerHTML = droppedFiles.map(f => '<div class="item"><span class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>' + f.name + '</div>') + '</div>').join('')
    content.style.display = 'block'
    hint.style.display = 'none'
    if (!content.value.trim()) {
      content.value = droppedFiles.map(f => "📎 " + f.name).join("\n")
    }
  }
  
  // Text content
  const text = e.dataTransfer.getData('text/plain')
  const uri = e.dataTransfer.getData('text/uri-list')
  if (text || uri) {
    const val = text || uri
    droppedText = val
    content.style.display = 'block'
    hint.style.display = 'none'
    if (!content.value.trim()) {
      content.value = val
    } else {
      content.value += '\\n' + val
    }
  }
})

content.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save()
})

function minimize() { document.title = 'MINIMIZE'; window.close() }
function save() {
  const text = content.value.trim()
  const bubblePaths = (window as any).__droppedPaths || []
  if (!text && droppedFiles.length === 0 && bubblePaths.length === 0) return
  const payload = {
    text,
    files: droppedFiles.filter(f => f.path).map(f => ({ name: f.name, path: f.path })),
    bubblePaths
  }
  document.title = 'SAVE:' + JSON.stringify(payload).slice(0, 300)
  toast.classList.add('show')
  setTimeout(() => window.close(), 800)
}
</script></body></html>`

  const cardWidth = 500
  const cardHeight = 320
  const primaryDisplay = screen.getPrimaryDisplay()
  const maxX = primaryDisplay.workAreaSize.width - cardWidth
  const maxY = primaryDisplay.workAreaSize.height - cardHeight
  const x = Math.max(0, Math.min(centerX - cardWidth / 2, maxX))
  const y = Math.max(0, Math.min(centerY, maxY))

  cardWindow = new BrowserWindow({
    width: cardWidth, height: cardHeight,
    x, y,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true, hasShadow: false,
    show: false,
    webPreferences: {
      sandbox: false, contextIsolation: false,
      nodeIntegration: false,
    },
  })

  cardWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  cardWindow.once('ready-to-show', () => {
    console.log('[Card] ready-to-show')
    cardWindow?.show()
  })

  cardWindow.webContents.on('did-finish-load', () => {
    console.log('[Card] did-finish-load')
  })

  cardWindow.webContents.on('did-fail-load', (_, code, desc) => {
    console.log('[Card] did-fail-load:', code, desc)
  })
  cardWindow.setVisibleOnAllWorkspaces(true)

  cardWindow.on('close', () => {
    const raw = cardWindow && !cardWindow.isDestroyed()
      ? cardWindow.webContents.getTitle()
      : ''
    cardAction = raw && !raw.startsWith('data:') ? raw : ''
    console.log('[Card] close action:', cardAction)
  })

  cardWindow.on('closed', async () => {
    const action = cardAction
    cardAction = ''
    cardWindow = null

    if (action.startsWith('SAVE:')) {
      try {
        const data = JSON.parse(action.replace('SAVE:', ''))
        const allPaths = [...(data.files || []).map((f: any) => f.path), ...(data.bubblePaths || [])]
        // Copy dropped files into vault (rename = data loss risk)
        if (allPaths.length > 0) {
          const { copyFile } = await import('fs/promises')
          const { basename } = await import('path')
          const collectDir = join(vaultPath, '0-收集')
          if (!existsSync(collectDir)) await mkdir(collectDir, { recursive: true })
          for (const srcPath of allPaths) {
            if (!existsSync(srcPath)) continue
            const dest = join(collectDir, basename(srcPath))
            await copyFile(srcPath, dest)
            enrichFile(dest).catch(() => {})
          }
        }
        if (data.text) saveToVault(data.text)
      } catch {}
    }
    // Always respawn bubble (unless minimised from bubble itself)
    respawnBubble()
  })

  let isEditing = false

  cardWindow.on('blur', () => {
    // Don't close if user is actively typing or file list is populated
    if (!isEditing) {
      setTimeout(() => {
        if (cardWindow && !cardWindow.isDestroyed()) {
          cardWindow.close()
        }
      }, 2000)
    }
  })
}

// ============ Drop on bubble (direct file drop) ============

async function handleDropOnBubble(data: any): Promise<void> {
  if (!vaultPath) return
  const collectDir = join(vaultPath, '0-收集')
  if (!existsSync(collectDir)) {
    await mkdir(collectDir, { recursive: true })
  }

  // Copy dropped files into vault (rename = data loss risk)
  if (data.filePaths && data.filePaths.length > 0) {
    const { copyFile } = await import('fs/promises')
    const { basename } = await import('path')
    for (const srcPath of data.filePaths) {
      if (!existsSync(srcPath)) continue
      const destPath = join(collectDir, basename(srcPath))
      await copyFile(srcPath, destPath)
      console.log('[Bubble] File copied:', basename(srcPath))
      enrichFile(destPath).catch(() => {})
    }
  }

  // Save dropped text
  if (data.text) {
    await saveToVault(data.text)
  }
}

// ============ Save from card ============

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
