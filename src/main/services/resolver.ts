import log from 'electron-log/main'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { callAI } from './aiService'
import { getVaultPath } from './database'

export interface ResolverResult {
  type: string          // person/company/project/meeting/deal/concept/research/collection
  confidence: 'high' | 'medium' | 'low'
  reason: string        // 一句话解释
  suggestedFolder: string
  needsUserConfirm: boolean
  extractedNames: string[]
  extractedCompanies: string[]
}

const VALID_TYPES = ['person', 'company', 'project', 'meeting', 'deal', 'concept', 'research', 'collection']

// ─── Read RESOLVER.md from vault ─────────────────────────────────────

async function readResolverRules(): Promise<string> {
  const vaultPath = getVaultPath()
  if (!vaultPath) return DEFAULT_RULES

  const resolverPath = join(vaultPath, 'RESOLVER.md')
  if (!existsSync(resolverPath)) return DEFAULT_RULES

  try {
    return await readFile(resolverPath, 'utf-8')
  } catch {
    return DEFAULT_RULES
  }
}

const DEFAULT_RULES = `# RESOLVER - 内容路由决策树

收到内容后，判断内容类型（type）：
- 有人名 → type: person（和用户确认）
- 有公司名 → type: company（和用户确认）
- 有项目特征（里程碑/交付物/时间线）→ type: project
- 有会议时间+参与方 → type: meeting
- 有交易金额+条款 → type: deal
- 有方法论/框架/模型 → type: concept
- 有研究方法+结论+数据 → type: research
- 无法判断 → type: collection（进 0-收集/）`

// ─── Resolve content to type ─────────────────────────────────────────

export async function resolveContentType(
  content: string,
  contentTitle?: string
): Promise<ResolverResult> {
  const rules = await readResolverRules()
  const preview = content.slice(0, 3000)
  const titleHint = contentTitle ? `\n标题: ${contentTitle}` : ''

  const prompt = `${rules}

---

请根据上述决策树规则，分析以下内容。返回一个 JSON 对象：

内容${titleHint}：
${preview}

返回格式（严格 JSON，不要多余文字）：
{
  "type": "person|company|project|meeting|deal|concept|research|collection",
  "confidence": "high|medium|low",
  "reason": "一句话解释为什么选择这个类型",
  "suggestedFolder": "建议的文件夹名（如：1-人物、2-公司、0-收集等）",
  "needsUserConfirm": true,
  "extractedNames": ["识别的人名"],
  "extractedCompanies": ["识别的公司名"]
}`

  try {
    const result = await callAI('resolve', { prompt })
    const parsed = parseResolverResult(result as string)
    return parsed
  } catch (err: any) {
    log.error('[Resolver] classification failed:', err.message)
    return {
      type: 'collection',
      confidence: 'low',
      reason: `AI 分类失败，默认归入收集: ${err.message}`,
      suggestedFolder: '0-收集',
      needsUserConfirm: true,
      extractedNames: [],
      extractedCompanies: []
    }
  }
}

function parseResolverResult(raw: string): ResolverResult {
  // Try to extract JSON from AI response
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { type: 'collection', confidence: 'low', reason: '无法解析 AI 返回', suggestedFolder: '0-收集', needsUserConfirm: true, extractedNames: [], extractedCompanies: [] }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    const type = VALID_TYPES.includes(parsed.type) ? parsed.type : 'collection'
    const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low'

    return {
      type,
      confidence: confidence as 'high' | 'medium' | 'low',
      reason: parsed.reason || '',
      suggestedFolder: parsed.suggestedFolder || '0-收集',
      needsUserConfirm: parsed.needsUserConfirm !== false,
      extractedNames: Array.isArray(parsed.extractedNames) ? parsed.extractedNames : [],
      extractedCompanies: Array.isArray(parsed.extractedCompanies) ? parsed.extractedCompanies : []
    }
  } catch {
    return { type: 'collection', confidence: 'low', reason: 'AI 返回格式异常', suggestedFolder: '0-收集', needsUserConfirm: true, extractedNames: [], extractedCompanies: [] }
  }
}
