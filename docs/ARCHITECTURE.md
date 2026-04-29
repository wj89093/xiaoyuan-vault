# 晓园 Vault 架构文档

> 版本：v1.1
> 更新：2026-04-29

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron 主进程                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   SQLite FTS5 │  │  AutoAI 引擎  │  │     系统托盘         │  │
│  │  (database)  │  │(autoAIEngine) │  │    (tray)           │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  悬浮球捕获   │  │  URL 抓取    │  │     文件导入         │  │
│  │ (clipboard)  │  │ (urlFetch)  │  │   (importWindow)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  RAG 问答     │  │  图谱引擎    │  │     AI 服务          │  │
│  │   (chat)     │  │   (graph)   │  │   (aiService)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 IPC Handler (30+ routes)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC
┌─────────────────────────────────────────────────────────────────┐
│                      Electron 渲染进程                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  侧边栏       │  │  编辑器       │  │     AIChat          │  │
│  │ FileTree     │  │ Editor+      │  │   (RAG 问答)        │  │
│  │ Search       │  │ CodeMirror   │  │                     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ QuickSwitcher│  │ KnowledgeGraph│  │   SettingsPanel     │  │
│  │ (Ctrl+P)    │  │   (D3)       │  │                     │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Electron + React + TypeScript | 34 / 19 / 5.x |
| 编辑器 | CodeMirror 6 + syntaxHighlighting | 6.x |
| 数据库 | SQLite + better-sqlite3 + FTS5 | 3.x |
| 图谱 | D3.js force simulation | 7.x |
| AI | Qwen / MiniMax M2.7 / DeepSeek V4 | OpenAI-compatible |
| 导入 | pdf-parse / mammoth / xlsx / tesseract.js | - |
| 构建 | electron-vite + electron-builder | 3.x / 26.x |

---

## 三、服务清单 (12 个)

| 服务 | 文件 | 说明 |
|------|------|------|
| database | `database.ts` | SQLite FTS5 + CRUD |
| frontmatter | `frontmatter.ts` | YAML 解析 / 模板生成 |
| autoAIEngine | `autoAIEngine.ts` | 定时 AI 分类/标签/摘要 + assess 过滤 |
| aiService | `aiService.ts` | 多 Provider AI 调用 (Qwen/MiniMax/DeepSeek) |
| qwen | `qwen.ts` | Qwen API 原生实现 |
| chat | `chat.ts` | RAG 三阶段问答 + 会话持久化 |
| graph | `graph.ts` | TF-IDF 图谱自动建边 |
| enrich | `enrich.ts` | 文件富化 + 可配置目录映射 |
| clipboard | `clipboard.ts` | 悬浮球捕获 + 拖拽 |
| urlFetch | `urlFetch.ts` | Jina Reader + 平台专用抓取 |
| converters | `converters.ts` | PDF/Word/Excel/图片转换 |
| resolver | `resolver.ts` | 内容类型分类 |
| query | `query.ts` | 语义搜索 |
| maintain | `maintain.ts` | 知识库维护 |
| whisper | `whisper.ts` | 语音转写 (需模型) |

---

## 四、前端组件清单 (12 个)

| 组件 | 说明 |
|------|------|
| App | 主容器 + 状态管理 |
| WelcomeScreen | 新建/打开 Vault 引导 |
| FileTree | 文件树 + 悬停预览 + 右键菜单 + 拖拽移动 |
| Editor | CodeMirror + EditorToolbar + 编辑/预览切换 |
| EditorToolbar | 格式化按钮 (B/I/H/code/table/list/quote) |
| AIChat | RAG 问答 + 会话历史 + 来源引用 |
| QuickSwitch | Ctrl+P 文件快速搜索 |
| KnowledgeGraph | D3 力导向图谱 (缩放/拖拽/点击) |
| SearchResults | FTS5 搜索结果 + 关键词高亮 |
| SettingsPanel | AutoAI 配置 + AI 模型选择 |
| Toolbar | 新建文件/文件夹/图谱/设置 |
| DropZone | 拖拽上传区域 |
| ImportApp | 导入窗口 (文件/URL) |

---

## 五、IPC 接口 (30+ routes)

### Vault: vault:open / create / getLast / clear / path
### File: file:list / search / read / create / save / rename / delete / move / import
### Folder: folder:create / folder:delete
### AI: ai:classify / tags / summary / reason / write
### Chat: chat:ask / sessions / create / load / save / delete
### Graph: graph:load / rebuild
### Enrich: enrich:file / confirm / inbox
### Others: url:fetch / save, clipboard:start/stop, provider:get/set, folderMap:load/save, converter:convert/supported/transcribe, maintain:run, query:vault, import:open
