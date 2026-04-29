import log from 'electron-log/main'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, relative } from 'path'
import { getVaultPath, searchFiles, listVaultFiles } from './database'
import { parseFrontmatter, extractWikiLinks } from './frontmatter'

export interface MaintainReport {
  timestamp: number
  totalFiles: number
  orphanPages: { path: string; title: string }[]
  stalePages: { path: string; title: string; daysSinceUpdate: number }[]
  deadLinks: { fromPath: string; fromTitle: string; deadTarget: string }[]
  missingFields: { path: string; title: string; missing: string[] }[]
  summary: string
}

const STALE_DAYS = 90
const REQUIRED_FIELDS = ['title', 'type', 'status']

// ─── Run vault maintenance ────────────────────────────────────────────

export async function runMaintenance(): Promise<MaintainReport> {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return emptyReport('未打开知识库')
  }

  const files = await listVaultFiles()
  const mdFiles = flattenFiles(files).filter(f => !f.isDirectory && f.path.endsWith('.md'))

  const orphanPages: MaintainReport['orphanPages'] = []
  const stalePages: MaintainReport['stalePages'] = []
  const deadLinks: MaintainReport['deadLinks'] = []
  const missingFields: MaintainReport['missingFields'] = []
  const allTitles = new Set<string>()
  const linkMap = new Map<string, string[]>() // target → [sources]

  // First pass: collect all titles and metadata
  for (const file of mdFiles) {
    try {
      const raw = await readFile(file.path, 'utf-8')
      const { frontmatter } = parseFrontmatter(raw)
      const title = frontmatter.title || file.name.replace('.md', '')
      allTitles.add(title)

      // Check missing required fields
      const missing = REQUIRED_FIELDS.filter(f => !frontmatter[f])
      if (missing.length > 0) {
        missingFields.push({ path: file.path, title, missing })
      }

      // Check staleness
      if (frontmatter.updated) {
        const lastUpdate = new Date(frontmatter.updated).getTime()
        const daysSince = (Date.now() - lastUpdate) / (1000 * 60 * 60 * 24)
        if (daysSince > STALE_DAYS) {
          stalePages.push({ path: file.path, title, daysSinceUpdate: Math.round(daysSince) })
        }
      }

      // Extract links
      const links = extractWikiLinks(raw)
      for (const link of links) {
        if (!linkMap.has(link)) linkMap.set(link, [])
        linkMap.get(link)!.push(title)
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Second pass: find orphans and dead links
  const linkedTitles = new Set<string>()
  for (const [target, sources] of linkMap) {
    if (allTitles.has(target)) {
      linkedTitles.add(target)
    } else {
      // Dead link: target doesn't exist
      for (const source of sources) {
        deadLinks.push({
          fromPath: mdFiles.find(f => (f.title || f.name) === source)?.path || '',
          fromTitle: source,
          deadTarget: target
        })
      }
    }
  }

  for (const file of mdFiles) {
    const title = file.title || file.name.replace('.md', '')
    if (!linkedTitles.has(title) && mdFiles.length > 1) {
      orphanPages.push({ path: file.path, title })
    }
  }

  const summary = [
    orphanPages.length > 0 ? `${orphanPages.length} 个孤儿页面` : '',
    stalePages.length > 0 ? `${stalePages.length} 个过期页面(>${STALE_DAYS}天)` : '',
    deadLinks.length > 0 ? `${deadLinks.length} 个死链接` : '',
    missingFields.length > 0 ? `${missingFields.length} 个页面缺少必填字段` : ''
  ].filter(Boolean).join('，') || '一切正常 ✅'

  log.info(`[Maintain] ${summary}`)

  return {
    timestamp: Date.now(),
    totalFiles: mdFiles.length,
    orphanPages,
    stalePages,
    deadLinks,
    missingFields,
    summary
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function flattenFiles(files: any[]): any[] {
  const result: any[] = []
  for (const f of files) {
    result.push(f)
    if (f.children) result.push(...flattenFiles(f.children))
  }
  return result
}

function emptyReport(reason: string): MaintainReport {
  return {
    timestamp: Date.now(),
    totalFiles: 0,
    orphanPages: [],
    stalePages: [],
    deadLinks: [],
    missingFields: [],
    summary: reason
  }
}
