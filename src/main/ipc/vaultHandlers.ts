/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { ipcMain, dialog, type BrowserWindow } from 'electron'
import { getMainWindowRef } from '../mainWindowRef'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { initDatabase, getVaultPath } from '../services/database'
import { startAutoAIEngine, stopAutoAIEngine } from '../services/autoAIEngine'
import { setVaultPath, showBubble, hideBubble } from '../services/clipboard'
import { triggerGraphRebuild } from '../graphUtils'

// Config path (same as main/index.ts)
const configPath = join(app.getPath('userData'), 'config.json')

async function readConfig(): Promise<Record<string, unknown>> {
  try {
    if (existsSync(configPath)) {
      return JSON.parse(await readFile(configPath, 'utf-8')) as Record<string, unknown>
    }
  } catch {}
  return {}
}

async function writeConfig(data: Record<string, unknown>): Promise<void> {
  await writeFile(configPath, JSON.stringify(data, null, 2), 'utf-8')
}

function getMainWindow(): BrowserWindow | null { return getMainWindowRef() }

export function registerVaultHandlers(): void {
  ipcMain.handle('vault:getLast', async () => {
    const config = await readConfig()
    const vaultPath = config.lastVaultPath as string | undefined
    if (vaultPath && existsSync(vaultPath)) {
      await initDatabase(vaultPath)
      await startAutoAIEngine()
      setVaultPath(vaultPath)
      showBubble(); triggerGraphRebuild()
      return vaultPath
    }
    return null
  })

  ipcMain.handle('vault:open', async () => {
    const mainWindow = getMainWindow()
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: '选择 Vault 文件夹'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const vaultPath = result.filePaths[0]
      await initDatabase(vaultPath)
      await writeConfig({ lastVaultPath: vaultPath })
      await startAutoAIEngine()
      setVaultPath(vaultPath)
      showBubble(); triggerGraphRebuild()
      return vaultPath
    }
    return null
  })

  ipcMain.handle('vault:create', async () => {
    const mainWindow = getMainWindow()
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '新建知识库',
      buttonLabel: '创建知识库',
      nameFieldStringValue: '我的知识库',
      properties: ['createDirectory']
    })
    if (!result.canceled && result.filePath) {
      const vaultPath = result.filePath
      await mkdir(vaultPath, { recursive: true })
      await initDatabase(vaultPath)
      await writeConfig({ lastVaultPath: vaultPath })
      await startAutoAIEngine()
      setVaultPath(vaultPath)
      showBubble(); triggerGraphRebuild()

      await mkdir(join(vaultPath, '0-收集'), { recursive: true })

      const rawDirs = ['文档', '截图', '来源']
      const rawPath = join(vaultPath, '.raw')
      for (const sub of rawDirs) {
        await mkdir(join(rawPath, sub), { recursive: true })
      }

      await writeFile(join(vaultPath, 'RESOLVER.md'), `# 知识库决策树

> 任何知识入库前，AI必须先读此文件

## 决策流程

收到内容后，判断：

1. **是用户提问？** → 走 query 技能
2. **是外部文件/链接？** → 走 ingest 技能
3. **是待处理的新内容？** → 走 enrich 技能

### enrich 判断逻辑

enrich 判断内容类型（type）：
- 有人名 → 和用户协商 → type: person
- 有公司名 → 和用户协商 → type: company
- 有项目特征 → 和用户协商 → type: project
- 有会议特征 → 和用户协商 → type: meeting

**目录由 type 决定，不写死。**
**每次遇到新类型，和用户协商创建新目录。**

---

*本文件由 AI 维护，如有争议由人类裁决。*
`, 'utf-8')

      await writeFile(join(vaultPath, 'schema.md'), `# 知识库规范

## 页面结构

每页分为上下两部分，以 \`---\` 分隔：

### 上方：编译真相（当前状态）

\`\`\`yaml
---
title: 页面标题
type: collection
status: active
summary: 一句话摘要
confidence: low
tags: []
openThreads:
  - [ ] 待补充
seeAlso:
  - [[相关页面A]]
relationships: []
created: 2026-04-27
updated: 2026-04-27
---

## 基本信息

## Open Threads

## See Also

---   <!-- 分界线，以下永不修改 -->

## 时间线（Append-only）

## [2026-04-27] 创建 | 页面初始化
\`\`\`

## frontmatter 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| title | ✅ | 页面标题 |
| type | ✅ | 内容类型 |
| status | ✅ | active/archived |
| summary | 建议 | 一句话摘要 |
| confidence | 建议 | high/medium/low |
| tags | 建议 | 标签 |
| openThreads | 建议 | 待办事项 |
| seeAlso | 建议 | 关联页面 |
| relationships | 建议 | 关系抽取 |
| created | ✅ | 创建日期 |
| updated | ✅ | 更新日期 |

## 双链格式

使用 \`[[页面名称]]\` 进行双向链接。

## 目录弹性原则

**技能只看 type，不看目录路径。**
`, 'utf-8')

      await writeFile(join(vaultPath, 'index.md'), `# 知识索引

> 本文件由 AI 自动维护，随内容变化更新

---

## 内容目录

| 目录 | 类型 | 页数 |
|------|------|------|
| 0-收集 | collection | - |

---

## 活跃页面

（AI 自动更新）

`, 'utf-8')

      await writeFile(join(vaultPath, 'log.md'), `# 操作日志

> 格式：\`## [日期] 操作类型 | 内容\`

---

`, 'utf-8')

      return vaultPath
    }
    return null
  })

  ipcMain.handle('vault:clear', async () => {
    await writeConfig({})
    await stopAutoAIEngine()
    hideBubble()
    return true
  })

  ipcMain.handle('vault:path', () => {
    return getVaultPath()
  })
}