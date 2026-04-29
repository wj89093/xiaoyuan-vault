import log from 'electron-log/main'
import { readFile, writeFile, rename } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { resolveContentType, ResolverResult } from './resolver'
import { rebuildIndexFile, appendToOperationLog } from './autoAIEngine'
import { getVaultPath } from './database'
import { parseFrontmatter, applyFrontmatter, generateFileTemplate } from './frontmatter'

export interface EnrichResult {
  success: boolean
  action: 'migrated' | 'updated' | 'skipped' | 'error'
  message: string
  oldPath?: string
  newPath?: string
  frontmatter?: Record<string, unknown>
}

// Expose rebuildIndexFile and appendToOperationLog for enrich use
export { rebuildIndexFile, appendToOperationLog }

// ─── Enrich a file ─────────────────────────────────────────────────────

// Ensure folder map is loaded before processing
export async function enrichFile(
  filePath: string,
  confirmedType?: string,
  confirmedFolder?: string
): Promise<EnrichResult> {
  const vaultPath = getVaultPath()
  if (!vaultPath) return { success: false, action: 'error', message: '未打开知识库' }

  try {
    const raw = await readFile(filePath, 'utf-8')
    const { frontmatter, content } = parseFrontmatter(raw)

    // Step 1: Classify if not already classified
    let classification: ResolverResult | null = null
    if (!frontmatter.type || frontmatter.type === 'collection') {
      classification = await resolveContentType(content, frontmatter.title || basename(filePath, '.md'))
    }

    // Step 2: Determine type and folder
    const type = confirmedType || classification?.type || frontmatter.type || 'collection'
    const suggestedFolder = confirmedFolder || classification?.suggestedFolder || getDefaultFolder(type)

    // Step 3: Update frontmatter
    const updates: Record<string, unknown> = {
      type,
      updated: new Date().toISOString().slice(0, 10)
    }

    if (classification) {
      if (classification.confidence) updates.confidence = classification.confidence
      if (classification.reason) updates.summary = classification.reason
      if (classification.extractedNames?.length) {
        updates.tags = [...(frontmatter.tags || []), ...classification.extractedNames]
      }
    }

    const newFrontmatter = { ...frontmatter, ...updates }
    const newContent = applyFrontmatter(raw, newFrontmatter)

    // Step 4: Update frontmatter in place (do NOT move file)
    await writeFile(filePath, newContent, 'utf-8')
    log.info(`[Enrich] updated frontmatter: ${filePath} → type=${type}`)

    return {
      success: true,
      action: 'updated',
      message: `类型设为 ${type}，建议目录 ${suggestedFolder}`,
      oldPath: filePath,
      frontmatter: newFrontmatter
    }
  } catch (err: any) {
    log.error('[Enrich] failed:', err.message)
    return { success: false, action: 'error', message: err.message }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

// ─── Folder Map (configurable, not hardcoded per schema.md) ──────────

const DEFAULT_FOLDER_MAP: Record<string, string> = {
  person: '1-人物',
  company: '2-公司',
  project: '3-项目',
  meeting: '4-会议',
  deal: '5-交易',
  concept: '6-概念',
  research: '7-研究',
  collection: '0-收集',
}

let _folderMap: Record<string, string> | null = null

/**
 * Load folder map from .xiaoyuan/folder-map.json (configurable)
 * Falls back to defaults if file doesn't exist
 */
export async function loadFolderMap(): Promise<Record<string, string>> {
  if (_folderMap) return _folderMap
  try {
    const vaultPath = getVaultPath()
    if (!vaultPath) return DEFAULT_FOLDER_MAP
    const mapPath = join(require('path').join(vaultPath, '.xiaoyuan', 'folder-map.json'))
    const { readFile, mkdir } = await import('fs/promises')
    const dir = require('path').join(vaultPath, '.xiaoyuan')
    if (!require('fs').existsSync(dir)) await mkdir(dir, { recursive: true })
    if (require('fs').existsSync(mapPath)) {
      _folderMap = JSON.parse(await readFile(mapPath, 'utf-8'))
      return _folderMap!
    }
  } catch {}
  _folderMap = { ...DEFAULT_FOLDER_MAP }
  return _folderMap
}

/**
 * Save custom folder map (allows user/AI to reconfigure)
 */
export async function saveFolderMap(map: Record<string, string>): Promise<void> {
  _folderMap = { ...map }
  const vaultPath = getVaultPath()
  if (!vaultPath) return
  const { writeFile, mkdir } = await import('fs/promises')
  const { join } = require('path')
  const dir = join(vaultPath, '.xiaoyuan')
  if (!require('fs').existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'folder-map.json'), JSON.stringify(map, null, 2), 'utf-8')
}

function getDefaultFolder(type: string): string {
  if (!_folderMap) return DEFAULT_FOLDER_MAP[type] || '0-收集'
  return _folderMap[type] || '0-收集'
}

// ─── Batch enrich inbox ──────────────────────────────────────────────

export async function enrichInbox(): Promise<EnrichResult[]> {
  const vaultPath = getVaultPath()
  if (!vaultPath) return []

  const inboxDir = join(vaultPath, '0-收集')
  if (!existsSync(inboxDir)) return []

  const results: EnrichResult[] = []
  let entries: string[]

  try {
    const { readdir } = await import('fs/promises')
    entries = await readdir(inboxDir)
  } catch {
    return results
  }

  for (const name of entries) {
    if (!name.endsWith('.md')) continue
    const filePath = join(inboxDir, name)
    const result = await enrichFile(filePath)
    results.push(result)
  }

  // Auto-update index and log after batch enrich
  if (results.length > 0) {
    try {
      await rebuildIndexFile(vaultPath)
      const logEntries = results
        .filter(r => r.success)
        .map(r => `${basename(r.oldPath || '')} → ${r.message}`)
      await appendToOperationLog(vaultPath, logEntries)
    } catch (err: any) {
      log.error('[Enrich] index/log update failed:', err.message)
    }
  }

  return results
}

export async function enrichFileWithConfirmation(
  filePath: string,
  type: string,
  folder?: string
): Promise<EnrichResult> {
  return enrichFile(filePath, type, folder)
}
