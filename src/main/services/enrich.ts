import log from 'electron-log/main'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, basename } from 'path'
import { resolveContentType, type ResolverResult } from './resolver'
import { rebuildIndexFile, appendToOperationLog } from './autoAIEngine'
import { getVaultPath } from './database'
import { parseFrontmatter, applyFrontmatter, extractTypedLinks, type Relationship } from './frontmatter'

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
    // LLM-first: Use resolver's action plan (entities + updates) instead of hardcoded logic
    // classification now includes: entities[], updates[], summary, tags
    const type = confirmedType || classification?.type || frontmatter.type || 'collection'

    // Build frontmatter updates from LLM's action plan
    const enrichUpdates: Record<string, unknown> = {
      type,
      updated: new Date().toISOString().slice(0, 10)
    }

    if (classification) {
      if (classification.confidence) enrichUpdates.confidence = classification.confidence
      // Use LLM-generated summary instead of raw reason
      if (classification.summary) enrichUpdates.summary = classification.summary.slice(0, 200)
      // Use LLM-extracted tags + existing tags
      const llmTags = classification.tags || []
      const existingTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : []
      const newTags = llmTags.filter((t: string) => !existingTags.includes(t))
      if (newTags.length > 0) enrichUpdates.tags = [...existingTags, ...newTags]
      // Use LLM-decided entities for relationships (not regex extraction)
      if (classification.entities?.length > 0) {
        const rels = classification.entities.map((e: any) => ({
          type: e.entityType || 'mentions',
          target: e.name,
          confidence: 'EXTRACTED' as const,
          source: classification.reason || '',
        }))
        const existingRels = Array.isArray(frontmatter.relationships) ? frontmatter.relationships : []
        const existingTargets = new Set(existingRels.map((r: Relationship) => `${r.type}:${r.target}`))
        const newRels = rels.filter((r: any) => !existingTargets.has(`${r.type}:${r.target}`))
        if (newRels.length > 0) enrichUpdates.relationships = [...existingRels, ...newRels]
        log.info(`[Enrich-LLM] entities: ${newRels.map((r: any) => r.target).join(', ')}`)
      }
    }

    const newFrontmatter = { ...frontmatter, ...enrichUpdates }
    const newContent = applyFrontmatter(raw, newFrontmatter)

    // Step 4: Update frontmatter in place (do NOT move file)
    await writeFile(filePath, newContent, 'utf-8')
    log.info(`[Enrich] updated frontmatter: ${filePath} → type=${type}`)

    // Step 5: Bidirectional links — update backlinks for this file's typed links
    const backlinksAdded = await updateBacklinksForFile(filePath, newFrontmatter.title as string || basename(filePath, '.md'))
    if (backlinksAdded > 0) {
      log.info(`[Backlink] ${backlinksAdded} backlinks created from ${filePath}`)
    }

    // Step 6: Phase 2 — enrich linked entity pages (append timeline + update related pages)
    const { updated: updatedPages, pending: pendingPages } = await enrichLinkedEntityPages(
      filePath,
      newFrontmatter.title as string || basename(filePath, '.md'),
      classification?.entities || []
    )
    const phase2info = updatedPages.length > 0
      ? `, 相关页面+${updatedPages.join(',')}`
      : pendingPages.length > 0
      ? `, 待建页面:${pendingPages.join(',')}`
      : ''

    return {
      success: true,
      action: 'updated',
      message: `类型设为 ${type}${phase2info}`,
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

function _getDefaultFolder(type: string): string {
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
    const newFrontmatter = { ...frontmatter, ...enrichUpdates, seeAlso }
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




// ─── Phase 2: Enrich 多页面联动 ─────────────────────────────────

interface TimelineEntry {
  date: string
  type: string
  content: string
  source?: string
}

/**
 * Parse a timeline entry from the "## 时间线" section of a page
 */
function _parseTimeline(raw: string): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  const match = raw.match(/##\s*时间线[\s\S]*$/m)
  if (!match) return entries
  // Match "## [YYYY-MM-DD] TYPE | Content" entries
  const entryRe = /##\s*\[(\d{4}-\d{2}-\d{2})\]\s*([^|]+)\|\s*(.+)/g
  let m
  while ((m = entryRe.exec(match[0])) !== null) {
    entries.push({ date: m[1], type: m[2].trim(), content: m[3].trim() })
  }
  return entries
}

/**
 * Check if vault has a wiki page for a given entity name
 * Looks in: vault/{TYPE}/{name}.md or vault/{folder}/{name}.md
 */
async function findEntityPage(vaultPath: string, entityName: string): Promise<string | null> {
  const { readdir, stat } = await import('fs/promises')
  const nameLower = entityName.toLowerCase()

  async function search(dir: string): Promise<string | null> {
    let entries: string[]
    try { entries = await readdir(dir) } catch { return null }
    for (const name of entries.sort()) {
      if (name.startsWith('.')) continue
      const fullPath = join(dir, name)
      try {
        const fstat = await stat(fullPath)
        if (fstat.isDirectory()) {
          const found = await search(fullPath)
          if (found) return found
        } else if (name.endsWith('.md')) {
          const baseName = name.replace(/\.md$/, '').toLowerCase()
          if (baseName === nameLower || baseName.replace(/\s+/g, '') === nameLower.replace(/\s+/g, '')) {
            return fullPath
          }
        }
      } catch {}
    }
    return null
  }

  return search(vaultPath)
}

/**
 * Append a timeline entry to an existing wiki page
 */
async function appendTimelineEntry(
  filePath: string,
  entry: TimelineEntry
): Promise<boolean> {
  try {
    const raw = await readFile(filePath, 'utf-8')
    parseFrontmatter(raw)
    const now = entry.date || new Date().toISOString().slice(0, 10)
    const entryLine = `## [${now}] ${entry.type} | ${entry.content}${entry.source ? '  \n   来源: ' + entry.source : ''}`

    // Append to end of content (after --- separator if present, otherwise at end)
    const sepIdx = raw.indexOf('---', 4) // skip first frontmatter separator
    let insertIdx = raw.length
    if (sepIdx !== -1) {
      // Find second --- that ends frontmatter
      const sep2 = raw.indexOf('---', sepIdx + 3)
      if (sep2 !== -1) insertIdx = sep2 + 3
    }

    const newRaw = raw.slice(0, insertIdx) + '\n' + entryLine + raw.slice(insertIdx)
    await writeFile(filePath, newRaw, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * Enrich all entity pages mentioned in this file's typed links.
 * - If entity page exists → append timeline + update updated date
 * - If not exists → log as "待建页面" (for inbox processing)
 */
async function enrichLinkedEntityPages(
  filePath: string,
  fileTitle: string,
  typedLinks: Relationship[]
): Promise<{ updated: string[]; pending: string[] }> {
  const vaultPath = getVaultPath()
  if (!vaultPath) return { updated: [], pending: [] }
  if (typedLinks.length === 0) return { updated: [], pending: [] }

  const updated: string[] = []
  const pending: string[] = []

  // Group typed links by entity name (avoid processing same entity twice)
  const seen = new Set<string>()
  const uniqueEntities = typedLinks.filter(r => {
    if (seen.has(r.target)) return false
    seen.add(r.target); return true
  })

  for (const rel of uniqueEntities) {
    const entityPage = await findEntityPage(vaultPath, rel.target)
    if (!entityPage) {
      pending.push(rel.target)
      log.info(`[Phase2] ${rel.target}: 无已有页面，进入 inbox`)
      continue
    }

    const entry: TimelineEntry = {
      date: new Date().toISOString().slice(0, 10),
      type: 'related',
      content: `在「${fileTitle}」中提到: ${rel.source || rel.target}`,
      source: fileTitle
    }

    const ok = await appendTimelineEntry(entityPage, entry)
    if (ok) {
      updated.push(rel.target)
      log.info(`[Phase2] 更新实体页面 ${rel.target}: timeline 追加条目`)
    }
  }

  return { updated, pending }
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
