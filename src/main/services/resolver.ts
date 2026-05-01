import log from 'electron-log/main'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { callAI } from './aiService'
import { getVaultPath } from './database'

// ─── LLM-first RESOLVER ─────────────────────────────────────────────
//
// gbrain 风格：不是规则判断，而是 LLM 读内容后决定动作。
//
// 核心改变：不再「AI 分类 → 规则决定动作」
//           而是「LLM 读内容 → 返回完整 action plan → 执行 action」
//
// action plan 结构：
// {
//   intent: 'enrich' | 'query' | 'maintain' | 'unknown',
//   type: 'person' | 'company' | ... (LLM 判断的内容类型),
//   entities: [{ name: string, entityType: string, action: 'create' | 'update' | 'link' }],
//   updates: [{ pageTitle: string, action: 'append_timeline' | 'add_seeAlso' | 'create' | 'noop', entry?: string }],
//   summary: string,        // LLM 生成的摘要
//   tags: string[],        // LLM 提取的标签
//   needsUserConfirm: boolean,
//   confidence: 'high' | 'medium' | 'low',
//   reason: string,         // 为什么要这样做
// }

export interface ResolverResult {
  intent: 'enrich' | 'query' | 'maintain' | 'unknown'
  type: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
  suggestedFolder: string
  needsUserConfirm: boolean
  extractedNames: string[]
  extractedCompanies: string[]
  // LLM-first 新增字段
  entities: Array<{ name: string; entityType: string; action: 'create' | 'update' | 'link' }>
  updates: Array<{ pageTitle: string; action: 'append_timeline' | 'add_seeAlso' | 'create' | 'noop'; entry?: string }>
  summary: string
  tags: string[]
}

// ─── System prompt：让 LLM 做完整判断 ───────────────────────────────────

const SYSTEM_PROMPT = `你是晓园 Vault 的智能路由助手。

收到一段内容后，你必须做出完整的判断并返回 JSON action plan。

## 判断流程

**第一步：判断意图（intent）**
- 内容是「用户新建/导入/剪贴板的原始资料」吗？→ intent: "enrich"
- 内容是「用户在问问题」吗？→ intent: "query"（当前 resolver 不处理 query，跳过）
- 内容是「维护类请求」吗（检查、修复、整理）？→ intent: "maintain"
- 无法判断 → intent: "unknown"

**第二步：识别实体（entities）**
从内容中提取所有提到的实体（人名/公司/项目/事件等），每个实体判断：
- action: "create"（需要新建页面）
- action: "update"（需要更新已有页面）
- action: "link"（只需要在 seeAlso 中关联）

**第三步：确定更新计划（updates）**
对每个实体，决定 wiki 中应该做什么：
- "append_timeline": 在该实体页面的时间线追加一条
- "add_seeAlso": 在该实体页面添加引用来源
- "create": 创建新的实体页面草稿
- "noop": 已知信息已足够，不需要操作

**第四步：生成摘要和标签**
- summary: 一句话描述这段内容（用于 frontmatter.summary）
- tags: 3-5 个标签（人名/公司/事件类型等）

## 输出格式

严格返回 JSON，不要有其他文字：

{
  "intent": "enrich",
  "type": "company|person|project|meeting|concept|collection",
  "confidence": "high|medium|low",
  "reason": "一句话说明判断理由",
  "suggestedFolder": "1-人物|2-公司|0-收集 等",
  "needsUserConfirm": true|false,
  "extractedNames": ["人名列表"],
  "extractedCompanies": ["公司名列表"],
  "entities": [
    {"name": "实体名", "entityType": "person|company|project|event", "action": "create|update|link"}
  ],
  "updates": [
    {"pageTitle": "目标页面标题", "action": "append_timeline|add_seeAlso|create|noop", "entry": "时间线内容"}
  ],
  "summary": "一句话摘要",
  "tags": ["标签1", "标签2"]
}`

// ─── RESOLVER 主函数 ─────────────────────────────────────────────

export async function resolveContentType(
  content: string,
  contentTitle?: string
): Promise<ResolverResult> {
  const preview = content.slice(0, 4000)
  const titleHint = contentTitle ? `\n内容标题：${contentTitle}` : ''

  const userPrompt = `请分析以下内容，返回完整的 action plan JSON：

${titleHint}

内容：
${preview}

只返回 JSON，不要有解释或其他文字。`

  try {
    const result = await callAI('resolve', {
      prompt: userPrompt,
      systemPrompt: SYSTEM_PROMPT,
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
      type: p.type || 'collection',
      confidence: ['high', 'medium', 'low'].includes(p.confidence) ? p.confidence : 'medium',
      reason: p.reason || '',
      suggestedFolder: p.suggestedFolder || '0-收集',
      needsUserConfirm: p.needsUserConfirm !== false,
      extractedNames: Array.isArray(p.extractedNames) ? p.extractedNames : [],
      extractedCompanies: Array.isArray(p.extractedCompanies) ? p.extractedCompanies : [],
      // LLM-first 新字段
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
