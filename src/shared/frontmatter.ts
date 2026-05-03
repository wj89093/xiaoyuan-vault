// ============ Shared Frontmatter Types ============

export interface Relationship {
  type: string
  target: string
  confidence: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS'
  source?: string
}

export interface OpenThread {
  content: string
  status: 'open' | 'done'
  created?: string
}

export interface Frontmatter {
  title?: string
  type?: string
  status?: string
  summary?: string
  confidence?: 'high' | 'medium' | 'low'
  tags?: string[]
  created?: string
  updated?: string
  relationships?: Relationship[]
  openThreads?: OpenThread[]
  seeAlso?: string[]
  [key: string]: unknown
}

export function parseFrontmatter(content: string): { frontmatter: Frontmatter; content: string } {
  // Minimal inline parser - use main process version for actual parsing
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { frontmatter: {}, content }
  try {
    const result: Record<string, unknown> = {}
    match[1].split('\n').forEach(line => {
      const [key, ...vals] = line.split(':')
      if (key && vals.length) result[key.trim()] = vals.join(':').trim()
    })
    return { frontmatter: result as Frontmatter, content: content.slice(match[0].length) }
  } catch {
    return { frontmatter: {}, content }
  }
}
