import log from 'electron-log/main'
import { readFile } from 'fs/promises'
import { callAI } from './aiService'
import { searchFiles, getVaultPath } from './database'

export interface QueryResult {
  question: string
  answer: string
  sources: { path: string; title: string; snippet: string }[]
}

// ─── Query: search + AI synthesize ────────────────────────────────────

export async function queryVault(question: string): Promise<QueryResult> {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return { question, answer: '未打开知识库', sources: [] }
  }

  try {
    // Step 1: FTS5 search for relevant files
    const searchResults = await searchFiles(question)
    if (searchResults.length === 0) {
      return { question, answer: '知识库中没有找到相关内容', sources: [] }
    }

    // Step 2: Read top 5 matching files
    const topFiles = searchResults.slice(0, 5)
    const contexts: { path: string; title: string; content: string }[] = []

    for (const file of topFiles) {
      try {
        const content = await readFile(file.path, 'utf-8')
        contexts.push({
          path: file.path,
          title: file.title ?? file.name,
          content: content.slice(0, 2000)
        })
      } catch {
        // Skip unreadable files
      }
    }

    // Step 3: Build RAG context
    const contextText = contexts.map(c =>
      `【${c.title}】(路径: ${c.path})\n${c.content}`
    ).join('\n\n---\n\n')

    // Step 4: AI synthesize answer
    const prompt = `你是晓园知识库的查询助手。基于以下知识库内容回答用户问题。

知识库内容：
${contextText}

用户问题：${question}

要求：
1. 基于知识库内容回答，不要编造
2. 引用来源时使用格式：[[页面标题]]
3. 如果知识库内容不足以回答，明确说明
4. 回答简洁，直接给出结论

回答：`

    const answer = await callAI('reason', { question: prompt, context: [] }) as string

    // Step 5: Build source list
    const sources = contexts.map(c => ({
      path: c.path,
      title: c.title,
      snippet: c.content.slice(0, 100) + '...'
    }))

    return {
      question,
      answer: typeof answer === 'string' ? answer : JSON.stringify(answer),
      sources
    }
  } catch (err) {
    log.error('[Query] failed:', (err as any).message)
    return { question, answer: `查询失败: ${(err as any).message}`, sources: [] }
  }
}
