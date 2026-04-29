import { clipboard, BrowserWindow } from 'electron'
import { createHash } from 'crypto'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
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

type ClipboardChangeCallback = (capture: ClipboardCapture) => void

// ============ Config ============

const POLL_INTERVAL_MS = 500
const URL_PATTERN = /^https?:\/\/[^\s]+$/i

// ============ State ============

let isRunning = false
let pollTimer: NodeJS.Timeout | null = null
let lastHash = ''
let onChangeCallback: ClipboardChangeCallback | null = null
let vaultPath = ''

// ============ Public API ============

export function setVaultPath(path: string): void {
  vaultPath = path
}

export function getVaultPath_clipboard(): string {
  return vaultPath
}

export function setClipboardCallback(cb: ClipboardChangeCallback): void {
  onChangeCallback = cb
}

export function startClipboardWatcher(): void {
  if (isRunning) return
  isRunning = true

  pollTimer = setInterval(checkClipboard, POLL_INTERVAL_MS)
  console.log('[Clipboard] Watcher started (500ms poll)')
}

export function stopClipboardWatcher(): void {
  isRunning = false
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  console.log('[Clipboard] Watcher stopped')
}

// ============ Core Logic ============

async function checkClipboard(): Promise<void> {
  try {
    // Check image first (faster to detect)
    const image = clipboard.readImage()
    if (!image.isEmpty()) {
      const hash = computeHash(image.toPNG().toString('base64'))
      if (hash !== lastHash) {
        lastHash = hash
        await handleImageCapture(image)
        return
      }
    }

    // Check text
    const text = clipboard.readText()
    if (!text || text.trim().length === 0) {
      // Also check RTF for formatted text
      const rtf = clipboard.readRTF()
      if (rtf && rtf.trim().length > 0) {
        const hash = computeHash(rtf)
        if (hash !== lastHash) {
          lastHash = hash
          await handleTextCapture(rtf, 'rtf')
        }
      }
      return
    }

    const hash = computeHash(text)
    if (hash === lastHash) return
    lastHash = hash

    await handleTextCapture(text, 'text')
  } catch (e) {
    // Silently ignore: may happen if clipboard is empty or inaccessible
  }
}

async function handleTextCapture(text: string, format: string): Promise<void> {
  const trimmed = text.trim()
  const isURL = URL_PATTERN.test(trimmed)
  const contentType = isURL ? 'url' : 'text'

  const capture: ClipboardCapture = {
    content: trimmed.slice(0, 50000), // max 50KB
    content_type: contentType,
    saved: false,
    created_at: Math.floor(Date.now() / 1000),
  }

  // Notify callback (for popup or auto-save)
  if (onChangeCallback) {
    onChangeCallback(capture)
  }

  // Auto-save if vault is open
  if (vaultPath) {
    await saveToVault(capture)
  }
}

async function handleImageCapture(image: Electron.NativeImage): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const capture: ClipboardCapture = {
    content: `[Image] clipboard-${timestamp}`,
    content_type: 'image',
    saved: false,
    created_at: Math.floor(Date.now() / 1000),
  }

  if (vaultPath) {
    const imgDir = join(vaultPath, '0-收集')
    if (!existsSync(imgDir)) {
      const { mkdir } = await import('fs/promises')
      await mkdir(imgDir, { recursive: true })
    }
    const filename = `clip-img-${timestamp}.png`
    const imgPath = join(imgDir, filename)
    await writeFile(imgPath, image.toPNG())
    capture.file_path = imgPath
    capture.saved = true

    // Trigger auto-enrich
    enrichFile(imgPath).catch(() => {})
  }

  if (onChangeCallback) {
    onChangeCallback(capture)
  }
}

async function saveToVault(capture: ClipboardCapture): Promise<void> {
  if (!vaultPath) return

  const collectDir = join(vaultPath, '0-收集')
  if (!existsSync(collectDir)) {
    const { mkdir } = await import('fs/promises')
    await mkdir(collectDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const prefix = capture.content_type === 'url' ? 'web' : 'clip'
  const ext = '.md'
  const filename = `${prefix}-${timestamp}${ext}`
  const filePath = join(collectDir, filename)

  // Write frontmatter + content
  const frontmatter = [
    '---',
    `title: "${capture.content.slice(0, 80).replace(/"/g, '\\"')}"`,
    `type: ${capture.content_type === 'url' ? 'web-clip' : 'clipboard'}`,
    `source: clipboard`,
    `created: ${new Date().toISOString().slice(0, 10)}`,
    `tags: [auto-import, ${capture.content_type === 'url' ? 'url' : 'text'}]`,
    '---',
    '',
    capture.content,
  ].join('\n')

  await writeFile(filePath, frontmatter, 'utf-8')
  capture.file_path = filePath
  capture.saved = true

  // Trigger auto-enrich（async, don't block）
  enrichFile(filePath).catch((e) => {
    console.warn('[Clipboard] enrich failed:', e.message)
  })
}

// ============ Utilities ============

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
