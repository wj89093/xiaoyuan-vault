import { getVaultPath } from './database'
import { readFile, readdir, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'
import log from 'electron-log/main'
import { loadFolderMap as loadEnrichFolderMap } from './enrich'
import { extractTypedLinks, type Relationship } from './frontmatter'

// ============ Types ============

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-invalid-this, @typescript-eslint/unbound-method */

interface GraphNode {
  id: string
  title: string
  page_type?: string
  tags?: string[]
  edge_count: number
  // Entity data (from enrich relationships)
  is_entity?: boolean       // has typed relationship entry
  entity_type?: string       // person|company|project|etc.
  entity_count?: number      // number of relationships pointing to/from
}

interface GraphEdge {
  source: string
  target: string
  relation: 'shared_tag' | 'similar_content' | 'hyperlink' | 'typed_link'
  weight: number
}

interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  updated_at: number
}

interface TFIDFDocument {
  file: string
  title: string
  tags: string[]
  tokens: Map<string, number>
  // Entity data
  relationships: Relationship[]
}

// ============ Constants ============

const MIN_TOKENS_FOR_SIMILARITY = 5 // Skip very short documents in content similarity
const COSINE_EARLY_ZERO = 0.001    // Early exit if dot/norm ratio < this (min possible value)

const STOPWORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有',
  '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些', '什么',
  '怎么', '如何', '可以', '这个', '那个', '如果', '因为', '所以', '但是',
  '而且', '或者', '虽然', '不过', '已经', '还是', '这样', '那样', '大家',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
  'very', 'and', 'but', 'or', 'it', 'its',
])

// ============ Main API ============

export async function getGraphPath(): Promise<string> {
  const vaultPath = getVaultPath()
  if (!vaultPath) throw new Error('No vault open')
  const dir = join(vaultPath, '.xiaoyuan')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  return join(dir, 'graph.json')
}

export async function loadGraph(): Promise<GraphData | null> {
  try {
    const graphPath = await getGraphPath()
    if (!existsSync(graphPath)) return null
    const raw = await readFile(graphPath, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function saveGraph(graph: GraphData): Promise<void> {
  const graphPath = await getGraphPath()
  graph.updated_at = Date.now()
  await writeFile(graphPath, JSON.stringify(graph, null, 2), 'utf-8')
}

/**
 * Full graph rebuild: scan vault, compute TF-IDF, find edges
 * Run as background task (5s delay after vault open, inspired by OpenWiki)
 */
export async function rebuildGraph(): Promise<{ nodes: number; edges: number }> {
  const vaultPath = getVaultPath()
  if (!vaultPath) throw new Error('No vault open')

  log.info('[Graph] rebuilding knowledge graph...')
  const start = Date.now()

  try {
    // Step 1: Scan vault for markdown files
    const files = await scanMarkdownFiles(vaultPath)
    log.info(`[Graph] found ${files.length} markdown files`)

    // Step 2: Tokenize + extract tags
    const documents: TFIDFDocument[] = []
    for (const file of files) {
      try {
        const doc = await tokenizeDocument(file, vaultPath)
        if (doc) documents.push(doc)
      } catch {}
    }

    // Step 3: Calculate TF-IDF vectors
    const { vectors, idf } = computeTFIDF(documents)

    // Step 4: Load folder map and build nodes
    const folderToType = await loadFolderToTypeMap()
    const nodes: GraphNode[] = documents.map(doc => {
      const folder = doc.file.split('/')[0] || ''
      // Count relationships as a proxy for entity prominence
      const entity_count = doc.relationships.length
      const is_entity = entity_count > 0
      // Primary entity type (from first relationship or frontmatter)
      const primaryType = doc.relationships[0]?.type || folderToType[folder] || 'note'
      return {
        id: doc.file,
        title: doc.title,
        tags: doc.tags,
        page_type: folderToType[folder] || 'note',
        edge_count: 0,
        is_entity,
        entity_type: is_entity ? primaryType : undefined,
        entity_count: is_entity ? entity_count : 0,
      }
    })

    // Step 5: Build edges via cosine similarity + tag overlap
    const edges: GraphEdge[] = buildEdges(documents, vectors, idf)

    // Step 6: Update edge counts on nodes
    const edgeCounts = new Map<string, number>()
    for (const edge of edges) {
      edgeCounts.set(edge.source, (edgeCounts.get(edge.source) ?? 0) + 1)
      edgeCounts.set(edge.target, (edgeCounts.get(edge.target) ?? 0) + 1)
    }
    for (const node of nodes) {
      node.edge_count = edgeCounts.get(node.id) ?? 0
    }

    const graph: GraphData = {
      nodes,
      edges,
      updated_at: Date.now(),
    }

    await saveGraph(graph)

    const elapsed = Date.now() - start
    log.info(`[Graph] done: ${nodes.length} nodes, ${edges.length} edges (${elapsed}ms)`)
    return { nodes: nodes.length, edges: edges.length }
  } catch (err) {
    log.error('[Graph] rebuild failed:', (err as any).message)
    return { nodes: 0, edges: 0 }
  }
}

// ============ Document Processing ============

async function scanMarkdownFiles(vaultPath: string, dir = ''): Promise<string[]> {
  const fullDir = dir ? join(vaultPath, dir) : vaultPath
  const entries = await readdir(fullDir, { withFileTypes: true })
  const results: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue  // Skip hidden
    const relPath = dir ? `${dir}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      const subFiles = await scanMarkdownFiles(vaultPath, relPath)
      results.push(...subFiles)
    } else if (extname(entry.name) === '.md') {
      results.push(relPath)
    }
  }

  return results
}

async function tokenizeDocument(
  file: string,
  vaultPath: string
): Promise<TFIDFDocument | null> {
  const fullPath = join(vaultPath, file)
  const content = await readFile(fullPath, 'utf-8')

  // Skip system files
  const filename = file.split('/').pop() ?? ''
  if (['index.md', 'log.md', 'RESOLVER.md', 'schema.md'].includes(filename)) {
    return null
  }

  // Extract title and tags from frontmatter
  let title = file.replace(/\.md$/, '').split('/').pop() ?? file
  let tags: string[] = []

  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (fmMatch) {
    const fm = fmMatch[1]
    const titleMatch = fm.match(/^title:\s*(.+)/m)
    if (titleMatch) title = titleMatch[1].replace(/['"]/g, '').trim()

    const tagsMatch = fm.match(/^tags:\s*\[(.+)\]/m)
    if (tagsMatch) {
      tags = tagsMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''))
    }
  }

  // Tokenize content (simple CJK + English tokenization)
  const body = content.replace(/^---[\s\S]*?---\n?/, '')  // remove frontmatter
  const tokens = tokenize(body)

  // Extract typed links for entity visualization
  const relationships = extractTypedLinks(body)

  return { file, title, tags, tokens, relationships }
}

export function tokenize(text: string): Map<string, number> {
  const tokenMap = new Map<string, number>()

  // Remove markdown syntax
  const cleaned = text
    .replace(/#{1,6}\s+/g, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links → text
    .replace(/```[\s\S]*?```/g, '')            // code blocks
    .replace(/[-*+]\s+/g, '')                  // list markers
    .replace(/^\|.*\|$/gm, '')                 // table rows
    .toLowerCase()

  // CJK: split into bigrams (2-char groups)
  const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf]/g
  const cjkChars = cleaned.match(cjkPattern) ?? []
  for (let i = 0; i < cjkChars.length - 1; i++) {
    const bigram = cjkChars[i] + cjkChars[i + 1]
    if (!STOPWORDS.has(bigram)) {
      tokenMap.set(bigram, (tokenMap.get(bigram) ?? 0) + 1)
    }
  }

  // English: split into words
  const words = cleaned.replace(/[^\u4e00-\u9fff\w]/g, ' ').split(/\s+/)
  for (const w of words) {
    if (w.length < 3 || w.length > 30) continue
    if (STOPWORDS.has(w)) continue
    if (/^\d+$/.test(w)) continue
    tokenMap.set(w, (tokenMap.get(w) ?? 0) + 1)
  }

  return tokenMap
}

// ============ TF-IDF ============

export function computeTFIDF(documents: TFIDFDocument[]): {
  vectors: Map<string, Map<string, number>>[]
  idf: Map<string, number>
} {
  const N = documents.length
  if (N === 0) return { vectors: [], idf: new Map() }

  // Calculate DF (document frequency) for each term
  const df = new Map<string, number>()
  for (const doc of documents) {
    const seen = new Set<string>()
    for (const term of doc.tokens.keys()) {
      if (!seen.has(term)) {
        df.set(term, (df.get(term) ?? 0) + 1)
        seen.add(term)
      }
    }
    // Add tags as extra tokens
    for (const tag of doc.tags) {
      if (!seen.has(tag)) {
        df.set(tag, (df.get(tag) ?? 0) + 1)
        seen.add(tag)
      }
    }
  }

  // Calculate IDF
  const idf = new Map<string, number>()
  for (const [term, docCount] of df) {
    idf.set(term, Math.log((N + 1) / (docCount + 1)) + 1)
  }

  // Calculate TF-IDF vectors
  const vectors: Map<string, Map<string, number>>[] = []
  for (const doc of documents) {
    const vec = new Map<string, number>()
    const totalTokens = [...doc.tokens.values()].reduce((a, b) => a + b, 0) || 1

    for (const [term, count] of doc.tokens) {
      const tf = count / totalTokens
      const termIdf = idf.get(term) ?? 1
      vec.set(term, tf * termIdf)
    }

    // Boost for tags
    for (const tag of doc.tags) {
      const termIdf = idf.get(tag) ?? 1
      vec.set(tag, (vec.get(tag) ?? 0) + 2 * termIdf)
    }

    vectors.push(vec)
  }

  return { vectors, idf }
}

// ============ Edge Building ============

export function buildEdges(
  documents: TFIDFDocument[],
  vectors: Map<string, Map<string, number>>[],
  _idf: Map<string, number>
): GraphEdge[] {
  const edges: GraphEdge[] = []
  const SIMILARITY_THRESHOLD = 0.15
  const MAX_EDGES = 200  // Cap to prevent explosion

  // ── Build entity name → doc index (for typed link resolution) ──
  const nameToDocs = new Map<string, { doc: TFIDFDocument; norm: string }[]>()
  for (const doc of documents) {
    // Index by title (normalized) and all relationship target names
    const titles = [doc.title]
    for (const rel of doc.relationships) titles.push(rel.target)
    for (const name of titles) {
      const norm = name.toLowerCase().replace(/\s+/g, '')
      if (!nameToDocs.has(norm)) nameToDocs.set(norm, [])
      nameToDocs.get(norm)!.push({ doc, norm })
    }
  }

  // ── Typed-link edges (from [[TYPE:NAME]] relationships) ──
  for (const doc of documents) {
    for (const rel of doc.relationships) {
      const targetNorm = rel.target.toLowerCase().replace(/\s+/g, '')
      const matches = nameToDocs.get(targetNorm) ?? []
      for (const { doc: targetDoc } of matches) {
        if (targetDoc.file === doc.file) continue
        // Avoid duplicate edges
        const exists = edges.some(
          e => (e.source === doc.file && e.target === targetDoc.file && e.relation === 'typed_link') ||
               (e.source === targetDoc.file && e.target === doc.file && e.relation === 'typed_link')
        )
        if (!exists && edges.length < MAX_EDGES) {
          edges.push({
            source: doc.file,
            target: targetDoc.file,
            relation: 'typed_link',
            weight: 1.0,  // typed links are high-confidence
          })
        }
      }
    }
  }

  // Tag-based edges (fast)
  for (let i = 0; i < documents.length; i++) {
    for (let j = i + 1; j < documents.length; j++) {
      const sharedTags = documents[i].tags.filter(t => documents[j].tags.includes(t))
      if (sharedTags.length > 0) {
        edges.push({
          source: documents[i].file,
          target: documents[j].file,
          relation: 'shared_tag',
          weight: sharedTags.length * 0.3,
        })
      }
    }
  }

  // Content-based edges (TF-IDF cosine similarity)
  // Only consider doc pairs where both have enough tokens (skip snippets)
  for (let i = 0; i < vectors.length && edges.length < MAX_EDGES; i++) {
    if (documents[i].tokens.size < MIN_TOKENS_FOR_SIMILARITY) continue
    for (let j = i + 1; j < vectors.length && edges.length < MAX_EDGES; j++) {
      if (documents[j].tokens.size < MIN_TOKENS_FOR_SIMILARITY) continue
      // Skip if already connected by tag
      const alreadyConnected = edges.some(
        e =>
          (e.source === documents[i].file && e.target === documents[j].file) ||
          (e.source === documents[j].file && e.target === documents[i].file)
      )
      if (alreadyConnected) continue

      const similarity = cosineSimilarity(vectors[i], vectors[j])
      if (similarity >= SIMILARITY_THRESHOLD) {
        edges.push({
          source: documents[i].file,
          target: documents[j].file,
          relation: 'similar_content',
          weight: similarity,
        })
      }
    }
  }

  return edges
}

export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  // Compute dot product and normA from vecA
  for (const [term, valueA] of vecA) {
    const valueB = vecB.get(term) ?? 0
    dotProduct += valueA * valueB
    normA += valueA * valueA
  }

  // Compute normB from vecB
  for (const [, valueB] of vecB) {
    normB += valueB * valueB
  }

  if (normA === 0 || normB === 0) return 0

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  // Early exit if even max possible dot product is below threshold
  if (dotProduct < COSINE_EARLY_ZERO * denominator) return 0

  return dotProduct / denominator
}

// ============ Helpers ============

export function getPageType(_file: string): string {
  // Return 'note' as default — real type comes from frontmatter/enrich, not folder path
  return 'note'
}

/**
 * Load type from folder-map.json (configurable, aligned with enrich.ts)
 */
export async function loadFolderToTypeMap(): Promise<Record<string, string>> {
  try {
    const map = await loadEnrichFolderMap()
    // Invert: folder → type
    const inverted: Record<string, string> = {}
    for (const [type, folder] of Object.entries(map)) {
      inverted[folder] = type
    }
    return inverted
  } catch {
    return {}
  }
}
