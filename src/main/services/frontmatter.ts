/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-invalid-this, @typescript-eslint/unbound-method, prefer-const, @typescript-eslint/no-misused-promises */
/**
 * Frontmatter parser for Markdown files
 * Extended for xiaoyuan-Vault dual-layer page structure
 * 
 * Supports:
 * - Standard YAML frontmatter: ---\nkey: value\n---
 * - title, tags, created, updated
 * - Extended: type, status, summary, confidence, relationships, openThreads, seeAlso
 */


export interface Relationship {
  type: string       // invested_in, founded, attended, works_at, etc.
  target: string     // Target entity name
  confidence: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS'
  source?: string    // Source of this relationship
}

export interface OpenThread {
  content: string    // The open task/question
  status: 'open' | 'done'
  created?: string   // Date created
}

export interface Frontmatter {
  title?: string
  type?: string      // person | company | project | meeting | deal | concept | research | collection
  status?: string    // active | archived
  summary?: string   // One-line summary
  confidence?: 'high' | 'medium' | 'low'
  tags?: string[]
  created?: string
  updated?: string
  relationships?: Relationship[]
  openThreads?: OpenThread[]
  seeAlso?: string[] // Cross-links to other pages
  [key: string]: unknown
}

/**
 * Parse YAML frontmatter from Markdown content
 * Returns frontmatter object and rest of content
 */
export function parseFrontmatter(content: string): { frontmatter: Frontmatter; content: string } {
  const frontmatter: Frontmatter = {}
  
  // Match --- blocks at the start of the file
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  
  if (!match) {
    return { frontmatter, content }
  }

  const raw = match[1]
  const rest = content.slice(match[0].length)

  // Check for timeline separator
  const timelineMatch = rest.match(/^---\s*\n([\s\S]*)$/)
  let body = rest
  let _timelineContent = ''

  if (timelineMatch) {
    body = rest.slice(0, rest.indexOf('---\n'))
    _timelineContent = rest.slice(rest.indexOf('---\n') + 4)
  }

  // Parse each line
  const _inFrontmatter = true
  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim()
    let value: unknown = line.slice(colonIdx + 1).trim()

    if (!key) continue

    // Parse tags (array): tags: [tag1, tag2] or tags:\n  - tag1
    if (key === 'tags') {
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter.tags = value
          .slice(1, -1)
          .split(/[,，]/)
          .map(t => t.trim().replace(/['"]/g, ''))
          .filter(Boolean)
      }
      continue
    }

    // Parse relationships (multiline array)
    if (key === 'relationships') {
      frontmatter.relationships = parseRelationships(raw)
      continue
    }

    // Parse openThreads (multiline array)
    if (key === 'openThreads') {
      frontmatter.openThreads = parseOpenThreads(raw)
      continue
    }

    // Parse seeAlso (array)
    if (key === 'seeAlso') {
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter.seeAlso = value
          .slice(1, -1)
          .split(/[,，]/)
          .map(t => t.trim().replace(/[\[\]']/g, ''))
          .filter(Boolean)
      }
      continue
    }

    // Parse booleans
    if (value === 'true') value = true
    else if (value === 'false') value = false
    // Parse numbers
    else if (/^\d+$/.test(value)) value = parseInt(value, 10)

    frontmatter[key] = value
  }

  // Also check for multiline tags
  const tagMatch = raw.match(/^tags:\s*$/m)
  if (tagMatch) {
    const linesAfter = raw.split('\n')
    const tagLineIndex = linesAfter.findIndex(l => l.trim().startsWith('tags:'))
    if (tagLineIndex !== -1) {
      const tagLines: string[] = []
      for (let i = tagLineIndex + 1; i < linesAfter.length; i++) {
        const trimmed = linesAfter[i].trim()
        if (trimmed.startsWith('- ')) {
          tagLines.push(trimmed.slice(2).trim().replace(/['"]/g, ''))
        } else if (trimmed.startsWith('-')) {
          tagLines.push(trimmed.slice(1).trim().replace(/['"]/g, ''))
        } else if (trimmed === '') {
          continue
        } else {
          break
        }
      }
      if (tagLines.length > 0) {
        frontmatter.tags = tagLines
      }
    }
  }

  return { frontmatter, content: body }
}

/**
 * Parse relationships from raw frontmatter text
 */
function parseRelationships(raw: string): Relationship[] {
  const relationships: Relationship[] = []
  const lines = raw.split('\n')
  let inRelationships = false
  let currentRel: Partial<Relationship> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed === 'relationships:') {
      inRelationships = true
      continue
    }
    
    if (inRelationships) {
      if (trimmed.startsWith('- ')) {
        // Save previous relationship if exists
        if (currentRel.type && currentRel.target) {
          relationships.push({
            type: currentRel.type,
            target: currentRel.target,
            confidence: currentRel.confidence ?? 'EXTRACTED',
            source: currentRel.source
          })
        }
        // Start new relationship
        currentRel = {}
        const rest = trimmed.slice(2)
        if (rest.includes(':')) {
          const [k, v] = rest.split(':').map(s => s.trim())
          if (k === 'type') currentRel.type = v
          else if (k === 'target') currentRel.target = v
          else if (k === 'confidence') currentRel.confidence = v as Relationship['confidence']
          else if (k === 'source') currentRel.source = v
        }
      } else if (trimmed.startsWith('  - ')) {
        // Continuation of current relationship
        const rest = trimmed.slice(4)
        if (rest.includes(':')) {
          const [k, v] = rest.split(':').map(s => s.trim())
          if (k === 'type') currentRel.type = v
          else if (k === 'target') currentRel.target = v
          else if (k === 'confidence') currentRel.confidence = v as Relationship['confidence']
          else if (k === 'source') currentRel.source = v
        }
      } else if (trimmed === '' || trimmed.startsWith('#')) {
        // End of relationships section
        if (currentRel.type && currentRel.target) {
          relationships.push({
            type: currentRel.type,
            target: currentRel.target,
            confidence: currentRel.confidence ?? 'EXTRACTED',
            source: currentRel.source
          })
        }
        break
      }
    }
  }

  // Don't forget the last one
  if (currentRel.type && currentRel.target) {
    relationships.push({
      type: currentRel.type,
      target: currentRel.target,
      confidence: currentRel.confidence ?? 'EXTRACTED',
      source: currentRel.source
    })
  }

  return relationships
}

/**
 * Parse openThreads from raw frontmatter text
 */
function parseOpenThreads(raw: string): OpenThread[] {
  const threads: OpenThread[] = []
  const lines = raw.split('\n')
  let inThreads = false
  let currentThread: Partial<OpenThread> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed === 'openThreads:') {
      inThreads = true
      continue
    }
    
    if (inThreads) {
      if (trimmed.startsWith('- ')) {
        if (currentThread.content) {
          threads.push({
            content: currentThread.content,
            status: currentThread.status ?? 'open',
            created: currentThread.created
          })
        }
        currentThread = { status: 'open' }
        const rest = trimmed.slice(2)
        if (rest.startsWith('[x] ') || rest.startsWith('[ ] ')) {
          const isDone = rest.startsWith('[x]')
          currentThread.status = isDone ? 'done' : 'open'
          currentThread.content = rest.slice(4).trim()
        } else {
          currentThread.content = rest
        }
      } else if (trimmed.startsWith('  - ')) {
        // Continuation
        const rest = trimmed.slice(4)
        if (rest.startsWith('[x] ') || rest.startsWith('[ ] ')) {
          const isDone = rest.startsWith('[x]')
          currentThread.status = isDone ? 'done' : 'open'
          currentThread.content = rest.slice(4).trim()
        } else {
          currentThread.content = (currentThread.content ?? '') + ' ' + rest
        }
      } else if (trimmed.startsWith('status:')) {
        currentThread.status = trimmed.slice(7).trim().replace(/[\[\]]/g, '') === 'done' ? 'done' : 'open'
      } else if (trimmed.startsWith('created:')) {
        currentThread.created = trimmed.slice(8).trim()
      } else if (trimmed === '' || trimmed.startsWith('#')) {
        if (currentThread.content) {
          threads.push({
            content: currentThread.content,
            status: currentThread.status ?? 'open',
            created: currentThread.created
          })
        }
        break
      }
    }
  }

  if (currentThread.content) {
    threads.push({
      content: currentThread.content,
      status: currentThread.status ?? 'open',
      created: currentThread.created
    })
  }

  return threads
}

/**
 * Stringify frontmatter object to YAML block
 */
export function stringifyFrontmatter(frontmatter: Frontmatter): string {
  const lines: string[] = []

  // Helper to add multiline array field
  const _addMultilineArray = (key: string, values: string[] | undefined) => {
    if (!values || values.length === 0) return
    lines.push(`${key}:`)
    for (const v of values) {
      lines.push(`  - ${v}`)
    }
  }

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null) continue

    if (key === 'tags' && Array.isArray(value) && value.length > 0) {
      lines.push('tags:')
      for (const tag of value) {
        lines.push(`  - ${tag}`)
      }
    } else if (key === 'relationships' && Array.isArray(value) && value.length > 0) {
      lines.push('relationships:')
      for (const rel of value as Relationship[]) {
        lines.push(`  - type: ${rel.type}`)
        lines.push(`    target: ${rel.target}`)
        lines.push(`    confidence: ${rel.confidence}`)
        if (rel.source) lines.push(`    source: ${rel.source}`)
      }
    } else if (key === 'openThreads' && Array.isArray(value) && value.length > 0) {
      lines.push('openThreads:')
      for (const thread of value as OpenThread[]) {
        const checkbox = thread.status === 'done' ? '[x]' : '[ ]'
        lines.push(`  - ${checkbox} ${thread.content}`)
        if (thread.created) lines.push(`    created: ${thread.created}`)
      }
    } else if (key === 'seeAlso' && Array.isArray(value) && value.length > 0) {
      lines.push('seeAlso:')
      for (const link of value as string[]) {
        lines.push(`  - ${link}`)
      }
    } else if (typeof value === 'string') {
      // Quote strings that contain special characters
      if (value.includes(':') || value.includes('#') || value.includes('"') || value.includes('[') || value.includes(']')) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
      } else {
        lines.push(`${key}: ${value}`)
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value ? 'true' : 'false'}`)
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`)
    }
  }

  if (lines.length === 0) return ''

  return `---\n${lines.join('\n')}\n---\n\n`
}

/**
 * Merge frontmatter back into content
 * Preserves timeline section (after --- separator)
 */
export function applyFrontmatter(content: string, frontmatter: Frontmatter): string {
  // Remove existing frontmatter
  const { content: body } = parseFrontmatter(content)

  // Stringify new frontmatter
  const fm = stringifyFrontmatter(frontmatter)

  if (!fm) return body

  return fm + body.trimStart()
}

/**
 * Extract title from content (frontmatter title > first # heading > filename)
 */
export function extractDisplayTitle(content: string, filename?: string): string {
  const { frontmatter } = parseFrontmatter(content)
  
  if (frontmatter.title) return frontmatter.title

  const heading = content.match(/^#\s+(.+)$/m)
  if (heading) return heading[1].trim()

  if (filename) {
    return filename.replace(/\.md$/, '')
  }

  return ''
}

/**
 * Extract wiki links [[xxx]] from content
 * Returns array of link targets
 */
export function extractWikiLinks(content: string): string[] {
  const links: string[] = []
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  let match
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim())
  }
  return [...new Set(links)] // Deduplicate
}

// ─── Typed Links extractor (GBrain format) ───────────────────────────────────

const ENTITY_TYPES = new Set([
  'person', 'persons',
  'company', 'companies',
  'project', 'projects',
  'meeting', 'meetings',
  'deal', 'deals',
  'concept', 'concepts',
  'research', 'researches',
  'event', 'events',
  'institution', 'institutions',
  'product', 'products',
  'technology', 'technologies',
])

/**
 * Extract typed links from content: [[公司:中科国生]] → Relationship[]
 * Supports: person/company/project/meeting/deal/concept/research/event 等实体类型
 * GBrain format: [[ENTITY_TYPE:ENTITY_NAME]]
 *
 * Returns structured Relationship[] with:
 * - type: inferred relationship type (related_to / mentions / etc.)
 * - target: the entity name extracted from the typed link
 * - confidence: always EXTRACTED (directly mentioned)
 * - source: surrounding context snippet
 */
export function extractTypedLinks(content: string): Relationship[] {
  const typedLinkRegex = /\[\[([^\]:]+):([^\]]+)\]\]/g
  const seen = new Set<string>()
  const relationships: Relationship[] = []

  let match: RegExpExecArray | null
  while ((match = typedLinkRegex.exec(content)) !== null) {
    const rawType = match[1].trim().toLowerCase()
    const entityName = match[2].trim()

    // Normalize entity type: companies→company, persons→person, etc.
    const entityType = rawType.replace(/s$/, '')

    // Skip if not a known entity type (might be a normal wiki link)
    if (!ENTITY_TYPES.has(entityType)) continue

    const key = `${entityType}:${entityName}`
    if (seen.has(key)) continue
    seen.add(key)

    // Extract surrounding context (±60 chars)
    const start = Math.max(0, match.index - 60)
    const end = Math.min(content.length, match.index + match[0].length + 60)
    let context = content.slice(start, end).replace(/\n+/g, ' ').trim()
    if (start > 0) context = '…' + context
    if (end < content.length) context = context + '…'

    // Infer relationship type from entity type
    const RELATION_MAP: Record<string, string> = {
      person:     'mentions',
      company:    'mentions',
      project:    'involves',
      meeting:    'involves',
      deal:       'involves',
      concept:    'relates_to',
      research:   'cites',
      event:      'participated_in',
      institution:'partnered_with',
      product:    'develops',
      technology: 'applies',
    }
    const relType = RELATION_MAP[entityType] || 'mentions'

    relationships.push({
      type: relType,
      target: entityName,
      confidence: 'EXTRACTED',
      source: context,
    })
  }

  return relationships
}

/**
 * Generate a new file template with dual-layer structure
 */
export function generateFileTemplate(title: string, type?: string): string {
  const now = new Date().toISOString().split('T')[0]
  const frontmatter: Frontmatter = {
    title,
    type: type ?? 'note',  // Default to 'note', resolver will reassign via enrich
    status: 'active',
    summary: '',
    confidence: 'low',
    tags: [],
    created: now,
    updated: now,
    openThreads: [],
    seeAlso: []
  }

  let body = `# ${title}\n\n`
  body += `## 基本信息\n\n`
  body += `- 暂无信息\n\n`
  body += `## Open Threads\n\n`
  body += `- [ ] 待补充\n\n`
  body += `## See Also\n\n`
  body += `\n`
  body += `---\n\n`
  body += `## 时间线\n\n`
  body += `## [${now}] 创建 | 页面初始化\n`

  return stringifyFrontmatter(frontmatter) + body
}

/**
 * Update the updated timestamp in frontmatter
 */
export function touchFrontmatter(frontmatter: Frontmatter): Frontmatter {
  const now = new Date().toISOString().split('T')[0]
  return { ...frontmatter, updated: now }
}
