import log from 'electron-log/main'
import { getVaultPath } from './database'
import { callAI } from './aiService'
import { existsSync } from 'fs'
import { join } from 'path'
import { readFile, writeFile, appendFile, readdir, stat, mkdir } from 'fs/promises'
import { parseFrontmatter, applyFrontmatter } from './frontmatter'
import { runMaintenance } from './maintain'
import { basename } from 'path'

export interface AutoAISettings {
  enabled: boolean
  interval: number // minutes
  onClassify: boolean
  onTags: boolean
  onSummary: boolean
}

const AI_INTERVAL_DEFAULTS: Record<number, number> = {
  30: 30 * 60 * 1000,
  60: 60 * 60 * 1000,
  120: 2 * 60 * 60 * 1000,
  360: 6 * 60 * 60 * 1000
}

let timer: ReturnType<typeof setInterval> | null = null
let lastRunAt: number | null = null
// Files that should not be processed by AutoAI
const SYSTEM_FILES = new Set(['index.md', 'log.md', 'RESOLVER.md', 'schema.md'])

let currentSettings: AutoAISettings | null = null

export function getAutoAISettingsPath(): string {
  const vaultPath = getVaultPath()
  if (!vaultPath) return ''
  return join(vaultPath, '.xiaoyuan', 'auto-ai.json')
}

export async function readAutoAISettings(): Promise<AutoAISettings | null> {
  const p = getAutoAISettingsPath()
  if (!p || !existsSync(p)) return null
  try {
    return JSON.parse(await readFile(p, 'utf-8'))
  } catch {
    return null
  }
}

export async function writeAutoAISettings(settings: AutoAISettings): Promise<void> {
  const p = getAutoAISettingsPath()
  if (!p) return
  const dir = join(p, '..', '..')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(p, JSON.stringify(settings, null, 2), 'utf-8')
}

export async function startAutoAIEngine(): Promise<void> {
  await stopAutoAIEngine()

  const vaultPath = getVaultPath()
  if (!vaultPath) {
    log.info('[AutoAI] no vault open, skipping')
    return
  }

  let settings = await readAutoAISettings()
  if (!settings) {
    // Create default settings on first run
    settings = { enabled: true, interval: 60, onClassify: true, onTags: true, onSummary: true }
    await writeAutoAISettings(settings)
    log.info('[AutoAI] created default settings (interval=60min)')
  }

  if (!settings.enabled) {
    log.info('[AutoAI] disabled, skipping')
    return
  }

  currentSettings = settings
  const intervalMs = AI_INTERVAL_DEFAULTS[settings.interval] || (settings.interval * 60 * 1000)
  log.info(`[AutoAI] engine started, interval=${settings.interval}min`)

  // Run immediately on start
  runAutoAI()

  timer = setInterval(() => runAutoAI(), intervalMs)
}

export async function stopAutoAIEngine(): Promise<void> {
  if (timer) {
    clearInterval(timer)
    timer = null
    log.info('[AutoAI] engine stopped')
  }
}

// ─── Core auto AI logic ──────────────────────────────────────────────────

async function runAutoAI(): Promise<void> {
  const settings = currentSettings || await readAutoAISettings()
  if (!settings?.enabled) return

  const vaultPath = getVaultPath()
  if (!vaultPath) return

  log.info('[AutoAI] running...')
  lastRunAt = Date.now()

  try {
    // Scan vault for markdown files
    const files = await scanVaultFiles(vaultPath)
    log.info(`[AutoAI] found ${files.length} files to process`)

    // Get available folders
    const folders = await getVaultFolders(vaultPath)

    let processed = 0
    let skipped = 0
    const logEntries: string[] = []

    for (const filePath of files) {
      try {
        const result = await processFile(filePath, settings, folders)
        if (result) {
          processed++
          const fname = basename(filePath)
          logEntries.push(`${fname} → 已处理`)
        } else {
          skipped++
        }
      } catch (err: any) {
        log.warn(`[AutoAI] skip ${filePath}:`, err.message)
        skipped++
      }
    }

    // Update index.md and log.md (always, regardless of processed count)
    try {
      await rebuildIndexFile(vaultPath)
      if (logEntries.length > 0) {
        await appendToOperationLog(vaultPath, logEntries)
      }
      log.info(`[AutoAI] index.md + log.md updated`)
    } catch (err: any) {
      log.error('[AutoAI] index/log update failed:', err.message)
    }

    // Run maintenance check
    try {
      const report = await runMaintenance()
      log.info(`[AutoAI] maintenance: ${report.summary}`)
    } catch (err: any) {
      log.error('[AutoAI] maintenance failed:', err.message)
    }

    log.info(`[AutoAI] completed: ${processed} processed, ${skipped} skipped`)
  } catch (err: any) {
    log.error('[AutoAI] run failed:', err)
  }
}

async function processFile(
  filePath: string,
  settings: AutoAISettings,
  folders: string[]
): Promise<boolean> {
  // Read content
  const raw = await readFile(filePath, 'utf-8')
  const { frontmatter, content } = parseFrontmatter(raw)

  // ===== Assess: 内容价值评估（OpenWiki inspired）=====
  const assessment = assessContentWorth(content)
  if (!assessment.worth) {
    log.info(`[AutoAI] assess skip: ${basename(filePath)} — ${assessment.reason}`)
    return false
  }
  log.info(`[AutoAI] assess pass: ${basename(filePath)} — score ${assessment.score}`)

  // Skip if AI already done all tasks
  const needsTags = settings.onTags && (!frontmatter.tags || frontmatter.tags.length === 0)
  const needsSummary = settings.onSummary && !frontmatter.summary
  const needsCategory = settings.onClassify && !frontmatter.category

  if (!needsTags && !needsSummary && !needsCategory) {
    return false // nothing to do
  }

  log.info(`[AutoAI] processing: ${filePath}`)

  const body = content.trim()
  if (!body) return false

  const updates: Partial<typeof frontmatter> = {}

  // Run AI calls concurrently
  const tasks: Promise<void>[] = []

  if (needsTags) {
    tasks.push(
      (async () => {
        const tags = await callAI('tags', { content: body }) as string[]
        if (Array.isArray(tags) && tags.length > 0) {
          updates.tags = tags.slice(0, 5)
          log.info(`[AutoAI] tags → ${tags.slice(0, 3).join(', ')}`)
        }
      })()
    )
  }

  if (needsSummary) {
    tasks.push(
      (async () => {
        const summary = await callAI('summary', { content: body }) as string
        if (summary && summary.length > 0) {
          updates.summary = summary.slice(0, 200)
          log.info(`[AutoAI] summary → ${summary.slice(0, 50)}...`)
        }
      })()
    )
  }

  if (needsCategory) {
    tasks.push(
      (async () => {
        const category = await callAI('classify', {
          content: body,
          folders
        }) as string
        if (category && category.trim()) {
          updates.category = category.trim()
          log.info(`[AutoAI] category → ${category}`)
        }
      })()
    )
  }

  await Promise.all(tasks)

  // If no updates, skip
  if (Object.keys(updates).length === 0) {
    return false
  }

  // Apply updates
  const newFrontmatter = { ...frontmatter, ...updates }
  const newContent = applyFrontmatter(raw, newFrontmatter)

  // Write back
  await writeFile(filePath, newContent, 'utf-8')
  log.info(`[AutoAI] updated: ${filePath}`)

  return true
}

// ─── Vault file scanner ─────────────────────────────────────────────────

async function scanVaultFiles(vaultPath: string, relDir = '', excludeSystemFiles = true): Promise<string[]> {
  const results: string[] = []
  const seen = new Set<string>()
  const fullDir = relDir ? join(vaultPath, relDir) : vaultPath

  let entries: string[]
  try {
    entries = await readdir(fullDir)
  } catch {
    return results
  }

  for (const name of entries.sort()) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const relPath = relDir ? `${relDir}/${name}` : name
    const fullPath = join(fullDir, name)

    if (relDir === '' && name === '.xiaoyuan') continue

    try {
      const fstat = await stat(fullPath)
      if (fstat.isDirectory()) {
        const subFiles = await scanVaultFiles(vaultPath, relPath)
        for (const sf of subFiles) {
          if (!seen.has(sf)) { seen.add(sf); results.push(sf) }
        }
      } else if (name.endsWith('.md') && (!excludeSystemFiles || !SYSTEM_FILES.has(name))) {
        if (!seen.has(fullPath)) { seen.add(fullPath); results.push(fullPath) }
      }
    } catch {}
  }

  return results
}

async function getVaultFolders(vaultPath: string): Promise<string[]> {
  const folders: Set<string> = new Set()

  async function scan(dir: string, parent = '') {
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch {
      return
    }

    for (const name of entries.sort()) {
      if (name.startsWith('.') || name === 'node_modules') continue

      const relPath = parent ? `${parent}/${name}` : name
      const fullPath = join(dir, name)

      try {
        const fstat = await stat(fullPath)
        if (fstat.isDirectory()) {
          if (relPath !== '.xiaoyuan') {
            folders.add(relPath)
            await scan(fullPath, relPath)
          }
        }
      } catch {
        // Skip
      }
    }
  }

  await scan(vaultPath)
  return Array.from(folders).sort()
}

export function getLastRunAt(): number | null {
  return lastRunAt
}

// ─── index.md auto-update ───────────────────────────────────────────────

export async function rebuildIndexFile(vaultPath: string): Promise<void> {
  const indexPath = join(vaultPath, 'index.md')
  const files = await scanVaultFiles(vaultPath)
  log.info(`[AutoAI] rebuildIndex: ${files.length} files to index`)
  const byFolder: Record<string, { title: string; type: string; summary: string }[]> = {}

  for (const filePath of files) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const { frontmatter } = parseFrontmatter(raw)
      const relPath = filePath.slice(vaultPath.length + 1)
      const folder = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '根目录'

      if (!byFolder[folder]) byFolder[folder] = []
      byFolder[folder].push({
        title: frontmatter.title || basename(filePath, '.md'),
        type: frontmatter.type || 'collection',
        summary: frontmatter.summary || '-'
      })
    } catch {
      // Skip unreadable files
    }
  }

  const now = new Date().toLocaleString('zh-CN')
  let md = `# 知识索引\n\n> 本文件由 AI 自动维护，最后更新：${now}\n\n---\n\n## 内容目录\n\n`

  const sortedFolders = Object.keys(byFolder).sort()
  md += '| 目录 | 类型 | 页数 |\n|------|------|------|\n'
  for (const folder of sortedFolders) {
    const items = byFolder[folder]
    const types = [...new Set(items.map(i => i.type))].join('/')
    md += `| ${folder} | ${types} | ${items.length} |\n`
  }

  md += `\n## 活跃页面\n\n`
  for (const folder of sortedFolders) {
    md += `### ${folder}\n\n`
    for (const item of byFolder[folder]) {
      md += `- **${item.title}** (\`${item.type}\`) — ${item.summary}\n`
    }
    md += '\n'
  }

  await writeFile(indexPath, md, 'utf-8')
}

// ─── log.md auto-append ──────────────────────────────────────────────────

export async function appendToOperationLog(vaultPath: string, entries: string[]): Promise<void> {
  if (entries.length === 0) return
  const logPath = join(vaultPath, 'log.md')
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  let content = ''
  for (const entry of entries) {
    content += `## [${now}] AutoAI | ${entry}\n`
  }

  // Append (create if not exists)
  await appendFile(logPath, content, 'utf-8')
}

// ===== Content Worth Assessment (OpenWiki inspired) =====

export interface AssessResult {
  worth: boolean
  score: number   // 0.0 - 1.0
  reason: string
  contentType: 'article' | 'note' | 'snippet' | 'log' | 'trash'
}

/**
 * Heuristic content worth assessment (no AI call, fast)
 */
export function assessContentWorth(rawContent: string): AssessResult {
  // Strip frontmatter if present
  const content = rawContent.replace(/^---[\s\S]*?---\n?/, '').trim()

  // Skip empty content
  if (!content || content.length === 0) {
    return { worth: false, score: 0, reason: 'empty content', contentType: 'trash' }
  }

  // Skip too short (likely noise, one-liner, CLI output)
  const wordCount = content.replace(/\s+/g, ' ').trim().length
  if (wordCount < 50) {
    return { worth: false, score: 0.1, reason: `too short (${wordCount} chars)`, contentType: 'snippet' }
  }

  // Skip pure URL-only content (likely a bookmark without context)
  const urlPattern = /^https?:\/\/[^\s]+\s*$/
  if (urlPattern.test(content)) {
    return { worth: false, score: 0.2, reason: 'URL-only content', contentType: 'snippet' }
  }

  // Skip CLI logs / error traces (high density of paths and line numbers)
  const cliPatterns = [
    /\/usr\/(?:local\/)?(?:bin|lib|share)\//,
    /node_modules\//,
    /at\s+\w+\.\w+\s+\(.+\.\w+:\d+:\d+\)/,  // stack trace
    /^\s*[\[\]{}()]=>/m,  // CLI output indicators
  ]
  for (const pattern of cliPatterns) {
    if (pattern.test(content) && wordCount < 200) {
      return { worth: false, score: 0.3, reason: 'CLI/log output detected', contentType: 'log' }
    }
  }

  // Skip ad-like content (high density of emoji + links)
  const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length
  const linkCount = (content.match(/https?:\/\/[^\s]+/g) || []).length
  if (emojiCount > 10 && linkCount > 5 && wordCount < 300) {
    return { worth: false, score: 0.2, reason: 'ad-like content (emoji+links)', contentType: 'trash' }
  }

  // Score calculation
  let score = 0.5
  let contentType: AssessResult['contentType'] = 'note'

  // Long content → higher value
  if (wordCount > 1000) { score += 0.2; contentType = 'article' }
  else if (wordCount > 300) { score += 0.1; contentType = 'article' }

  // Has paragraph structure → higher value
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 100)
  if (paragraphs.length >= 3) score += 0.15
  else if (paragraphs.length >= 1) score += 0.05

  // Has headings → structured content
  if (/^#{1,6}\s+.+/m.test(content)) score += 0.1

  // Has code blocks → technical content
  if (/```[\s\S]*?```/.test(content)) score += 0.05

  // Cap at 1.0
  score = Math.min(score, 1.0)

  return {
    worth: score >= 0.4,
    score: Math.round(score * 100) / 100,
    reason: score >= 0.4 ? 'content has knowledge value' : `low-value (score: ${(score * 100).toFixed(0)}%)`,
    contentType,
  }
}
