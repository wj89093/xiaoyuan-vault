import { BrowserWindow, globalShortcut } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { enrichFile } from './enrich'

// ============ Config ============

let spotlightWindow: BrowserWindow | null = null
let vaultPath = ''

// ============ Public API ============

export function setVaultPath(path: string): void {
  vaultPath = path
}

/**
 * Register global shortcut Cmd+Shift+C (OpenWiki-style spotlight capture)
 */
export function registerSpotlightShortcut(): void {
  const registered = globalShortcut.register('CommandOrControl+Shift+C', () => {
    toggleSpotlight()
  })
  console.log('[Spotlight] Shortcut Cmd+Shift+C registered:', registered)
}

export function unregisterSpotlightShortcut(): void {
  globalShortcut.unregisterAll()
}

export function toggleSpotlight(): void {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    spotlightWindow.focus()
    return
  }
  showSpotlight()
}

export function closeSpotlight(): void {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    spotlightWindow.close()
  }
}

// ============ Spotlight Window ============

function showSpotlight(): void {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;background:transparent;overflow:hidden}
.spotlight{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center}
.card{width:540px;background:rgba(30,30,32,0.92);border-radius:16px;padding:28px;box-shadow:0 25px 80px rgba(0,0,0,0.5);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px)}
.header{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.header-icon{font-size:20px}
.header-title{font-size:14px;font-weight:600;color:#f5f5f7;flex:1}
.header-hint{font-size:11px;color:#a1a1a6;background:rgba(255,255,255,0.08);padding:3px 10px;border-radius:8px}
#dropzone{position:relative;width:100%;min-height:120px;margin-bottom:16px;border:2px dashed rgba(255,255,255,0.12);border-radius:12px;background:rgba(255,255,255,0.03);transition:all .2s;cursor:text}
#dropzone.drag-over{border-color:#007aff;background:rgba(0,122,255,0.08)}
#dropzone.drag-over .dz-hint{color:#007aff}
.dz-hint{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#6e6e73;font-size:13px;pointer-events:none;transition:color .2s}
.dz-hint .icon{font-size:28px;opacity:0.5}
#content{width:100%;min-height:120px;padding:14px;background:transparent;border:none;outline:none;color:#f5f5f7;font-size:14px;line-height:1.6;resize:none;font-family:inherit}
#content::placeholder{color:#6e6e73}
.actions{display:flex;justify-content:flex-end;gap:8px}
.btn{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:500;border:none;cursor:pointer;transition:all .15s}
.btn-primary{background:#007aff;color:#fff}.btn-primary:hover{background:#0071e3}
.btn-secondary{background:rgba(255,255,255,0.08);color:#a1a1a6}.btn-secondary:hover{background:rgba(255,255,255,0.12);color:#f5f5f7}
.status{font-size:11px;color:#30d158;text-align:right;margin-top:8px;opacity:0;transition:opacity .3s}
.status.show{opacity:1}
</style></head><body><div class="spotlight"><div class="card">
<div class="header">
  <span class="header-icon">✨</span>
  <span class="header-title">快速捕获</span>
  <span class="header-hint">Cmd+Shift+C</span>
</div>
<div id="dropzone">
  <textarea id="content" placeholder="输入或拖拽内容到此处...&#10;&#10;支持：文本 / 链接 / Markdown"></textarea>
  <div class="dz-hint"><span class="icon">📥</span>拖拽文件到此自动保存</div>
</div>
<div class="actions">
  <button class="btn btn-secondary" onclick="closeSpotlight()">Esc 关闭</button>
  <button class="btn btn-primary" onclick="save()">⏎ 保存到 Vault</button>
</div>
<div class="status" id="status">✅ 已保存</div>
</div></div>
<script>
const dz = document.getElementById('dropzone')
const textarea = document.getElementById('content')
const hint = dz.querySelector('.dz-hint')
const status = document.getElementById('status')

textarea.addEventListener('input', () => {
  hint.style.display = textarea.value.trim() ? 'none' : 'flex'
})

textarea.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSpotlight()
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save()
})

// Drag-and-drop from Finder
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over') })
dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'))
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.classList.remove('drag-over')
  const files = e.dataTransfer.files
  const text = e.dataTransfer.getData('text/plain')
  const uri = e.dataTransfer.getData('text/uri-list')
  
  if (files && files.length > 0) {
    const names = Array.from(files).map(f => f.name).join(', ')
    textarea.value = textarea.value 
      ? textarea.value + '\\n📎 拖入文件: ' + names
      : '📎 拖入文件: ' + names
    hint.style.display = 'none'
  } else if (text) {
    textarea.value = textarea.value 
      ? textarea.value + '\\n' + text
      : text
    hint.style.display = 'none'
  } else if (uri) {
    textarea.value = textarea.value 
      ? textarea.value + '\\n' + uri
      : uri
    hint.style.display = 'none'
  }
})

function closeSpotlight() { document.title = 'CLOSE'; window.close() }
function save() {
  const text = textarea.value.trim()
  if (!text) return
  document.title = 'SAVE:' + text.slice(0, 200)
  status.classList.add('show')
  setTimeout(() => window.close(), 600)
}
</script></body></html>`

  spotlightWindow = new BrowserWindow({
    width: 600, height: 400,
    frame: false, transparent: true,
    alwaysOnTop: true, resizable: false,
    skipTaskbar: true,
    center: true,
    vibrancy: 'fullscreen-ui',
    visualEffectState: 'active',
    webPreferences: {
      sandbox: false, contextIsolation: false,
      nodeIntegration: false,
    },
  })

  spotlightWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  spotlightWindow.on('closed', () => {
    const title = spotlightWindow?.getTitle() || ''
    spotlightWindow = null
    if (title.startsWith('SAVE:') && vaultPath) {
      const content = title.replace('SAVE:', '')
      saveToVault(content).catch(e => console.warn('[Spotlight] save failed:', e))
    }
  })

  // Auto-hide on blur (OpenWiki-style: 2s delay)
  spotlightWindow.on('blur', () => {
    setTimeout(() => {
      const text = (spotlightWindow as any)?.webContents?.executeJavaScript
      // Only close if no content was typed (empty state)
      if (spotlightWindow && !spotlightWindow.isDestroyed()) {
        const title = spotlightWindow.getTitle()
        if (!title.startsWith('SAVE:')) {
          // User might be interacting — check if content is empty
          spotlightWindow.webContents.executeJavaScript(
            'document.getElementById("content").value.trim()'
          ).then((val: string) => {
            if (!val && spotlightWindow && !spotlightWindow.isDestroyed()) {
              spotlightWindow.close()
            }
          }).catch(() => {})
        }
      }
    }, 3000)
  })
}

// ============ Save ============

async function saveToVault(content: string): Promise<void> {
  if (!vaultPath) return

  const collectDir = join(vaultPath, '0-收集')
  if (!existsSync(collectDir)) {
    await mkdir(collectDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const isURL = /^https?:\/\/[^\s]+$/i.test(content.trim())
  const prefix = isURL ? 'web' : 'spotlight'
  const filename = `${prefix}-${timestamp}.md`

  const title = content.split('\n')[0].slice(0, 60).replace(/["#*`\[\]]/g, '')
  const typeTag = isURL ? 'web-clip' : 'note'
  const date = new Date().toISOString().slice(0, 10)

  const frontmatter = [
    '---',
    `title: "${title || 'Spotlight 捕获'}"`,
    `type: ${typeTag}`,
    `source: spotlight`,
    `created: ${date}`,
    `tags: [spotlight, ${isURL ? 'url' : 'note'}]`,
    '---', '', content,
  ].join('\n')

  const filePath = join(collectDir, filename)
  await writeFile(filePath, frontmatter, 'utf-8')

  enrichFile(filePath).catch(() => {})
  console.log('[Spotlight] Saved:', filename)
}

// ============ Legacy clipboard watcher (keep but simplified) ============

let isRunning = false
let pollTimer: NodeJS.Timeout | null = null

export function startClipboardWatcher(): void {} // No-op: clipboard auto-capture removed
export function stopClipboardWatcher(): void {}
