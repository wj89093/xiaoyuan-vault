import { BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { enrichFile } from './enrich'

let bubbleWindow: BrowserWindow | null = null
let cardWindow: BrowserWindow | null = null
let vaultPath = ''

// ============ Public API ============

export function setVaultPath(path: string): void {
  vaultPath = path
}

/**
 * Show the floating bubble (persistent, always-on-top)
 */
export function showBubble(): void {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.show()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const bubbleSize = 48

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;overflow:hidden;cursor:grab}
body:active{cursor:grabbing}
.bubble{
  width:${bubbleSize}px;height:${bubbleSize}px;
  border-radius:50%;
  background:rgba(30,30,32,0.88);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 20px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.1);
  transition:transform .2s,box-shadow .2s;
  font-size:22px;color:#f5f5f7;
  -webkit-app-region:no-drag;
}
.bubble:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(0,0,0,0.4)}
.bubble.drag-over{transform:scale(1.15);box-shadow:0 0 0 4px #007aff,0 8px 32px rgba(0,122,255,0.4)}
</style></head><body>
<div class="bubble" id="bubble">📥</div>
<script>
const bubble = document.getElementById('bubble')
let filesInDrop = []

// Click to expand
bubble.addEventListener('click', () => {
  document.title = 'EXPAND'
  window.close()
})

// Drag-over to accept files
document.addEventListener('dragover', e => { e.preventDefault(); bubble.classList.add('drag-over') })
document.addEventListener('dragleave', () => bubble.classList.remove('drag-over'))
document.addEventListener('drop', e => {
  e.preventDefault(); bubble.classList.remove('drag-over')
  filesInDrop = Array.from(e.dataTransfer.files || [])
  const text = e.dataTransfer.getData('text/plain')
  const uri = e.dataTransfer.getData('text/uri-list')
  document.title = 'DROP:' + JSON.stringify({
    fileCount: filesInDrop.length,
    fileNames: filesInDrop.map(f => f.name),
    text: text ? text.slice(0, 200) : '',
    uri: uri || ''
  })
  window.close()
})
</script></body></html>`

  bubbleWindow = new BrowserWindow({
    width: bubbleSize + 16, height: bubbleSize + 16,
    x: width - 80, y: height - 120,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true, hasShadow: false,
    type: 'panel',
    paintWhenInitiallyHidden: true,
    webPreferences: {
      sandbox: false, contextIsolation: false,
      nodeIntegration: false,
    },
  })

  bubbleWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  bubbleWindow.setVisibleOnAllWorkspaces(true)
  bubbleWindow.setAlwaysOnTop(true, 'floating')

  bubbleWindow.on('closed', () => {
    const title = bubbleWindow?.getTitle() || ''
    bubbleWindow = null

    if (title === 'EXPAND') {
      // Clicked → show expanded card
      const pos = screen.getCursorScreenPoint()
      showCaptureCard(pos.x - 260, pos.y + 10)
    } else if (title.startsWith('DROP:')) {
      // File dropped on bubble → process
      try {
        const data = JSON.parse(title.replace('DROP:', ''))
        handleDropOnBubble(data)
      } catch {}
      // Respawn bubble
      setTimeout(showBubble, 100)
    } else {
      // Respawn bubble
      setTimeout(showBubble, 100)
    }
  })

  bubbleWindow.on('blur', () => {
    // Keep bubble visible, don't close on blur
  })
}

export function hideBubble(): void {
  if (bubbleWindow && !bubbleWindow.isDestroyed()) {
    bubbleWindow.close()
    bubbleWindow = null
  }
}

// ============ Capture Card (expanded view) ============

function showCaptureCard(centerX: number, centerY: number): void {
  if (cardWindow && !cardWindow.isDestroyed()) {
    cardWindow.focus()
    return
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:transparent;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
.card{width:480px;margin:0 auto;background:rgba(30,30,32,0.94);border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.5);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px)}
.header{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.header-title{font-size:14px;font-weight:600;color:#f5f5f7;flex:1}
.header-hint{font-size:11px;color:#a1a1a6}
#dropzone{position:relative;border:2px dashed rgba(255,255,255,0.12);border-radius:12px;margin-bottom:14px;background:rgba(255,255,255,0.02);transition:border-color .2s,background .2s;min-height:100px}
#dropzone.drag-over{border-color:#007aff;background:rgba(0,122,255,0.06)}
.dz-hint{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:8px;color:#6e6e73;font-size:13px;pointer-events:none;transition:color .2s}
.dz-hint .icon{font-size:28px;opacity:0.4}
#content{width:100%;min-height:100px;padding:14px;background:transparent;border:none;outline:none;color:#f5f5f7;font-size:14px;line-height:1.6;resize:none;font-family:inherit;display:none}
#content::placeholder{color:#6e6e73}
.actions{display:flex;justify-content:flex-end;gap:8px}
.btn{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:500;border:none;cursor:pointer;transition:all .15s}
.btn-primary{background:#007aff;color:#fff}.btn-primary:hover{background:#0071e3}
.btn-secondary{background:rgba(255,255,255,0.08);color:#a1a1a6}.btn-secondary:hover{background:rgba(255,255,255,0.12);color:#f5f5f7}
.file-list{display:none;font-size:12px;color:#a1a1a6;padding:8px 14px;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:14px}
.file-list .item{display:flex;align-items:center;gap:6px;padding:3px 0}
.file-list .icon{font-size:14px}
.saved-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#30d158;color:#000;padding:8px 20px;border-radius:20px;font-size:13px;font-weight:500;opacity:0;transition:opacity .3s;pointer-events:none}
.saved-toast.show{opacity:1}
</style></head><body>
<div class="card">
<div class="header">
  <span style="font-size:16px">✨</span>
  <span class="header-title">快速捕获</span>
  <span class="header-hint">点击悬浮球打开</span>
</div>
<div class="file-list" id="fileList"></div>
<div id="dropzone">
  <textarea id="content" placeholder="输入内容或粘贴链接..."></textarea>
  <div class="dz-hint" id="dzHint"><span class="icon">📥</span>点击输入文字，或拖拽文件/文字到此</div>
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
    droppedFiles = Array.from(e.dataTransfer.files)
    fileList.style.display = 'block'
    fileList.innerHTML = droppedFiles.map(f => '<div class="item"><span class="icon">📄</span>' + f.name + '</div>').join('')
    content.style.display = 'block'
    hint.style.display = 'none'
    if (!content.value.trim()) {
      content.value = droppedFiles.map(f => '📎 ' + f.name).join('\\n')
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
  if (!text && droppedFiles.length === 0) return
  const payload = { text, fileCount: droppedFiles.length, fileNames: droppedFiles.map(f => f.name) }
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
    type: 'panel',
    webPreferences: {
      sandbox: false, contextIsolation: false,
      nodeIntegration: false,
    },
  })

  cardWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  cardWindow.setVisibleOnAllWorkspaces(true)

  cardWindow.on('closed', () => {
    const title = cardWindow?.getTitle() || ''
    cardWindow = null

    if (title.startsWith('SAVE:')) {
      try {
        const data = JSON.parse(title.replace('SAVE:', ''))
        if (data.text) saveToVault(data.text)
      } catch {}
    }
    // Always respawn bubble
    setTimeout(showBubble, 200)
  })

  cardWindow.on('blur', () => {
    // Auto-minimize on blur
    if (cardWindow && !cardWindow.isDestroyed()) {
      cardWindow.close()
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

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  if (data.fileCount > 0) {
    // Save file reference
    const content = data.fileNames.map((n: string) => `📎 ${n}`).join('\n')
    const filename = `drop-${timestamp}.md`

    const frontmatter = [
      '---',
      `title: "拖入文件 ${data.fileNames[0] || 'files'}"`,
      `type: note`,
      `source: bubble-drop`,
      `created: ${new Date().toISOString().slice(0, 10)}`,
      `tags: [drop-import]`,
      '---', '', content,
    ].join('\n')

    const filePath = join(collectDir, filename)
    await writeFile(filePath, frontmatter, 'utf-8')
    enrichFile(filePath).catch(() => {})
    console.log('[Bubble] File drop saved:', filename)
  }

  if (data.text) {
    const filename = `drop-${timestamp}.md`
    const frontmatter = [
      '---',
      `title: "${data.text.slice(0, 40).replace(/"/g, '\\"')}"`,
      `type: note`,
      `source: bubble-drop`,
      `created: ${new Date().toISOString().slice(0, 10)}`,
      `tags: [drop-import]`,
      '---', '', data.text,
    ].join('\n')

    const filePath = join(collectDir, filename)
    await writeFile(filePath, frontmatter, 'utf-8')
    enrichFile(filePath).catch(() => {})
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
