# 晓园 Vault

> AI 原生的个人/团队知识库，类 Obsidian · macOS 桌面应用

![macOS](https://img.shields.io/badge/macOS-13+-blue) ![Electron](https://img.shields.io/badge/Electron-34-green) ![React](https://img.shields.io/badge/React-19-blueviolet) ![v1.1](https://img.shields.io/badge/version-1.1-orange)

---

## 一句话

**面向 10 人团队的个人/团队知识库，类 Obsidian，AI 原生设计。**

---

## 核心特性

### 🤖 AI 原生
- AI 会话持久化 + RAG 三阶段检索
- 定时 AutoAI（分类 / 标签 / 摘要）
- 内容价值评估（assess → compile → link）
- 目录映射可配置（folder-map.json）

### 📝 Markdown 编辑器
- 格式化工具栏（B / I / H1-H3 / 链接 / 代码 / 表格 / 列表 / 引用）
- 编辑 / 预览切换 + 实时字数统计
- 双层页面结构（frontmatter + timeline）

### 🔗 知识图谱
- 真实文件内容提取 [[双链]] + frontmatter tags
- D3 力导向图 (TF-IDF 建边 + 文件夹聚类)
- 滚轮缩放 / 拖拽 / 点击定位

### 🔍 全文搜索
- SQLite FTS5 + 关键词高亮
- Ctrl+P 文件快速切换（模糊搜索）
- 悬停文件预览摘要

### 📥 多渠道导入
- 拖拽上传 / URL 抓取 / 剪贴板 / Finder 拖入
- PDF / Word / Excel / 图片 OCR / 音频转写
- 导入结果区分 转换/原始文件

### ⚡ 交互体验
- 全局快捷键 (Cmd+Shift+O/F) + 应用内 (Ctrl+P/F)
- 悬浮球快速捕获 (点击展开 / 拖入保存)
- 右键菜单 (重命名 / 删除)
- 拖拽文件到文件夹自动移动

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Electron 34 + React 19 |
| 编辑器 | CodeMirror 6 + syntaxHighlighting |
| 数据库 | SQLite + better-sqlite3 + FTS5 |
| 图谱 | D3.js force simulation |
| AI | 多 Provider (Qwen / MiniMax / DeepSeek) |
| 导入 | pdf-parse / mammoth / xlsx / tesseract.js |
| 构建 | electron-vite + electron-builder |

---

## 快速开始

```bash
git clone https://github.com/wj89093/xiaoyuan-vault.git
cd xiaoyuan-vault && npm install
cp .env.example .env   # 填入 AI API Key
npm run dev             # 启动开发
npm run build           # 构建
```

---

## 文档

| 文档 | 说明 |
|------|------|
| [PRD.md](./PRD.md) | 产品定义 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 架构设计 |
| [DATABASE.md](./DATABASE.md) | 数据库设计 |
| [API.md](./API.md) | 接口文档 |
| [CHANGELOG.md](./CHANGELOG.md) | 变更日志 |
| [DEPLOY.md](./DEPLOY.md) | 部署指南 |
| [SKILLS.md](./SKILLS.md) | 技能系统 |

---

## Roadmap

### Phase 1 ✅ 已完成 (v1.1)
- [x] AIChat RAG 问答 + 会话持久化
- [x] Ctrl+P QuickSwitcher + 全局快捷键
- [x] 知识图谱自动建边
- [x] 悬浮球捕获 + 拖拽文件移动
- [x] 编辑器格式化工具栏 + 预览
- [x] autoAIEngine 自动化
- [x] 多 AI Provider 支持
- [x] enrich/query/maintain 全链路

### Phase 2 📋 规划
- [ ] 深色模式
- [ ] Embedding 语义搜索
- [ ] 多 Vault 管理
- [ ] 模板系统

### Phase 3
- [ ] Git 协作
- [ ] 权限控制
- [ ] 分享 / Publish

---

## 定价

| 座位 | 月费 | 年费 |
|------|------|------|
| 第 1 人 | ¥0 | ¥0 |
| 每增加 1 人 | ¥19/月 | ¥190/年 |

---

## License

MIT © 晓园团队
