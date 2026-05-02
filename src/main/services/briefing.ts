import log from 'electron-log/main'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getVaultPath, listVaultFiles } from './database'
import { parseFrontmatter } from './frontmatter'
import { callAI } from './aiService'

export interface BriefingReport {
  date: string
  period: string       // e.g. "2026-04-28 ~ 2026-05-01"
  newPages: number
  updatedPages: number
  entities: string[]   // 新建的实体类型（人/公司/项目）
  highlights: string[]  // LLM 生成的要点列表
  health: string        // wiki 健康状态
  raw: string           // LLM 原始摘要
}

// ─── Daily/Weekly Briefing ─────────────────────────────────────────
//
// 用户打开 App 时展示：本周 wiki 发生了什么变化。
// 不只是索引重建，而是 LLM 读 log.md + index.md 生成人类可读的 briefing。

export async function generateBriefing(): Promise<BriefingReport> {
  const vaultPath = getVaultPath()
  if (!vaultPath) {
    return makeEmpty('未打开知识库')
  }

  try {
    // 1. Read operation log
    const logPath = join(vaultPath, 'log.md')
    const logRaw = await readFile(logPath, 'utf-8').catch(() => '')

    // 2. Read index
    const indexPath = join(vaultPath, 'index.md')
    const indexRaw = await readFile(indexPath, 'utf-8').catch(() => '')

    // 3. Get recent file changes (files updated in last 7 days)
    const recent = await getRecentChanges(vaultPath, 7)
    const period = getPeriodString(7)

    // 4. LLM 读 log + index + recent changes，生成 briefing
    const briefing = await generateLLMBriefing(logRaw, indexRaw, recent, period)
    return briefing
  } catch (err: any) {
    log.warn('[Briefing] failed:', err.message)
    return makeEmpty(`生成失败: ${err.message}`)
  }
}

// ─── LLM-generate briefing ──────────────────────────────────────────

async function generateLLMBriefing(
  logRaw: string,
  indexRaw: string,
  recentFiles: { path: string; title: string; type: string; updated: string }[],
  period: string
): Promise<BriefingReport> {
  // 截取 log.md 最后 100 行（避免 token 过多）
  const logLines = logRaw.split('\n').slice(-100).join('\n')
  const recentSummary = recentFiles
    .map(f => `- ${f.title} (${f.type || 'collection'}, ${f.updated})`)
    .join('\n')

  const prompt = `你是晓园 Vault 的知识管家。

请根据以下信息，生成一份本周的 wiki 变化简报。

## 时间范围
${period}

## 最近的页面更新（本周）
${recentSummary || '本周无更新'}

## 操作日志（最近 100 行）
${logLines || '无日志'}

## 任务
1. 数一数本周新增了多少页面，更新了多少页面
2. 识别新建的重要实体（人名、公司名、项目名）
3. 用 3-5 句话总结本周 wiki 的主要变化
4. 评估 wiki 的健康状态（增长速度、是否有死链/矛盾风险）

严格只基于提供的信息，不要编造。

返回严格 JSON（不要有解释）：
{
  "newPages": 数字,
  "updatedPages": 数字,
  "entities": ["实体1", "实体2"],
  "highlights": ["要点1", "要点2", "要点3"],
  "health": "健康状态描述（10字内）",
  "raw": "一段话总结本周变化（30字内）"
}`

  try {
    const result = await callAI('resolve', { prompt })
    const match = String(result).match(/\{[\s\S]*\}/)
    if (!match) return makeEmpty('LLM 返回格式异常')

    const p = JSON.parse(match[0])
    return {
      date: new Date().toISOString().slice(0, 10),
      period,
      newPages: typeof p.newPages === 'number' ? p.newPages : 0,
      updatedPages: typeof p.updatedPages === 'number' ? p.updatedPages : 0,
      entities: Array.isArray(p.entities) ? p.entities.slice(0, 5) : [],
      highlights: Array.isArray(p.highlights) ? p.highlights.slice(0, 5) : [],
      health: p.health ?? '未知',
      raw: p.raw ?? '',
    }
  } catch (err: any) {
    log.warn('[Briefing] LLM failed:', err.message)
    return makeEmpty(`LLM 失败: ${err.message}`)
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

async function getRecentChanges(
  vaultPath: string,
  days: number
): Promise<{ path: string; title: string; type: string; updated: string }[]> {
  const files = await listVaultFiles()
  const all = flattenFiles(files)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const results: { path: string; title: string; type: string; updated: string }[] = []

  for (const f of all) {
    if (f.isDirectory || !f.path.endsWith('.md')) continue
    try {
      const raw = await readFile(f.path, 'utf-8')
      const { frontmatter } = parseFrontmatter(raw)
      const updated = frontmatter.updated ?? ''
      if (updated) {
        const t = new Date(updated).getTime()
        if (t >= cutoff) {
          results.push({
            path: f.path,
            title: frontmatter.title ?? f.name.replace('.md', ''),
            type: frontmatter.type ?? 'collection',
            updated,
          })
        }
      }
    } catch {}
  }

  return results.sort((a, b) => (a.updated < b.updated ? 1 : -1))
}

function getPeriodString(days: number): string {
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return `${fmt(start)} ~ ${fmt(end)}`
}

function flattenFiles(files: any[]): any[] {
  const result: any[] = []
  for (const f of files) {
    result.push(f)
    if (f.children) result.push(...flattenFiles(f.children))
  }
  return result
}

function makeEmpty(reason: string): BriefingReport {
  return {
    date: new Date().toISOString().slice(0, 10),
    period: '',
    newPages: 0,
    updatedPages: 0,
    entities: [],
    highlights: [],
    health: reason,
    raw: reason,
  }
}
