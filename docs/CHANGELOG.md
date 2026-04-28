# 晓园 Vault 变更日志

> 版本：v1.0
> 更新：2026-04-28

---

## v1.1.0 (2026-04-28) - OpenWiki 借鉴优化

### 🔄 开发中

#### 新增功能（参考 OpenWiki）

- **剪贴板捕获 Popup** — 系统级复制监听 + Mini 确认窗口 + 保存到 0-收集/
- **URL 内容抓取** — 网页解析 + Readability 提取正文 + turndown 转 Markdown + 自动入库
- **AIChat 加强** — 上下文保持 + 来源引用 [[标题]] + 快捷指令 (/summarize /tags /classify)
- **实体识别** — 人物/公司/概念自动提取 + 写入 entities 表
- **主题聚类** — 相似内容自动聚类 + 建议相关文档
- **知识图谱优化** — 实体节点 + 语义关系 + 交互增强（筛选/聚类/搜索定位）

#### 技术架构

- **主进程新增模块**：剪贴板监听 (clipboard.ts) + URL 抓取 (urlFetch.ts)
- **数据库新增表**：clipboard_history + entities + entity_relationships
- **IPC 新增接口**：clipboard:listen/save + url:fetch/extract
- **前端新增组件**：ClipboardPopup + URLImportDialog

---

## v0.5.6 (2026-04-28) - 体验优化

### ✅ 已完成

- **悬浮导入按钮修复** — CSS 块冲突修复，按钮正常显示
- **保存状态指示** — 标题栏 ● 未保存/✓ 已保存 双色提示
- **AIChat 空状态** — 有文件→基于文件提问，无文件→搜全库
- **窗口自动显示** — 启动即见窗口，不再依赖托盘
- **导入自动刷新** — 导入完成后文件树自动更新
- **编辑器底部留白** — 不遮挡悬浮按钮

---

## v0.5.5 (2026-04-28) - 编辑器增强 + 文档对齐

### ✅ 已完成

- **编辑器 Obsidian 风格优化** — 纯 CSS 实现标题层级/链接色/代码样式/引用块/滚动条，Editor.tsx 保持 33 行
- **窗口居中** — BrowserWindow 加 `center: true`
- **AIChat + 快速操作** — 右侧栏换回 AIChat，顶部加分类/标签/摘要快捷按钮
- **悬浮导入按钮** — 编辑器底部居中漂浮「导入文件」按钮，替代 AIChat 快捷操作
- **dotenv 修复** — main process 顶部加 `import 'dotenv/config'`
- **文档对齐** — CHANGELOG/ARCHITECTURE 与实际代码同步

## v0.5.0 (2026-04-27) - 基础版

### ✅ 已完成

#### 新增

- **AI 分类（单文件）** - AIPanel 一键分类
- **AI 标签提取** - 自动提取关键词标签

- **frontmatter 扩展**
  - 新增字段：`type`, `status`, `summary`, `confidence`, `openThreads`, `seeAlso`, `relationships`
  - 支持 `type`: person/company/project/meeting/deal/concept/research/collection
  - 支持 `confidence`: high/medium/low
  - 支持 `relationships`: typed links with EXTRACTED/INFERRED/AMBIGUOUS confidence

- **双层页面模板**
  - 上方：编译真相（当前状态）
  - 下方：时间线（Append-only）
  - 自动生成 created/updated 时间戳

- **vault:create 完整初始化**
  - 创建 `0-收集/` + `.raw/文档/.raw/截图/.raw/来源/`
  - 自动写入 `RESOLVER.md`（决策树）
  - 自动写入 `schema.md`（双层页面规范）
  - 自动写入 `index.md`（内容目录骨架）
  - 自动写入 `log.md`（操作日志骨架）
  - 目录通过 AI 和用户协商后创建

- **新建文件模板化**
  - 新建文件自动进入 `0-收集/`
  - 自动使用双层页面模板
  - 自动解析 title 和 frontmatter

- **SQLite FTS5 搜索**
  - 全文搜索
  - 关键词高亮

- **D3 知识图谱**
  - 力导向图
  - [[双链]] 抽取
  - 文件夹聚类

- **导入功能**
  - PDF 解析
  - Word 转换
  - URL 抓取
  - 语音转写（Whisper）

#### 变更

- **database.ts**
  - 索引字段扩展，支持新的 frontmatter 字段

- **frontmatter.ts**
  - 重写解析器，支持复杂嵌套结构
  - 新增 `generateFileTemplate()` 函数
  - 新增 `extractWikiLinks()` 函数
  - 新增 `touchFrontmatter()` 函数

---

## v1.0.0 (开发中) - Phase 1

### 已完成

#### AI 能力

- [x] **AI 摘要生成** — AIPanel 一键调用 `ai:summary`
- [x] **AI 推理问答** — AIPanel 对话调用 `ai:reason`
- [x] **AI 写作辅助** — AIPanel 对话调用 `ai:write`
- [x] **AutoAI 自动执行** — `autoAIEngine.ts` 已实现，vault 创建/打开时自动启动

#### 未完成

- [x] **index.md 自动更新** — AutoAI 自动重建内容索引
- [x] **log.md 操作日志** — AutoAI 自动追加时间戳记录
- [x] **RESOLVER 路由** — resolver.ts 读取 RESOLVER.md，Qwen AI 分类
- [x] **enrich 入库** — 分类/标签/摘要 + 导入自动触发
- [x] **query 查询** — 全库搜索 + AI 综合回答 + 引用来源
- [x] **maintain 维护** — 孤儿页面/过期内容/死链接/缺失字段检查
- [ ] **ingest 技能** — 导入流程已完整（auto-enrich），待独立抽离

---

## v1.1.0 (待开发) - Phase 2

### 计划中

#### 知识管理增强

- [ ] **Typed links 关系抽取** - invested_in/founded/attended 等
- [ ] **置信度标签** - EXTRACTED/INFERRED/AMBIGUOUS

#### 搜索增强

- [ ] **Embedding 语义搜索** - 语义理解
- [ ] **RRF 混合排名** - 综合搜索结果

---

## v1.2.0 (待开发) - Phase 3

### 计划中

#### 团队协作

- [ ] **模板系统** - 团队统一文档格式
- [ ] **Git 协作** - 多人编辑 + 冲突处理
- [ ] **文件夹级权限** - r/w/rw+ 三级权限
- [ ] **团队管理** - 成员邀请 + 角色分配

#### 技能增强

- [ ] **skillify.md** - 失败场景固化为新技能

---

## v1.3.0 (待开发) - Phase 4

### 计划中

#### 企业功能

- [ ] **私有部署** - 自有服务器部署
- [ ] **公开分享链接** - 外部访问
- [ ] **SSO 单点登录** - 企业账号体系
- [ ] **审计日志** - 操作记录追溯

#### 移动端

- [ ] **iOS App** - Capacitor 打包
- [ ] **Android App** - Capacitor 打包

---

## 版本对照表

| 版本 | 版本号 | 主要功能 |
|------|--------|----------|
| v0.5.x | | 基础编辑、FTS5搜索、图谱、导入 |
| v1.0.0 | | AI摘要/推理/写作、RESOLVER、技能框架 |
| v1.1.0 | | Typed links、Embedding搜索、RRF |
| v1.2.0 | | Git协作、权限、模板 |
| v1.3.0 | | 私有部署、SSO、审计、移动端 |
