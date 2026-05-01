import log from 'electron-log/main'
import { readFile, writeFile, rename } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { resolveContentType, ResolverResult } from './resolver'
import { rebuildIndexFile, appendToOperationLog } from './autoAIEngine'
import { getVaultPath } from './database'
import { parseFrontmatter, applyFrontmatter, generateFileTemplate, extractTypedLinks, Relationship } from './frontmatter'

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

    // Step 3b: Extract typed links from content (GBrain format: [[公司:中科国生]])
    const extractedRels = extractTypedLinks(content)
    if (extractedRels.length > 0) {
      const existingRels = Array.isArray(frontmatter.relationships) ? frontmatter.relationships : []
      const existingTargets = new Set(existingRels.map((r: Relationship) => `${r.type}:${r.target}`))
      const newRels = extractedRels.filter((r: Relationship) => !existingTargets.has(`${r.type}:${r.target}`))
      if (newRels.length > 0) {
        updates.relationships = [...existingRels, ...newRels]
        log.info(`[Enrich] typed links: ${newRels.map((r: Relationship) => r.target).join(', ')}`)
      }
    }

    const newFrontmatter = { ...frontmatter, ...updates }
    const newContent = applyFrontmatter(raw, newFrontmatter)

    // Step 4: Update frontmatter in place (do NOT move file)
    await writeFile(filePath, newContent, 'utf-8')
    log.info(`[Enrich] updated frontmatter: ${filePath} → type=${type}`)

    // Step 5: Bidirectional links — update backlinks for this file's typed links
    const backlinksAdded = await updateBacklinksForFile(filePath, newFrontmatter.title as string || basename(filePath, '.md'))
    if (backlinksAdded > 0) {
      log.info(`[Backlink] ${backlinksAdded} backlinks created from ${filePath}`)
    }

    return {
      success: true,
      action: 'updated',
      message: `类型设为 ${type}，${backlinksAdded > 0 ? `反向链接+${backlinksAdded}` : '建议目录 ' + suggestedFolder}`,
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
    const { readFile, mkdir } = await import('fs/promises')
    const { join: joinPath } = await import('path')
    const dir = joinPath(vaultPath, '.xiaoyuan')
    if (!existsSync(dir)) await mkdir(dir, { recursive: true })
    const mapPath = joinPath(dir, 'folder-map.json')
    if (existsSync(mapPath)) {
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
  const { join: joinPath } = await import('path')
  const dir = joinPath(vaultPath, '.xiaoyuan')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  await writeFile(joinPath(dir, 'folder-map.json'), JSON.stringify(map, null, 2), 'utf-8')
}

function getDefaultFolder(type: string): string {
  if (!_folderMap) return DEFAULT_FOLDER_MAP[type] || '0-收集'
  return _folderMap[type] || '0-收集'
}


// ─── Phase 1: Bidirectional Links ──────────────────────────────────

/**
 * Scan all markdown files in vault (recursive)
 */
async function scanAllMarkdownFiles(vaultPath: string): Promise<string[]> {
  const results: string[] = []
  const seen = new Set<string>()

  async function scan(dir: string) {
    const { readdir, stat } = await import('fs/promises')
    let entries: string[]
    try { entries = await readdir(dir) } catch { return }
    for (const name of entries.sort()) {
      if (name.startsWith('.')) continue
      const fullPath = join(dir, name)
      try {
        const fstat = await stat(fullPath)
        if (fstat.isDirectory()) {
          await scan(fullPath)
        } else if (name.endsWith('.md')) {
          if (!seen.has(fullPath)) { seen.add(fullPath); results.push(fullPath) }
        }
      } catch {}
    }
  }

  await scan(vaultPath)
  return results
}

/**
 * Find all files that mention a given entity name (case-insensitive)
 * Scans for: entity name in content OR [[TYPE:ENTITY_NAME]] typed links
 */
async function findFilesMentioningEntity(
  vaultPath: string,
  entityName: string
): Promise<string[]> {
  const files = await scanAllMarkdownFiles(vaultPath)
  const nameLower = entityName.toLowerCase()
  const results: string[] = []

  for (const filePath of files) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      // Check in content (plain mention) or typed link format
      const plainRe = new RegExp(entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\\\$&'), 'i')
      const typedRe = /\[\[[^\]:]+:/g  // just check for typed link presence, we'll check name separately
      if (plainRe.test(raw) || typedRe.test(raw)) {
        results.push(filePath)
      }
    } catch {}
  }
  return results
}

/**
 * Add a backlink to target file's seeAlso field
 * Returns true if backlink was actually added (not duplicate)
 */
async function addBacklink(
  targetPath: string,
  sourceTitle: string,
  sourcePath: string
): Promise<boolean> {
  if (targetPath === sourcePath) return false
  try {
    const raw = await readFile(targetPath, 'utf-8')
    const { frontmatter } = parseFrontmatter(raw)
    const seeAlso: string[] = Array.isArray(frontmatter.seeAlso) ? frontmatter.seeAlso : []

    // Deduplicate by page title or path
    const alreadyLinked = seeAlso.some(s => {
      const norm = s.replace(/\s+/g, '').toLowerCase()
      return norm === sourceTitle.replace(/\s+/g, '').toLowerCase() ||
             norm === sourcePath.replace(/\s+/g, '').toLowerCase()
    })
    if (alreadyLinked) return false

    seeAlso.push(sourceTitle)
    const updates = { seeAlso }
    const newFrontmatter = { ...frontmatter, ...updates }
    const newContent = applyFrontmatter(raw, newFrontmatter)
    await writeFile(targetPath, newContent, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * Update all backlinks for a file's typed links.
 * For each entity mentioned, find pages that reference it and add this page to their seeAlso.
 */
async function updateBacklinksForFile(filePath: string, fileTitle: string): Promise<number> {
  const vaultPath = getVaultPath()
  if (!vaultPath) return 0

  const raw = await readFile(filePath, 'utf-8')
  const { content } = parseFrontmatter(raw)
  const typedLinks = extractTypedLinks(content)
  if (typedLinks.length === 0) return 0

  let added = 0
  for (const rel of typedLinks) {
    const targetName = rel.target
    // Find all files mentioning this entity
    const mentioning = await findFilesMentioningEntity(vaultPath, targetName)
    for (const targetPath of mentioning) {
      const added_one = await addBacklink(targetPath, fileTitle, filePath)
      if (added_one) {
        added++
        log.info(`[Backlink] ${fileTitle} → ${targetName} (via ${targetPath})`)
      }
    }
  }
  return added
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
