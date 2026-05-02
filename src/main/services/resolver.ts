import log from 'electron-log/main'
import { callAI } from './aiService'

// ─── RESOLVER — LLM-first content action plan ───────────────────────
//
// gbrain 风格：不是规则判断，是 LLM 读完内容后决定动作。
//
// 简化 prompt：直接告诉 LLM 要返回什么字段，少废话。

export interface ResolverResult {
  intent: 'enrich' | 'query' | 'maintain' | 'unknown'
  type: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
  suggestedFolder: string
  needsUserConfirm: boolean
  extractedNames: string[]
  extractedCompanies: string[]
  // LLM-first 核心字段
  entities: Array<{ name: string; entityType: string; action: 'create' | 'update' | 'link' }>
  updates: Array<{ pageTitle: string; action: 'append_timeline' | 'add_seeAlso' | 'create' | 'noop'; entry?: string }>
  summary: string
  tags: string[]
}

const VALID_TYPES = ['person', 'company', 'project', 'meeting', 'deal', 'concept', 'research', 'collection']

// ─── Main entry ───────────────────────────────────────────────────

export async function resolveContentType(
  content: string,
  contentTitle?: string
): Promise<ResolverResult> {
  const preview = content.slice(0, 3000)
  const titleHint = contentTitle ? `\n标题：${contentTitle}` : ''

  // 精简 prompt，qwen3-flash 容易跟上
  const userPrompt = `${titleHint}
内容：
${preview}

分析这段内容，返回严格 JSON（不要解释，只要 JSON）：
{
  "intent": "enrich" | "query" | "maintain" | "unknown",
  "type": "person | company | project | meeting | deal | concept | research | collection",
  "confidence": "high | medium | low",
  "summary": "一句话摘要（20字内）",
  "tags": ["标签1", "标签2"],
  "entities": [{"name": "实体名", "entityType": "person|company|project|event", "action": "create|update|link"}],
  "updates": [{"pageTitle": "目标页面", "action": "append_timeline|add_seeAlso|create|noop", "entry": "时间线内容"}],
  "needsUserConfirm": false
}`

  try {
    const result = await callAI('resolve', {
      prompt: userPrompt,
      systemPrompt: '你是晓园 Vault 的知识库路由器。只返回 JSON。',
    })
    return parseResolverResult(result as string, contentTitle)
  } catch (err: any) {
    log.error('[Resolver] failed:', err.message)
    return makeDefault()
  }
}

function parseResolverResult(raw: string, fallbackTitle?: string): ResolverResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return makeDefault(fallbackTitle)

  try {
    const p = JSON.parse(jsonMatch[0])
    return {
      intent: ['enrich', 'query', 'maintain'].includes(p.intent) ? p.intent : 'enrich',
      type: VALID_TYPES.includes(p.type) ? p.type : 'collection',
      confidence: ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'medium',
      reason: p.reason || p.summary || '',
      suggestedFolder: p.suggestedFolder || '0-收集',
      needsUserConfirm: p.needsUserConfirm !== false,
      extractedNames: Array.isArray(p.extractedNames) ? p.extractedNames : [],
      extractedCompanies: Array.isArray(p.extractedCompanies) ? p.extractedCompanies : [],
      entities: Array.isArray(p.entities) ? p.entities : [],
      updates: Array.isArray(p.updates) ? p.updates : [],
      summary: p.summary || '',
      tags: Array.isArray(p.tags) ? p.tags : [],
    }
  } catch {
    return makeDefault(fallbackTitle)
  }
}

function makeDefault(title?: string): ResolverResult {
  return {
    intent: 'enrich',
    type: 'collection',
    confidence: 'low',
    reason: '解析失败，默认进入收集',
    suggestedFolder: '0-收集',
    needsUserConfirm: true,
    extractedNames: [],
    extractedCompanies: [],
    entities: [],
    updates: [],
    summary: '',
    tags: [],
  }
}
