# 晓园 Vault 架构文档

> 版本：v1.2
> 更新：2026-05-01

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
│  │  RAG 问答     │  │  图谱引擎    │  │  electron-store     │  │
│  │   (chat)     │  │   (graph)   │  │   (auth token)      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 IPC Handler (40+ routes)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTPS (有 token 时)
              ┌───────────────▼────────────────┐
              │      Auth Gateway (ngrok)       │
              │   JWT 验证 + Quota 控制         │
              │   统一调用 DeepSeek V4 Flash   │
              └────────────────────────────────┘
                              │
                         DeepSeek API
```

---

## 二、技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Electron + React + TypeScript | 34 / 19 / 5.x |
| 编辑器 | CodeMirror 6 + syntaxHighlighting | 6.x |
| 数据库 | SQLite + better-sqlite3 + FTS5 | 3.x |
| 图谱 | D3.js force simulation | 7.x |
| AI | **DeepSeek V4 Flash**（默认，¥1/M）| OpenAI-compatible |
| 导入 | pdftotext / mammoth / xlsx / tesseract.js v7 | - |
| 鉴权 | **Auth Gateway** + JWT + electron-store | - |
| 构建 | electron-vite + electron-builder | 3.x / 26.x |

---

## 三、服务清单 (16 个)

| 服务 | 文件 | 说明 |
|------|------|------|
| database | `database.ts` | SQLite FTS5 + CRUD |
| frontmatter | `frontmatter.ts` | YAML 解析 / 模板生成 |
| autoAIEngine | `autoAIEngine.ts` | 定时 AI 分类/标签/摘要 + assess 过滤 |
| aiService | `aiService.ts` | AI 调用 + **callAIGateway** (Quota 模式) |
| chat | `chat.ts` | RAG 三阶段问答 + 会话持久化 |
| graph | `graph.ts` | TF-IDF 图谱自动建边 |
| enrich | `enrich.ts` | 文件富化 + LLM-first 多页面联动 |
| clipboard | `clipboard.ts` | 悬浮球捕获 + 拖拽 |
| urlFetch | `urlFetch.ts` | Jina Reader + 平台专用抓取 |
| converters | `converters.ts` | PDF(pdftotext)/Word/Excel/图片OCR(tesseract.js v7) |
| resolver | `resolver.ts` | **LLM-first** 内容 action plan 判断 |
| query | `query.ts` | 语义搜索 |
| maintain | `maintain.ts` | 知识库维护 + **LLM 矛盾检测** |
| **briefing** | `briefing.ts` | **Daily/Weekly wiki 变化摘要 (LLM 生成)** |
| whisper | `whisper.ts` | 语音转写 (需模型) |
| agentAdapter | `agentAdapter.ts` | 文件系统协议 Agent 接入口 |

---

## 四、前端组件清单 (13 个)

| 组件 | 说明 |
|------|------|
| App | 主容器 + 状态管理 |
| WelcomeScreen | 新建/打开 Vault 引导 |
| FileTree | 文件树 + 悬停预览 + 右键菜单 + 拖拽移动 |
| Editor | CodeMirror + **引用到AI按钮** + 编辑/预览切换 |
| EditorToolbar | 格式化按钮 + **引用到AI (FileText)** |
| AIChat | RAG 问答 + 会话历史 + 来源引用 |
| QuickSwitch | Ctrl+P 文件快速搜索 |
| KnowledgeGraph | D3 力导向图谱 (缩放/拖拽/点击) |
| SearchResults | FTS5 搜索结果 + 关键词高亮 |
| **SettingsPanel** | **账户登录 + AI 模型显示**（无模型选择）|
| Toolbar | 新建文件/文件夹/图谱/设置 |
| DropZone | 拖拽上传区域 |
| ImportApp | 导入窗口 (文件/URL) |

---

## 五、IPC 接口 (40+ routes)

### Vault: vault:open / create / getLast / clear / path
### File: file:list / search / read / create / save / rename / delete / move / import
### Folder: folder:create / folder:delete
### **Auth**: auth:getToken / auth:getEmail / auth:clear / auth:openLogin
### AI: ai:classify / tags / summary / **ai:reason (走 Gateway 扣 quota)**
### Chat: chat:ask / sessions / create / load / save / delete
### Graph: graph:load / rebuild
### Enrich: enrich:file / confirm / inbox
### **Briefing**: briefing:get
### Others: url:fetch / save, clipboard:start/stop/setVaultPath, provider:get/set, folderMap:load/save, converter:convert/supported/transcribe, maintain:run, query:vault, import:open, resolver:classify

---

## 六、Auth Gateway（晓园账户系统）

位于 `auth-gateway/`，独立 Node.js 服务，通过 ngrok 暴露给 Electron。

### 核心端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/auth/email/send` | POST | 发送邮箱验证码 |
| `/auth/email/verify` | POST | 验证验证码，返 JWT |
| `/auth/email/login` | GET | **登录页面**（桌面 App 用）|
| `/auth/register` | POST | 注册 |
| `/auth/login` | POST | 密码登录 |
| `/user/quota` | GET | 查询配额 |
| `/user/profile` | GET | 用户信息 |
| **`/ai/query`** | POST | **AI 代理（鉴权+扣 quota）** |
| `/admin/stats` | GET | 管理后台统计 |

### AI Quota 扣费逻辑

```
请求 → JWT 验证 → Quota 检查 → DeepSeek V4 Flash → 扣 daily_used + total_tokens
```

- 免费用户：10次/天
- 超出：返回 403

### URL Scheme 回调

登录成功 → `xiaoyuan://auth/callback?token=xxx&email=xxx` → Electron 捕获 → 存 electron-store

### 环境变量

```bash
DEEPSEEK_API_KEY=xxx          # 主 AI key（¥1/M）
QWEN_API_KEY=xxx             # 备用
JWT_SECRET=xxx
PORT=3000
AUTH_GATEWAY_URL=https://xxx.ngrok-free.dev  # Electron 端配置
```
