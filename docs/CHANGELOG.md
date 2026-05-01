# 晓园 Vault 变更日志

> 版本：v1.1.0
> 更新：2026-04-29

---

## v1.1.0 (2026-04-29) — 交互体验大版本

### 🎨 编辑器
- **格式化工具栏**: B / I / H1-H3 / 链接 / 代码 / 表格 / 列表 / 引用
- **编辑/预览切换**: 实时 Markdown 渲染
- **字数统计**: 底部 footer 显示字数和阅读时间
- **代码块语法高亮**: syntaxHighlighting 扩展

### 🔍 搜索 & 导航
- **Ctrl+P QuickSwitcher**: 模糊搜索 + 关键词高亮 + ↑↓ 导航
- **Cmd+F 聚焦搜索**: 全局搜索框快捷键
- **搜索结果高亮**: 文件名/路径匹配词黄色标记

### 🤖 AI 增强
- **RAG 三阶段问答**: rewrite → FTS5 retrieve → AI answer
- **多 AI Provider**: Qwen / MiniMax / DeepSeek 可选切换
- **内容价值评估**: assessContentWorth 过滤低价值内容
- **多轮追问**: 对话历史上下文传递
- **会话持久化**: chat-sessions.json 自动保存/恢复
- **来源引用**: [[文件名]] 格式，可点击跳转

### 📥 悬浮球捕获
- 常驻桌面悬浮球 (点击展开 / 拖入保存)
- 拖拽文件到悬浮球 → 直接移动到 0-收集/
- 拖拽文件到文件夹 → 自动移动

### 🖱 交互增强
- **右键菜单**: 重命名 / 删除
- **悬停预览**: hover 文件显示摘要卡片
- **空状态引导**: 无文件/无搜索结果时提示操作
- **全局快捷键**: Cmd+Shift+O (显示窗口), Cmd+Shift+F (搜索)
- **拖拽移动**: 文件可拖到文件夹自动移动
- **导入结果区分**: ✅ 已转 Markdown / 📄 原始文件

### 📊 知识图谱
- 真实文件内容提取 [[双链]] 建边
- TF-IDF 余弦相似度自动建边
- 文件夹聚类可视化 (forceCluster)
- 滚轮缩放 / 拖拽 / 点击定位

### 🔧 架构改进
- **enrich 目录可配置**: folder-map.json 替代硬编码
- **Multi Provider 抽象**: aiService.ts 统一调用层
- **错误分类**: API Key / 超时 / 网络 / 通用
- **AutoAI 自动开机**: 首次启动创建默认设置

### 🐛 Bug 修复 (22 项)
- CSS token --color-accent-10/25 补全
- KnowledgeGraph Wiki link 真实读取
- AIChat 组件完善（会话持久化、session 管理）
- Toolbar 图谱/设置按钮连线
- SettingsPanel 渲染 + AI 模型切换
- IPC 暴露补全 (folderMap/graph/converter)
- dotenv 重复加载清理
- tray 图标有效 PNG
- forceCluster radius 修复
- FileTree onNewFile 空路径修复
- AIChat save 双重写入修复
- 悬浮球防重复创建

---

## v1.0.0 (2026-04-28) — MVP

### ✅ 核心功能
- Electron 桌面应用 + React 前端
- SQLite FTS5 全文搜索
- CodeMirror Markdown 编辑器 (33 行核心)
- Obsidian 风格 CSS (Apple 亮色主题)
- Qwen API AI 集成 (分类/标签/摘要/问答)
- 系统托盘 + 全局菜单
- 文件导入窗口 (拖拽上传)
- 知识图谱 D3 可视化
- AIChat 对话式交互
- autoAIEngine 定时自动整理
- 导入格式: PDF/Word/Excel/PPT/图片/音频/URL

### 🔧 技术栈
- Electron 34 + React 19 + TypeScript
- better-sqlite3 + FTS5
- CodeMirror 6
- D3.js
- electron-vite + electron-builder

---

## 晓园产品精简（2026-05-01）
- ✅ SettingsPanel 删减为仅 AI 模型选择（删除 AutoAI 分类/标签/摘要）
- ✅ Auth Gateway 完成（localhost:3000 + ngrok 外网穿透）
- ✅ 引用按钮功能完成（今天早些时候）
- ✅ 构建已通过


---

## Phase 0-2: LLM-Wiki 核心能力落地（2026-05-01）

### Phase 0: Typed Links 提取 ✅
- `extractTypedLinks(content)` — 解析 GBrain 格式 `[[类型:名称]]`
- 支持: person/company/project/meeting/deal/concept/research/event 等实体类型
- 自动推断关系类型(mentions/involves/related_to 等)
- 追加 `relationships` 字段, `confidence=EXTRACTED`

### Phase 1: Bidirectional Links ✅
- `updateBacklinksForFile()` — enrich 后自动补充反向链接
- `addBacklink(target, title, source)` — 向目标文件 seeAlso 追加(去重)
- `findFilesMentioningEntity()` — 扫描所有文件查找引用某 entity 的页面

### Phase 2: Enrich 多页面联动 ✅
- `enrichLinkedEntityPages()` — enrich 时联动更新关联实体页面
- `findEntityPage()` — vault 中查找 entity 已有 wiki 页面
- `appendTimelineEntry()` — 向已有页面追加时间线条目
- 有页面 → 追加 timeline; 无页面 → 记录待建

**效果示例:**
```
收到一篇关于"中科国生"的文章,含 [[公司:中科国生]] + [[人物:王五]]
→ 自动提取 relationships
→ 在红杉资本页面补充反向链接
→ 在中科国生已有页面的 timeline 追加条目
```

---

## LLM-first RESOLVER 升级（2026-05-01）

### 核心改变：从规则判断 → LLM 决定 action plan

**之前**：规则提取 typed links → 硬编码更新逻辑
**现在**：LLM 读完内容 → 返回完整 action plan → 代码执行

**resolver.ts** 全面重写：
- `resolveContentType()` 返回 LLM 决策的完整 plan：intent / entities / updates / summary / tags
- SYSTEM_PROMPT 让 LLM 做完整判断（不只是 type）

**enrich.ts** 接入 LLM plan：
- 用 `classification.entities` 替代 `extractTypedLinks()` 规则
- 用 `classification.updates` 替代硬编码更新逻辑
- 用 `classification.summary` / `classification.tags` 替代 reason/names

**效果**：内容来了，LLM 决定更新哪些页面、做什么动作

---

## LLM-first 迭代完成（2026-05-01）

### RESOLVER 升级：LLM 决定完整 action plan
- 不再规则分类 → LLM 读完内容返回 intent/entities/updates/summary/tags
- enrich.ts 接入 LLM plan：用 entities 替代规则提取

### Maintain + 矛盾检测
- `maintain.ts` 新增 LLM 矛盾检测
- `detectContradictions()`: 抽样页面，LLM 对比时间线 vs summary
- `Contradiction{oldValue, newValue, source, severity}`

### Daily/Weekly Briefing
- `briefing.ts`: 读取 log.md + index.md + recent changes
- `generateLLMBriefing()`: LLM 生成 newPages/updatedPages/entities/highlights/health
- IPC `briefing:get`: renderer 调用

### Signal Auto-Enrich（无感持续）
- `file:save` → 后台自动 enrich
- clipboard/import/url → 已有 enrich
- 效果：wiki 自己长出来，用户无感

### LLM-first 开发模式
- Typed Links 提取：LLM 解析 [[类型:名称]]
- Bidirectional Links：LLM 补充反向链接
- Enrich 多页面联动：LLM 判断相关页面 + 追加 timeline

---

## 平台统一 AI + 登录系统（2026-05-01）

### Auth Gateway（晓园账户系统）

**新增服务**：`auth-gateway/` 独立 Node.js 服务

- `/auth/email/login` GET 登录页（桌面 App 用）
- `/auth/email/send` / `/auth/email/verify` 邮箱验证码登录
- `/ai/query` AI 代理（JWT 验证 + Quota 扣减 + DeepSeek）
- JWT token + Quota 配额控制
- 免费用户 10次/天

### Electron 端登录集成

**新增 IPC routes**: auth:getToken / auth:getEmail / auth:clear / auth:openLogin

**electron-store 存储 JWT token**

**URL Scheme**: `xiaoyuan://` 注册，OAuth 回调捕获

**SettingsPanel 重写**：登录/登出按钮 + 账户状态显示

### AI 模型切换

- 默认模型：**DeepSeek V4 Flash**（¥1/M，比 Qwen 便宜 100x）
- 模型名称硬编码，SettingsPanel 不再可选
- AI 调用：有 token 时走 Auth Gateway（扣 quota），无 token 时直接调用

### 文件格式转换器修复

- PDF：`pdf-parse` v2 不兼容 → 改用 `pdftotext` 命令行
- XLSX：`XLSX.readFile` → `XLSX.default.readFile`（ESM 兼容）
- 图片 OCR：tesseract.js v7 API 变更 → `createWorker()` + `worker.recognize()`

### 代码清理

- 109 个 `any` 类型（待清理）
- 54 个 IPC handler 无权限控制（生产环境需加）
- 18 个空 catch 块（待处理）
