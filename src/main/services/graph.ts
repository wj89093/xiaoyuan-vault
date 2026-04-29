import { getVaultPath } from './database'
import { readFile, readdir, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'
import log from 'electron-log/main'

// ============ Types ============

interface GraphNode {
  id: string
  title: string
  page_type?: string
  tags?: string[]
  edge_count: number
}

interface GraphEdge {
  source: string
  target: string
  relation: 'shared_tag' | 'similar_content' | 'hyperlink'
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
}

// ============ Stopwords ============

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
    return JSON.parse(raw)
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

    // Step 4: Build nodes
    const nodes: GraphNode[] = documents.map(doc => {
      const incomingEdges = 0 // Will be updated after edge creation
      return {
        id: doc.file,
        title: doc.title,
        tags: doc.tags,
        page_type: getPageType(doc.file),
        edge_count: 0,
      }
    })

    // Step 5: Build edges via cosine similarity + tag overlap
    const edges: GraphEdge[] = buildEdges(documents, vectors, idf)

    // Step 6: Update edge counts on nodes
    const edgeCounts = new Map<string, number>()
    for (const edge of edges) {
      edgeCounts.set(edge.source, (edgeCounts.get(edge.source) || 0) + 1)
      edgeCounts.set(edge.target, (edgeCounts.get(edge.target) || 0) + 1)
    }
    for (const node of nodes) {
      node.edge_count = edgeCounts.get(node.id) || 0
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
  } catch (err: any) {
    log.error('[Graph] rebuild failed:', err.message)
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
  const filename = file.split('/').pop() || ''
  if (['index.md', 'log.md', 'RESOLVER.md', 'schema.md'].includes(filename)) {
    return null
  }

  // Extract title and tags from frontmatter
  let title = file.replace(/\.md$/, '').split('/').pop() || file
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

  return { file, title, tags, tokens }
}

function tokenize(text: string): Map<string, number> {
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
  const cjkChars = cleaned.match(cjkPattern) || []
  for (let i = 0; i < cjkChars.length - 1; i++) {
    const bigram = cjkChars[i] + cjkChars[i + 1]
    if (!STOPWORDS.has(bigram)) {
      tokenMap.set(bigram, (tokenMap.get(bigram) || 0) + 1)
    }
  }

  // English: split into words
  const words = cleaned.replace(/[^\u4e00-\u9fff\w]/g, ' ').split(/\s+/)
  for (const w of words) {
    if (w.length < 3 || w.length > 30) continue
    if (STOPWORDS.has(w)) continue
    if (/^\d+$/.test(w)) continue
    tokenMap.set(w, (tokenMap.get(w) || 0) + 1)
  }

  return tokenMap
}

// ============ TF-IDF ============

function computeTFIDF(documents: TFIDFDocument[]): {
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
        df.set(term, (df.get(term) || 0) + 1)
        seen.add(term)
      }
    }
    // Add tags as extra tokens
    for (const tag of doc.tags) {
      if (!seen.has(tag)) {
        df.set(tag, (df.get(tag) || 0) + 1)
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
      const termIdf = idf.get(term) || 1
      vec.set(term, tf * termIdf)
    }

    // Boost for tags
    for (const tag of doc.tags) {
      const termIdf = idf.get(tag) || 1
      vec.set(tag, (vec.get(tag) || 0) + 2 * termIdf)
    }

    vectors.push(vec)
  }

  return { vectors, idf }
}

// ============ Edge Building ============

function buildEdges(
  documents: TFIDFDocument[],
  vectors: Map<string, Map<string, number>>[],
  idf: Map<string, number>
): GraphEdge[] {
  const edges: GraphEdge[] = []
  const SIMILARITY_THRESHOLD = 0.15
  const MAX_EDGES = 200  // Cap to prevent explosion

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
  for (let i = 0; i < vectors.length && edges.length < MAX_EDGES; i++) {
    for (let j = i + 1; j < vectors.length && edges.length < MAX_EDGES; j++) {
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

function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (const [term, valueA] of vecA) {
    const valueB = vecB.get(term) || 0
    dotProduct += valueA * valueB
    normA += valueA * valueA
  }

  for (const [, valueB] of vecB) {
    normB += valueB * valueB
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ============ Helpers ============

function getPageType(file: string): string {
  if (file.startsWith('0-收集')) return 'resource'
  if (file.startsWith('1-人物')) return 'person'
  if (file.startsWith('2-公司')) return 'company'
  if (file.startsWith('3-项目')) return 'project'
  return 'note'
}
