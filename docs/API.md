# 晓园 Vault API 文档

> 版本：v1.1
> 更新：2026-04-29

---

## 一、概述

晓园 Vault 使用 Electron IPC 通信，主进程暴露 API，渲染进程通过 preload 桥接调用。

**通信模式**：Request-Response（同步/异步）

**错误处理**：所有 API 返回 `Promise`， rejection 时返回错误信息。

---

## 二、API 状态

| API | 状态 | 说明 |
|-----|------|------|
| **Vault** | | |
| vault:create/open/getLast/clear | ✅ 已实现 | |
| **文件** | | |
| file:list/read/save/create/delete/rename/move | ✅ 已实现 | |
| file:search (FTS5) | ✅ 已实现 | SQLite 全文搜索 |
| file:search (Embedding) | 📋 规划中 | 语义搜索，Phase 2 |
| **AI** | | |
| ai:classify / ai:tags | ✅ 已实现 | 分类 + 标签提取 |
| ai:summary / ai:reason / ai:write | ✅ 已实现 | 摘要 / 推理 / 写作 |
| autoAI (get/save) | ✅ 已实现 | 自动定时执行引擎 |
| **剪贴板** | | |
| clipboard:listen | 🔄 开发中 | 系统级复制监听 |
| clipboard:save | 🔄 开发中 | 保存剪贴板内容 |
| **URL 抓取** | | |
| url:fetch | 🔄 开发中 | 网页内容抓取 + 解析 |
| url:extract | 🔄 开发中 | 正文提取 + Markdown 转换 |
| **协作** | | |
| git:* / permission:* | 📋 规划中 | Phase 3 |
| **企业** | | |
| audit:* / share:* / SSO | 📋 规划中 | Phase 4 |

---

## 三、API 列表

### 3.1 Vault 操作

| API | 说明 | 参数 | 返回 |
|-----|------|------|------|
| `vault:create` | 新建 Vault | - | `string \| null` (路径) |
| `vault:open` | 打开 Vault | - | `string \| null` (路径) |
| `vault:getLast` | 获取最近 Vault | - | `string \| null` |
| `vault:clear` | 清除 Vault 记录 | - | `boolean` |
| `vault:path` | 获取当前 Vault 路径 | - | `string \| null` |
| `vault:clear` | 清除最近记录 | - | `boolean` |

### 3.2 文件操作

| API | 说明 | 参数 | 返回 |
|-----|------|------|------|
| `file:list` | 列出文件 | - | `FileRecord[]` |
| `file:read` | 读取文件 | `filePath: string` | `string` |
| `file:save` | 保存文件 | `filePath, content` | `boolean` |
| `file:create` | 创建文件(模板) | `filePath, title, type?` | `boolean` |
| `file:delete` | 删除文件 | `filePath: string` | `boolean` |
| `file:rename` | 重命名文件 | `oldPath, newName` | `boolean` |
| `file:move` | 移动文件 | `filePath, newParent` | `boolean` |
| `file:search` | 搜索文件 | `query: string` | `FileRecord[]` |
| `file:import` | 批量导入 | `vaultPath, filePaths[]` | `ImportResult[]` |

### 3.3 文件夹操作

| API | 说明 | 参数 | 返回 |
|-----|------|------|------|
| `folder:create` | 创建文件夹 | `folderPath: string` | `boolean` |
| `folder:delete` | 删除文件夹 | `folderPath: string` | `boolean` |

### 3.4 AI 操作

| API | 说明 | 参数 | 返回 |
|-----|------|------|------|
| `ai:classify` | AI 分类 | `content, folders[]` | `string` |
| `ai:tags` | AI 标签 | `content: string` | `string[]` |
| `ai:summary` | AI 摘要 | `content: string` | `string` |
| `ai:reason` | AI 推理 | `question, context[]` | `string` |
| `ai:write` | AI 写作 | `outline: string` | `string` |

### 3.5 AutoAI 操作

| API | 说明 | 参数 | 返回 |
|-----|------|------|------|
| `autoAI:get` | 获取配置 | - | `AutoAISettings` |
| `autoAI:save` | 保存配置 | `settings: AutoAISettings` | `boolean` |

### 3.6 导入操作

| API | 说明 | 参数 | 返回 |
|-----|------|------|------|
| `import:fetchUrl` | 抓取 URL | `url: string` | `{title, content}` |
| `import:saveUrl` | 保存 URL 内容 | `vaultPath, title, content` | `string` |

---

## 四、类型定义

### 4.1 FileRecord

```typescript
interface FileRecord {
  path: string              // 相对路径
  name: string               // 文件名
  isDirectory: boolean      // 是否文件夹
  modified: number           // 修改时间（Unix ms）
  children?: FileRecord[]   // 子文件（文件夹）
  title?: string            // 提取的标题
  tags?: string             // 逗号分隔标签
}
```

### 4.2 ImportResult

```typescript
interface ImportResult {
  name: string              // 原文件名
  path: string              // 保存路径
  status: 'success' | 'error' | 'converted'
  error?: string            // 错误信息
  converted?: boolean       // 是否转换过
  mdPath?: string           // Markdown 路径
}
```

### 4.3 AutoAISettings

```typescript
interface AutoAISettings {
  enabled: boolean           // 是否启用
  interval: number          // 间隔（分钟）
  onClassify: boolean      // 自动分类
  onTags: boolean          // 自动标签
  onSummary: boolean       // 自动摘要
}
```

---

## 五、IPC Handler 实现

### 4.1 主进程注册

```typescript
// src/main/index.ts
import { ipcMain } from 'electron'

// Vault 操作
ipcMain.handle('vault:create', async () => { ... })
ipcMain.handle('vault:open', async () => { ... })

// 文件操作
ipcMain.handle('file:list', async () => { ... })
ipcMain.handle('file:read', async (_, filePath) => { ... })
ipcMain.handle('file:save', async (_, filePath, content) => { ... })
```

### 4.2 Preload 暴露

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Vault
  createVault: () => ipcRenderer.invoke('vault:create'),
  
  // File
  listFiles: () => ipcRenderer.invoke('file:list'),
  readFile: (path) => ipcRenderer.invoke('file:read', path),
  saveFile: (path, content) => ipcRenderer.invoke('file:save', path, content),
})
```

### 4.3 渲染进程调用

```typescript
// src/renderer/App.tsx
declare global {
  interface Window {
    api: {
      createVault: () => Promise<string | null>
      listFiles: () => Promise<FileRecord[]>
      readFile: (path: string) => Promise<string>
      saveFile: (path: string, content: string) => Promise<boolean>
    }
  }
}

// 使用
const files = await window.api.listFiles()
await window.api.saveFile(path, content)
```

---

## 五、详细接口说明

### 5.1 vault:create

**功能**：创建新 Vault

**参数**：无

**返回**：`string | null`（Vault 路径）

**创建内容**：
```
vault/
├── 0-收集/
├── .raw/
│   ├── 文档/
│   ├── 截图/
│   └── 来源/
├── .xiaoyuan/
│   └── index.db
├── RESOLVER.md
├── schema.md
├── index.md
└── log.md
```

### 5.2 file:list

**功能**：列出 Vault 所有文件

**参数**：无

**返回**：`FileRecord[]`（树形结构）

**示例**：
```json
[
  {
    "path": "0-收集",
    "name": "0-收集",
    "isDirectory": true,
    "modified": 1745760000000,
    "children": [
      {
        "path": "0-收集/笔记.md",
        "name": "笔记.md",
        "isDirectory": false,
        "modified": 1745760000000,
        "title": "笔记"
      }
    ]
  }
]
```

### 5.3 file:search

**功能**：全文搜索

**参数**：
- `query: string` - 搜索词

**返回**：`FileRecord[]`

**搜索范围**：title, name, content, tags

**示例**：
```typescript
const results = await window.api.searchFiles('张三')
// 返回匹配的文件列表
```

### 5.4 file:create

**功能**：创建带模板的新文件

**参数**：
- `filePath: string` - 完整路径
- `title: string` - 页面标题
- `type?: string` - 内容类型

**返回**：`boolean`

**模板结构**：
```markdown
---
title: 标题
type: collection
status: active
summary:
confidence: low
tags: []
openThreads: []
seeAlso: []
created: 2026-04-29
updated: 2026-04-29
---

# 标题

## 基本信息
- 暂无信息

## Open Threads
- [ ] 待补充

## See Also

---

## 时间线

## [2026-04-29] 创建 | 页面初始化
```

### 5.5 ai:classify

**功能**：AI 推荐分类

**参数**：
- `content: string` - 文件内容（前 2000 字符）
- `folders: string[]` - 可用文件夹列表

**返回**：`string`（建议的文件夹名）

**示例**：
```typescript
const folder = await window.api.aiClassify(
  '张三在某公司担任CEO...',
  ['1-人物', '2-公司', '3-项目']
)
// 返回: '1-人物'
```

### 5.6 ai:tags

**功能**：AI 提取标签

**参数**：
- `content: string` - 文件内容（前 2000 字符）

**返回**：`string[]`（标签列表，最多 5 个）

**示例**：
```typescript
const tags = await window.api.aiTags('张三在某公司担任CEO...')
// 返回: ['创始人', 'CEO', '科技']
```

### 5.7 ai:summary

**功能**：AI 生成摘要

**参数**：
- `content: string` - 文件内容（前 4000 字符）

**返回**：`string`（摘要，不超过 200 字）

### 5.8 ai:reason

**功能**：AI 推理问答

**参数**：
- `question: string` - 问题
- `context: string[]` - 上下文内容

**返回**：`string`（回答）

### 5.9 ai:write

**功能**：AI 写作

**参数**：
- `outline: string` - 大纲/主题

**返回**：`string`（生成的 Markdown）

---

## 七、错误处理

### 6.1 主进程错误

```typescript
// 主进程
ipcMain.handle('file:read', async (_, filePath) => {
  try {
    return await getFileContent(filePath)
  } catch (err) {
    log.error('file:read error:', err)
    throw err
  }
})
```

### 6.2 渲染进程处理

```typescript
try {
  const content = await window.api.readFile(path)
} catch (err: any) {
  console.error('读取失败:', err.message)
  // 显示错误提示
}
```

### 6.3 常见错误

| 错误 | 原因 | 处理 |
|------|------|------|
| `ENOENT` | 文件不存在 | 检查路径 |
| `EPERM` | 权限不足 | 提示用户 |
| `EBUSY` | 文件被占用 | 重试 |
| `ENOSPC` | 磁盘满 | 提示清理 |

---

## 八、AutoAI 配置

```typescript
// 获取配置
const settings = await window.api.getAutoAISettings()
console.log(settings.enabled)  // boolean

// 保存配置
await window.api.saveAutoAISettings({
  enabled: true,
  interval: 60,        // 每 60 分钟
  onClassify: true,
  onTags: true,
  onSummary: false
})
```

---

## 九、导入功能

### 8.1 file:import

**功能**：批量导入文件

**参数**：
- `vaultPath: string` - Vault 路径
- `filePaths: string[]` - 要导入的文件路径

**返回**：`ImportResult[]`

### 8.2 import:fetchUrl

**功能**：抓取网页内容

**参数**：
- `url: string` - 网址

**返回**：
```typescript
{
  title: string    // 网页标题
  content: string   // 提取的正文
}
```

### 8.3 import:saveUrl

**功能**：保存 URL 内容

**参数**：
- `vaultPath: string`
- `title: string`
- `content: string`

**返回**：`string`（保存的文件路径）

---

## 十、剪贴板功能

### 10.1 clipboard:listen

**功能**：监听系统剪贴板变化

**参数**：无

**返回**：`void`

**说明**：
- 主进程轮询剪贴板（1s 间隔）
- 检测到新内容时通过 IPC 通知渲染进程
- 渲染进程显示 Popup 确认框

**事件**：
```typescript
window.api.onClipboardNew((data: {
  content: string
  type: 'text' | 'url' | 'image'
  timestamp: number
}) => void)
```

### 10.2 clipboard:save

**功能**：保存剪贴板内容到 Vault

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| content | string | 剪贴板内容 |
| type | string | 内容类型 |

**返回**：`string`（保存的文件路径）

**保存位置**：`0-收集/clip-YYYYMMDD-HHMMSS.md`

**自动触发**：enrich 流程

---

## 十一、URL 抓取功能

### 11.1 url:fetch

**功能**：抓取网页内容

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| url | string | 目标 URL |

**返回**：`Promise<{title, content, author?, date?, url}>`

**处理流程**：
1. axios 获取 HTML
2. cheerio 解析结构
3. Readability 提取正文
4. turndown 转 Markdown
5. 返回结构化数据

**错误处理**：
- 超时（10s）→ 返回错误
- 403/封禁 → 尝试备用方案
- 解析失败 → 返回原始 HTML

### 11.2 url:extract

**功能**：URL 内容提取并保存

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| url | string | 目标 URL |
| folder | string | 保存目录（默认 0-收集/） |

**返回**：`string`（保存的文件路径）

**保存格式**：
```markdown
---
title: "原标题"
url: "https://..."
author: "作者"
date: "2026-04-28"
tags: ["auto-import", "web"]
source: "web"
created: 1745760000000
---

# 原标题

[原文链接](https://...)

提取的正文内容...
```

**自动触发**：enrich 流程（分类/标签/摘要）

## v1.1 新增接口

### Chat (RAG 问答)
| 接口 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `chat:ask` | RAG 三阶段问答 | `question, history[]` | `{answer, sources[], confidence}` |
| `chat:sessions` | 会话列表 | — | `ChatSession[]` |
| `chat:create` | 创建会话 | `firstQuestion` | `ChatSession` |
| `chat:load` | 加载消息 | `sessionId` | `ChatMessage[]` |
| `chat:save` | 保存消息 | `sessionId, messages[]` | `boolean` |
| `chat:delete` | 删除会话 | `sessionId` | `boolean` |

### Graph (知识图谱)
| 接口 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `graph:load` | 加载图谱数据 | — | `{nodes[], edges[]}` |
| `graph:rebuild` | 重建图谱 | — | `{nodes, edges}` |

### Clipboard (悬浮球捕获)
| 接口 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `clipboard:start` | 显示悬浮球 | `vaultPath` | `boolean` |
| `clipboard:stop` | 隐藏悬浮球 | — | `boolean` |
| `clipboard:setVaultPath` | 设置路径 | `vaultPath` | `boolean` |

### Converter (格式转换)
| 接口 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `converter:convert` | 文件转 Markdown | `filePath` | `{success, markdown?}` |
| `converter:supported` | 支持格式列表 | — | `string[]` |
| `converter:transcribe` | 音频转写 | `filePath` | `{success, text?}` |

### Provider (AI 模型)
| 接口 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `provider:get` | 获取当前 AI 模型 | — | `string` |
| `provider:set` | 设置 AI 模型 | `provider` | `boolean` |

### Folder Map (目录映射)
| 接口 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `folderMap:load` | 加载目录映射 | — | `Record<string,string>` |
| `folderMap:save` | 保存目录映射 | `map` | `boolean` |

### File Move (文件移动)
| 接口 | 说明 | 参数 | 返回 |
|------|------|------|------|
| `file:move` | 移动文件到文件夹 | `filePath, newParentDir` | `boolean` |

