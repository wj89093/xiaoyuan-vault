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
- AIPanel/AIGenerating CSS 清理
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
