import { getVaultPath, searchFiles } from './database'
import { callAI } from './aiService'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import log from 'electron-log/main'

// ============ Types ============


export interface ChatMessage {
  id?: number
  session_id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: number
}

export interface ChatSession {
  id: string
  title: string
  created_at: number
  updated_at: number
}

interface RAGResult {
  file: string
  title: string
  snippet: string
  score: number
}

// ============ Chat Service ============

const MAX_CONTEXT_LENGTH = 8000
const SESSIONS_FILE = 'chat-sessions.json'

/**
 * Three-stage RAG pipeline: rewrite → retrieve → answer
 * Inspired by OpenWiki Ask Sidebar (wiki_ask)
 */
export async function askQuestion(
  question: string,
  contextMessages: ChatMessage[] = []
): Promise<{
  answer: string
  sources: { file: string; title: string; snippet: string }[]
  confidence: number
}> {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return { answer: '请先打开知识库。', sources: [], confidence: 0 }
  }

  try {
    // Stage 0: Rewrite query (extract key concepts)
    const searchQuery = await rewriteQuery(question, contextMessages)

    // Stage 1: Retrieve relevant pages via FTS5
    const results = await retrieveRelevantPages(searchQuery)
    log.info(`[RAG] found ${results.length} relevant pages for: ${question.slice(0, 50)}`)

    // Stage 2: Generate answer with context
    const { answer, confidence } = await generateAnswer(question, results, contextMessages)

    // Format sources
    const sources = results.slice(0, 3).map(r => ({
      file: r.file,
      title: r.title,
      snippet: r.snippet,
    }))

    return { answer, sources, confidence }
  } catch (err) {
    log.error('[RAG] ask failed:', (err as any).message)
    return {
      answer: `抱歉，搜索时出现错误：${(err as any).message}`,
      sources: [],
      confidence: 0,
    }
  }
}

export async function askQuestionStream(
  question: string,
  contextMessages: ChatMessage[] = []
): Promise<{ results: RAGResult[]; confidence: number }> {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return { results: [], confidence: 0 }
  }

  try {
    const searchQuery = await rewriteQuery(question, contextMessages)
    const results = await retrieveRelevantPages(searchQuery)
    log.info(`[RAG] stream found ${results.length} pages for: ${question.slice(0, 50)}`)
    return {
      results,
      confidence: Math.min(0.3 + results.length * 0.15, 1.0),
    }
  } catch (err) {
    log.error('[RAG] stream retrieve failed:', (err as any).message)
    return { results: [], confidence: 0 }
  }
}

/**
 * Build system + user prompts for streaming answer generation.
 */
export async function buildAnswerPrompt(
  question: string,
  results: RAGResult[],
  history: ChatMessage[]
): Promise<{ systemPrompt: string; userPrompt: string }> {
  const contextParts: string[] = []
  let totalChars = 0

  for (const r of results) {
    const fullContent = existsSync(r.file)
      ? (await readFile(r.file, 'utf-8')).slice(0, 1000)
      : r.snippet
    const block = `[来源: ${r.title}]\n${fullContent}`
    if (totalChars + block.length > MAX_CONTEXT_LENGTH) break
    contextParts.push(block)
    totalChars += block.length
  }

  const context = contextParts.join('\n\n---\n\n')
  const recentHistory = history.slice(-3)
    .map(m => `${m.role}: ${m.content.slice(0, 300)}`)
    .join('\n')

  const systemPrompt = `你是晓园 Vault 的知识助手。基于知识库中的内容回答问题。

规则：
1. 优先使用知识库内容回答
2. 如果知识库没有相关信息，诚实说明
3. 引用来源时使用 [[文件名]] 格式
4. 回答简洁，不超过 500 字
5. 可以结合对话历史理解上下文

对话历史：
${recentHistory || '(无)'}


知识库内容：
${context || '(无相关结果)'}`

  return {
    systemPrompt,
    userPrompt: question,
  }
}

// ============ Stage 0: Rewrite ============

async function rewriteQuery(
  question: string,
  history: ChatMessage[]
): Promise<string> {
  // If question is already keyword-like, use directly
  if (question.length < 50 && !question.includes('?')) {
    return question
  }

  // For simple questions, skip AI rewrite (cost saving)
  if (question.length < 30) {
    return question
  }

  try {
    const recentHistory = history.slice(-4)
      .map(m => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n')

    const rewritten = await callAI('reason', {
      question,
      context: [recentHistory],
      systemPrompt: `你是一个搜索查询重写助手。将用户的问题改写为1-2个关键词短语，用于在知识库中搜索。

规则：
- 提取核心概念，去除问句结构
- 中文保留原词，英文缩写保留
- 相关概念用空格分隔
- 最多返回20个字

用户问题: "${question}"
对话历史: ${recentHistory ? '最近对话：' + recentHistory : '无'}

只返回改写后的搜索词，不要解释。`,
    })

    // For 'reason' type, the function callAI returns the raw response
    // Clean up and truncate
    const cleaned = String(rewritten ?? question).trim().slice(0, 50)
    log.info(`[RAG] query rewrite: "${question.slice(0, 40)}" → "${cleaned}"`)
    return cleaned ?? question
  } catch {
    // Fall back to original question
    return question
  }
}

// ============ Stage 1: Retrieve ============

async function retrieveRelevantPages(query: string): Promise<RAGResult[]> {
  try {
    // Use FTS5 search
    const files = await searchFiles(query)

    if (!files || files.length === 0) {
      log.info('[RAG] FTS5 no results, trying broader search')
      // Broader: search with shorter query
      const shortQuery = query.split(/\s+/).slice(0, 2).join(' ')
      const broaderFiles = await searchFiles(shortQuery)
      if (!broaderFiles || broaderFiles.length === 0) {
        return []
      }
      return await fetchPageContents(broaderFiles.slice(0, 10), query)
    }

    return await fetchPageContents(files.slice(0, 10), query)
  } catch (err) {
    log.error('[RAG] retrieve failed:', (err as any).message)
    return []
  }
}

async function fetchPageContents(
  files: unknown[],
  query: string
): Promise<RAGResult[]> {
  const vaultPath = getVaultPath()
  if (!vaultPath) return []

  const results: RAGResult[] = []

  for (const f of files) {
    try {
      const filePath = f.path ?? join(vaultPath, f.name)
      const fullPath = filePath.startsWith('/') ? filePath : join(vaultPath, filePath)
      if (!existsSync(fullPath)) continue
      if (f.isDirectory) continue

      const content: string = await readFile(fullPath, 'utf-8')
      const title = String(f.title ?? f.name ?? filePath)

      // Extract relevant snippet
      const snippet = extractSnippet(content, query, 200)

      // TF-IDF-like score based on keyword density
      const keywords = query.split(/\s+/).filter(k => k.length > 1)
      const contentLower = content.toLowerCase()
      const queryLower = query.toLowerCase()
      let score = 0

      for (const kw of keywords) {
        const regex = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        const matches = contentLower.match(regex)
        if (matches) score += Math.min(matches.length, 10) * 0.1
      }

      // Score boost for exact matches in title
      if (title.toLowerCase().includes(queryLower)) score += 1
      if (title.toLowerCase().includes(keywords[0]?.toLowerCase() || '')) score += 0.5

      results.push({ file: filePath, title, snippet, score })
    } catch {
      // Skip inaccessible files
    }
  }

  // Sort by relevance score
  results.sort((a, b) => b.score - a.score)

  return results.slice(0, 5)
}

// ============ Stage 2: Generate Answer ============

async function generateAnswer(
  question: string,
  results: RAGResult[],
  history: ChatMessage[]
): Promise<{ answer: string; confidence: number }> {
  // Build context from retrieved pages
  const contextParts: string[] = []
  let totalChars = 0

  for (const r of results) {
    const fullContent = existsSync(r.file)
      ? (await readFile(r.file, 'utf-8')).slice(0, 1000)
      : r.snippet
    const block = `[来源: ${r.title}]\n${fullContent}`
    if (totalChars + block.length > MAX_CONTEXT_LENGTH) break
    contextParts.push(block)
    totalChars += block.length
  }

  const context = contextParts.join('\n\n---\n\n')
  const recentHistory = history.slice(-3)
    .map(m => `${m.role}: ${m.content.slice(0, 300)}`)
    .join('\n')

  try {
    const answer = await callAI('reason', {
      question,
      context: [context],
      systemPrompt: `你是晓园 Vault 的知识助手。基于知识库中的内容回答问题。

规则：
1. 优先使用知识库内容回答
2. 如果知识库没有相关信息，诚实说明
3. 引用来源时使用 [[文件名]] 格式
4. 回答简洁，不超过 500 字
5. 可以结合对话历史理解上下文

对话历史：
${recentHistory || '(无)'}

知识库内容：
${context || '(无相关结果)'}`,
    })

    const answerText = typeof answer === 'string' ? answer : String(answer ?? '')

    // Estimate confidence based on retrieved results
    const confidence = results.length > 0
      ? Math.min(0.3 + results.length * 0.15, 1.0)
      : 0.1

    return { answer: answerText, confidence }
  } catch (err) {
    log.error('[RAG] answer generation failed:', (err as any).message)
    return {
      answer: `AI 回答生成失败：${(err as any).message}。请尝试换个问法。`,
      confidence: 0,
    }
  }
}

// ============ Utilities ============

function extractSnippet(content: string, query: string, maxLen: number): string {
  const keywords = query.split(/\s+/).filter(k => k.length > 1)
  if (keywords.length === 0) return content.slice(0, maxLen) + '...'

  // Find best matching paragraph
  const paragraphs = content.split(/\n\n+/)
  let bestPara = content.slice(0, maxLen)
  let bestScore = 0

  for (const para of paragraphs) {
    let score = 0
    for (const kw of keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'gi')
      const matches = para.match(regex)
      if (matches) score += matches.length
    }
    if (score > bestScore) {
      bestScore = score
      bestPara = para
    }
  }

  return bestPara.length > maxLen
    ? bestPara.slice(0, maxLen) + '...'
    : bestPara
}

// ============ Session Management ============

export async function getSessionsDir(): Promise<string> {
  const vaultPath = getVaultPath()
  if (!vaultPath) throw new Error('No vault open')
  const dir = join(vaultPath, '.xiaoyuan', 'chat')
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
  return dir
}

export async function loadSessions(): Promise<ChatSession[]> {
  try {
    const dir = await getSessionsDir()
    const sessionsFile = join(dir, SESSIONS_FILE)
    if (!existsSync(sessionsFile)) return []
    const raw = await readFile(sessionsFile, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return []
  }
}

export async function saveSessions(sessions: ChatSession[]): Promise<void> {
  const dir = await getSessionsDir()
  await writeFile(join(dir, SESSIONS_FILE), JSON.stringify(sessions, null, 2), 'utf-8')
}

export async function createSession(firstQuestion: string): Promise<ChatSession> {
  const sessions = await loadSessions()
  const id = createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .slice(0, SHA256_SLICE)

  const session: ChatSession = {
    id,
    title: firstQuestion.slice(0, SESSION_TITLE_MAX_LEN),
    created_at: Date.now(),
    updated_at: Date.now(),
  }

  sessions.unshift(session)
  await saveSessions(sessions)
  return session
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await loadSessions()
  const filtered = sessions.filter(s => s.id !== sessionId)
  await saveSessions(filtered)

  // Delete messages file
  try {
    const dir = await getSessionsDir()
    const msgFile = join(dir, `${sessionId}.json`)
    if (existsSync(msgFile)) {
      const { unlink } = await import('fs/promises')
      await unlink(msgFile)
    }
  } catch {}
}

export async function loadMessages(sessionId: string): Promise<ChatMessage[]> {
  try {
    const dir = await getSessionsDir()
    const msgFile = join(dir, `${sessionId}.json`)
    if (!existsSync(msgFile)) return []
    const raw = await readFile(msgFile, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return []
  }
}

export async function saveMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
  const dir = await getSessionsDir()
  await writeFile(join(dir, `${sessionId}.json`), JSON.stringify(messages, null, 2), 'utf-8')

  // Update session timestamp
  const sessions = await loadSessions()
  const idx = sessions.findIndex(s => s.id === sessionId)
  if (idx >= 0) {
    sessions[idx].updated_at = Date.now()
    await saveSessions(sessions)
  }
}
