import log from 'electron-log/main'
import { callAI } from './aiService'

// ─── RESOLVER — LLM-first content action plan ───────────────────────
//
// gbrain 风格：不是规则判断，是 LLM 读完内容后决定动作。
//
// 简化 prompt：直接告诉 LLM 要返回什么字段，少废话。

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-invalid-this, @typescript-eslint/unbound-method */

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result: unknown = await callAI('resolve', {
      prompt: userPrompt,
      systemPrompt: '你是晓园 Vault 的知识库路由器。只返回 JSON。',
    })
    return parseResolverResult(result as string, contentTitle)
  } catch (err) {
    log.error('[Resolver] failed:', (err as Error).message)
    return makeDefault()
  }
}

function parseResolverResult(raw: string, fallbackTitle?: string): ResolverResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return makeDefault(fallbackTitle)

  try {
    const p = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return {
      intent: ['enrich', 'query', 'maintain'].includes(p.intent as string) ? p.intent as string : 'enrich',
      type: VALID_TYPES.includes(p.type as string) ? p.type as string : 'collection',
      confidence: ['high', 'medium', 'low'].includes(p.confidence as string) ? p.confidence as string : 'medium',
      reason: String(p.reason as string || p.summary as string || ''),
      suggestedFolder: String(p.suggestedFolder as string | undefined ?? '0-收集'),
      needsUserConfirm: p.needsUserConfirm !== false,
      extractedNames: (p.extractedNames as unknown[]) as string[],
      extractedCompanies: (p.extractedCompanies as unknown[]) as string[],
      entities: (p.entities as unknown[]) as { name: string; entityType: string; action: "create" | "update" | "link" }[],
      updates: (p.updates as unknown[] | undefined) as { name: string; entityType: string; action: "create" | "update" | "link"; }[],
      summary: String(p.summary as string || ''),
      tags: (p.tags as unknown[]) as string[],
    }
  } catch {
    return makeDefault(fallbackTitle)
  }
}

function makeDefault(_title?: string): ResolverResult {
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
