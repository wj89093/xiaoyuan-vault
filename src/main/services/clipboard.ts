import { clipboard, BrowserWindow } from 'electron'
import { createHash } from 'crypto'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { enrichFile } from './enrich'

// ============ Types ============

export interface ClipboardCapture {
  id?: number
  content: string
  content_type: 'text' | 'url' | 'image'
  source_app?: string
  created_at?: number
  saved: boolean
  file_path?: string
}

// ============ Config ============

const POLL_INTERVAL_MS = 500
const URL_PATTERN = /^https?:\/\/[^\s]+$/i

// ============ State ============

let isRunning = false
let pollTimer: NodeJS.Timeout | null = null
let lastHash = ''
let vaultPath = ''
let popupWindow: BrowserWindow | null = null

// ============ Public API ============

export function setVaultPath(path: string): void {
  vaultPath = path
}

export function startClipboardWatcher(): void {
  if (isRunning) return
  isRunning = true
  pollTimer = setInterval(checkClipboard, POLL_INTERVAL_MS)
  console.log('[Clipboard] Watcher started (500ms poll, popup mode)')
}

export function stopClipboardWatcher(): void {
  isRunning = false
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  closePopup()
  console.log('[Clipboard] Watcher stopped')
}

// ============ Core Logic ============

async function checkClipboard(): Promise<void> {
  try {
    const image = clipboard.readImage()
    if (!image.isEmpty()) {
      const hash = computeHash(image.toPNG().toString('base64'))
      if (hash !== lastHash) { lastHash = hash; showPopup('image') }
      return
    }

    const text = clipboard.readText()
    if (!text || text.trim().length === 0) return

    const hash = computeHash(text)
    if (hash === lastHash) return
    lastHash = hash

    const isURL = URL_PATTERN.test(text.trim())
    showPopup(isURL ? 'url' : 'text')
  } catch {}
}

// ============ Popup Window ============

function showPopup(contentType: string): void {
  const text = clipboard.readText().trim()
  const isURL = contentType === 'url'
  const preview = text.slice(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const icon = isURL ? '🔗' : '📋'
  const label = isURL ? '链接' : '文本'

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.focus()
    popupWindow.webContents.executeJavaScript(
      `updatePreview(${JSON.stringify(preview)},${JSON.stringify(label)},${JSON.stringify(text)})`
    ).catch(() => {})
    return
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:rgba(28,28,30,0.94);color:#f5f5f7;border-radius:14px;overflow:hidden;-webkit-app-region:drag}
.popup{padding:20px;display:flex;flex-direction:column;height:100vh;gap:12px}
.header{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
.type-badge{font-size:11px;color:#a1a1a6;background:rgba(255,255,255,0.1);padding:2px 8px;border-radius:10px}
#dropzone{flex:1;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border:2px dashed rgba(255,255,255,0.2);border-radius:12px;font-size:13px;color:#a1a1a6;text-align:center;transition:all .2s;-webkit-app-region:no-drag;cursor:default}
#dropzone.drag-over{border-color:#007aff;background:rgba(0,122,255,0.1);color:#007aff}
#dropzone .preview-text{max-height:100px;overflow:hidden;padding:8px;word-break:break-all}
.actions{display:flex;gap:8px;justify-content:flex-end;-webkit-app-region:no-drag}
.btn{padding:7px 18px;border-radius:8px;font-size:12px;font-weight:500;border:none;cursor:pointer}
.btn-save{background:#007aff;color:#fff}.btn-save:hover{background:#0071e3}
.btn-ignore{background:rgba(255,255,255,0.08);color:#a1a1a6}.btn-ignore:hover{background:rgba(255,255,255,0.12);color:#f5f5f7}
</style></head><body><div class="popup">
<div class="header">${icon} <span>${label} 已捕获</span> <span class="type-badge">Cmd+C</span></div>
<div id="dropzone">
  <div class="preview-text">${preview || '拖拽内容到此保存'}</div>
</div>
<div class="actions">
  <button class="btn btn-ignore" onclick="window.close()">忽略</button>
  <button class="btn btn-save" id="saveBtn" onclick="save()">保存到 Vault</button>
</div>
</div>
<script>
let capturedText = ${JSON.stringify(text)}
const dz = document.getElementById('dropzone')

dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over') })
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'))
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('drag-over')
  const dropped = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list')
  if (dropped) {
    capturedText = dropped
    dz.querySelector('.preview-text').textContent = dropped.slice(0, 300)
  }
})
function updatePreview(p, label, t) {
  capturedText = t
  dz.querySelector('.preview-text').textContent = p || '拖拽内容到此保存'
}
function save() {
  document.title = 'SAVE:' + encodeURIComponent(capturedText); window.close()
}
</script></body></html>`

  popupWindow = new BrowserWindow({
    width: 420, height: 280,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true,
    vibrancy: 'hud',
    visualEffectState: 'active',
    webPreferences: {
      sandbox: false, contextIsolation: false,
      nodeIntegration: false,
    },
  })

  popupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  popupWindow.center()

  popupWindow.on('closed', () => {
    const title = popupWindow?.getTitle() || ''
    popupWindow = null
    if (title.startsWith('SAVE:') && vaultPath) {
      const captured = decodeURIComponent(title.replace('SAVE:', ''))
      saveToVault(captured).catch(e => console.warn('[Clipboard] save failed:', e))
    }
  })
}

export function closePopup(): void {
  if (popupWindow && !popupWindow.isDestroyed()) { popupWindow.close() }
}

// ============ Save to Vault ============

async function saveToVault(content: string): Promise<void> {
  if (!vaultPath) return

  const collectDir = join(vaultPath, '0-收集')
  if (!existsSync(collectDir)) {
    const { mkdir } = require('fs/promises')
    await mkdir(collectDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const isURL = URL_PATTERN.test(content.trim())
  const prefix = isURL ? 'web' : 'clip'
  const filename = `${prefix}-${timestamp}.md`

  const frontmatter = [
    '---',
    `title: "${content.slice(0, 60).replace(/"/g, '\\"')}"`,
    `type: ${isURL ? 'web-clip' : 'clipboard'}`,
    `source: clipboard`,
    `created: ${new Date().toISOString().slice(0, 10)}`,
    `tags: [auto-import, ${isURL ? 'url' : 'text'}]`,
    '---', '', content,
  ].join('\n')

  const filePath = join(collectDir, filename)
  await writeFile(filePath, frontmatter, 'utf-8')

  enrichFile(filePath).catch(() => {})
  console.log('[Clipboard] Saved:', filename)
}

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
