/**
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */

 * Agent 文件系统协议适配器
 *
 * 监听 ~/.vault/commands/ 目录，外部 Agent 写指令文件触发 vault 操作。
 *
 * 指令文件格式：
 * {
 *   "action": "create" | "query" | "enrich" | "update_frontmatter",
 *   "id": "可选-用于结果关联",
 *   "params": { ... },
 *   "result": "写结果的文件路径（可选）"
 * }
 */

import { watch } from 'fs'
import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import log from 'electron-log/main'
import { enrichFile } from './enrich'
import { searchFiles } from './database'
import { saveFile } from './database'

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

const COMMANDS_DIR = join(process.env.HOME ?? '', '.vault', 'commands')

export async function startAgentAdapter(): Promise<void> {
  if (!existsSync(COMMANDS_DIR)) {
    await mkdir(COMMANDS_DIR, { recursive: true })
  }

  watch(COMMANDS_DIR, { persistent: false }, (event, filename) => {
    void (async () => {
      if (event !== 'rename' || !filename?.endsWith('.json')) return
      const filePath = join(COMMANDS_DIR, filename)
      // Wait for file to be fully written
      await new Promise(r => setTimeout(r, 200))
      await processCommand(filePath)
    })()
  })

  log.info('[AgentAdapter] started, watching:', COMMANDS_DIR)
}

async function processCommand(filePath: string): Promise<void> {
  let cmd: any
  try {
    if (!existsSync(filePath)) return
    const raw = await readFile(filePath, 'utf-8')
    cmd = JSON.parse(raw) as Record<string, unknown>
  } catch {
    log.error('[AgentAdapter] failed to parse command file:', filePath, e)
    return
  }

  const { action, params = {}, id, result: resultPath } = cmd

  log.info('[AgentAdapter] executing:', action, id ?? '')

  let output: unknown = { ok: false, action, id, error: 'unknown action' }

  try {
    switch (action) {
      case 'create': {
        const { path, content, frontmatter } = params
        if (!path || !content) throw new Error('missing path or content')
        const fileContent = frontmatter
          ? `---\n${Object.entries(frontmatter).map(([k,v]) => `${k}: ${String(v)}`).join('\n')}\n---\n\n${content}`
          : content
        await saveFile(path, fileContent)
        output = { ok: true, action, id, path }
        break
      }
      case 'query': {
        const { q } = params
        if (!q) throw new Error('missing query q')
        const results = await searchFiles(q)
        output = { ok: true, action, id, results }
        break
      }
      case 'enrich': {
        const { filePath: fpath } = params
        if (!fpath) throw new Error('missing filePath')
        const result = await enrichFile(fpath)
        output = { ok: true, action, id, ...result }
        break
      }
      case 'update_frontmatter': {
        const { filePath: fpath, updates } = params
        if (!fpath || !updates) throw new Error('missing filePath or updates')
        const raw = await readFile(fpath, 'utf-8')
        const fmLines: string[] = []
        const bodyLines: string[] = []
        let inFm = false
        for (const line of raw.split('\n')) {
          if (line.trim() === '---') {
            if (!inFm) { inFm = true; continue }
            else { inFm = false; continue }
          }
          if (inFm) fmLines.push(line)
          else if (line.trim()) bodyLines.push(line)
          else if (bodyLines.length > 0) bodyLines.push(line)
        }
        const fm: Record<string, string> = {}
        for (const l of fmLines) {
          const idx = l.indexOf(':')
          if (idx > 0) fm[l.slice(0, idx).trim()] = l.slice(idx+1).trim()
        }
        Object.assign(fm, updates)
        const newFm = Object.entries(fm).map(([k,v]) => `${k}: ${String(v)}`).join('\n')
        const newContent = `---\n${newFm}\n---\n\n${bodyLines.join('\n')}`
        await writeFile(fpath, newContent, 'utf-8')
        output = { ok: true, action, id }
        break
      }
      default:
        output.error = `unknown action: ${action}`
    }
  } catch (_e: any) {
    output = { ok: false, action, id, error: e.message }
    log.error('[AgentAdapter] error:', _e)
  }

  // Write result if requested
  if (resultPath) {
    try {
      await writeFile(resultPath, JSON.stringify(output, null, 2), 'utf-8')
    } catch {}
  }

  // Delete command file
  try { await unlink(filePath) } catch {}
}
