# 晓园 Vault

> AI 原生的个人/团队知识库，类 Obsidian

![macOS](https://img.shields.io/badge/macOS-13+-blue)
![Electron](https://img.shields.io/badge/Electron-34-green)
![React](https://img.shields.io/badge/React-19-blueviolet)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## 一句话

**面向 10 人团队的个人/团队知识库，类 Obsidian，AI 原生设计。**

---

## 核心特性

### 🤖 AI 原生设计

- AI 和用户充分沟通后建设知识库
- 目录随业务调整而弹性变化
- 技能不依赖目录，看 type 不看路径

### 📚 双层页面结构

- **上方**：编译真相（当前状态）
- **下方**：时间线（Append-only，知识可积累）

### 🔗 知识图谱

- 自动抽取 [[双链]] 关系
- D3 力导向图可视化
- Typed links + 置信度标签

### 🔍 混合搜索

- SQLite FTS5 全文搜索
- Embedding 语义搜索（Phase 2）
- RRF 综合排名（Phase 2）

---

## 快速开始

### 下载安装

| 平台 | 下载 |
|------|------|
| macOS | `.dmg` 安装包（即将发布）|
| Windows | `.exe` 安装包（即将发布）|

### 开发环境

```bash
# 克隆项目
git clone https://github.com/your-repo/xiaoyuan-vault.git
cd xiaoyuan-vault

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 QWEN_API_KEY

# 启动开发
npm run dev
```

### 构建生产版本

```bash
npm run build      # 构建
npm run package    # 打包安装包
```

---

## 界面预览

```
┌──────────────────────────────────────────────────────────────┐
│  工具栏（新建文件 / 新建文件夹 / 知识图谱）                   │
├─────────────┬──────────────────────────────┬─────────────────┤
│  📁 文件树   │  📝 Markdown 编辑器          │  🤖 AI 助手     │
│             │                              │                 │
│  0-收集/   │  ---                         │  [AI 分类]      │
│  1-人物/    │  title: 张三                 │  [AI 标签]      │
│  2-公司/    │  type: person               │  [AI 摘要]      │
│             │  status: active              │  [AI 推理]      │
│             │  ---                         │  [AI 写作]      │
│             │  ## 基本信息                  │                 │
│             │  ## Open Threads            │                 │
│             │  ---                         │                 │
│             │  ## 时间线（Append-only）    │                 │
└─────────────┴──────────────────────────────┴─────────────────┘
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **桌面前端** | React 19 + Electron 34 |
| **编辑器** | CodeMirror 6 |
| **数据库** | SQLite + FTS5 |
| **AI** | 通义千问 API (Qwen3.5-Flash) |
| **图谱** | D3.js |

---

## 文档

| 文档 | 说明 |
|------|------|
| [PRD.md](./PRD.md) | 产品定义 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 架构设计 |
| [docs/DATABASE.md](./docs/DATABASE.md) | 数据库设计 |
| [docs/SKILLS.md](./docs/SKILLS.md) | 技能系统 |
| [docs/API.md](./docs/API.md) | 接口文档 |
| [docs/DEPLOY.md](./docs/DEPLOY.md) | 部署指南 |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | 变更日志 |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | 贡献指南 |
| [docs/CODING_STANDARDS.md](./docs/CODING_STANDARDS.md) | 代码规范 |

---

## Roadmap

### Phase 0.5 ✅ 已完成
- frontmatter 扩展
- 双层页面模板
- vault:create 最小化

### Phase 1 ✅ 已完成
- [x] index.md 自动更新
- [x] log.md 操作日志
- [x] RESOLVER.md 决策树
- [x] 技能框架 enrich/query/ingest/maintain
- [x] AIChat 对话式交互
- [x] autoAIEngine 自动化引擎
- [x] URL 内容抓取

### Phase 2 📋 规划
- [ ] Typed links + 关系抽取
- [ ] Embedding 搜索
- [ ] RRF 综合排名

### Phase 3
- [ ] 模板系统
- [ ] Git 协作
- [ ] 权限控制

### Phase 4
- [ ] 分享/Publish
- [ ] iOS/Android App

---

## 定价

| 座位 | 月费 | 年费 |
|------|------|------|
| 第 1 人 | ¥0 | ¥0 |
| 每增加 1 人 | ¥19/月 | ¥190/年 |




---

## 竞品对比

| 维度 | Obsidian | Notion | 飞书文档 | 晓园 Vault |
|------|----------|--------|----------|--------|
| 本地优先 | ✅ | ❌ | ❌ | ✅ |
| Markdown | ✅ | ❌ | ❌ | ✅ |
| AI 自动分类 | ❌ | ❌ | ⚠️ 弱 | ✅ |
| 目录弹性 | ❌ | ❌ | ❌ | ✅ |
| 双层页面 | ❌ | ❌ | ❌ | ✅ |
| 价格 | 免费+Sync | ¥50/人/月 | 免费 | 第1人免费，+¥19/月/人 |

---

## License

MIT © 晓园团队

---

## 联系方式

- 官网：待更新
- 邮箱：待更新
- 微信群：待更新
