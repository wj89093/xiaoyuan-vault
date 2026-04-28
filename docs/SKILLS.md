# 晓园 Vault 技能系统设计

> 版本：v1.0
> 更新：2026-04-27
> 状态：Phase 1 规划中

---

## 一、设计原则

### 1.1 技能不依赖目录

```
技能只依赖：内容类型(type) + 用户意图
目录 = AI和用户协商出来的共识，可调整
```

### 1.2 Type 决定行为

```typescript
// ❌ 旧：hardcode 目录
if (folder === '2-公司') { ... }

// ✅ 新：内容导向
if (frontmatter.type === 'company') { ... }
```

### 1.3 失败可固化

任何失败场景 → 生成新技能文件 → 下次不再踩坑

---

## 二、技能目录结构

```
skills/
├── RESOLVER.md              # 🔑 决策树：收到内容 → 路由到哪个技能
├── enrich.md                # 入库：判断内容类型 → 和用户协商放哪
├── query.md                 # 查询：搜索 + 综合回答
├── ingest.md                # 导入：处理外部文件/链接
├── maintain.md              # 维护：定期检查 + 提醒
├── skillify.md              # 🔥 失败 → 固化新技能
└── conventions/
    ├── quality.md          # 质量标准
    └── citation.md          # 引用格式
```

---

## 三、RESOLVER.md 决策树

### 3.1 完整内容

```markdown
# RESOLVER - 内容路由决策树

> 任何知识入库前，AI必须先读此文件
> 版本：2026-04-27

## 收到内容后，判断类型

### 1. 是用户提问？
→ 走 query.md

### 2. 是外部文件/链接？
→ 走 ingest.md

### 3. 是待处理的新内容？
→ 走 enrich.md

---

## enrich 判断逻辑

收到内容后，判断内容类型（type）：

| 特征 | 建议 type | 备注 |
|------|-----------|------|
| 有人名 | person | 和用户确认 |
| 有公司名 | company | 和用户确认 |
| 有项目特征 | project | 和用户确认 |
| 有会议时间+参与方 | meeting | 自动判断 |
| 有交易金额+条款 | deal | 自动判断 |
| 有方法论/框架 | concept | 和用户确认 |
| 有研究方法+结论 | research | 和用户确认 |
| 无法判断 | collection | 进 0-收集/ |

### 协商流程

```
AI: "这是什么类型的页面？我建议 type: person，因为发现了人名'张三'。确认吗？"
用户: "是的"
AI: 创建 person 页面
```

### 目录协商

每次遇到新 type，建议创建新目录：
```
AI: "目前有 5 个 person 类型页面，建议创建 1-人物/ 目录存放。创建吗？"
用户: "创建"
AI: 创建目录 + 迁移文件
```

---

## 四、enrich.md 入库技能

### 4.1 职责

- 判断内容类型
- 和用户协商确认
- 创建/更新页面
- 抽取关系
- 更新 frontmatter

### 4.2 工作流

```
收到内容（新文件/导入/用户输入）
    ↓
判断类型（type）
    ↓
与用户协商确认
    ↓
创建/更新页面
    ↓
抽取 [[双链]] 和关系
    ↓
更新 frontmatter
    ↓
更新 index.md
    ↓
追加 log.md
```

### 4.3 关系抽取

```typescript
interface Relationship {
  type: string      // invested_in / founded / attended / works_at / etc.
  target: string    // 目标实体名
  confidence: 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS'
  source?: string   // 来源
}

// 抽取规则
const RELATION_PATTERNS = {
  '投资': { type: 'invested_in', pattern: /.*?(?:领投|跟投|投资).*?([^\s，,。]+)/ },
  '创始人': { type: 'founded', pattern: /.*?(?:创始人|联合创始人).*?([^\s，,。]+)/ },
  '参加': { type: 'attended', pattern: /.*?(?:参加|出席|参会).*?([^\s，,。]+)/ },
  // ...
};
```

### 4.4 置信度

| 置信度 | 说明 | 来源 |
|--------|------|------|
| EXTRACTED | 明确来源 | 文中直接提及 |
| INFERRED | 合理推断 | 共现、上下文 |
| AMBIGUOUS | 不确定 | 需人工确认 |

---

## 五、query.md 查询技能

### 5.1 职责

- 理解用户问题
- 搜索相关内容
- 综合回答
- 引用来源

### 5.2 搜索层级

| 层级 | 方式 | 说明 |
|------|------|------|
| L1 | SQLite FTS5 | 关键词搜索 |
| L2 | Typed links | 关系搜索 |
| L3 | Embedding | 语义搜索（Phase 2）|
| L4 | RRF | 综合排名 |

### 5.3 回答格式

```markdown
根据知识库内容，回答如下：

**问题**：xxx

**答案**：xxx

**依据**：
1. [[页面A]] - 引用内容
2. [[页面B]] - 引用内容

**相关页面**：
- [[页面C]]
- [[页面D]]
```

---

## 六、ingest.md 导入技能

### 6.1 职责

- 处理外部文件/链接
- 格式转换
- 触发 enrich

### 6.2 支持类型

| 类型 | 方法 |
|------|------|
| PDF | pdf-parse + OCR |
| Word | mammoth |
| URL | fetch + extract |
| 图片 | tesseract OCR |
| 音频 | Whisper 转写 |

### 6.3 工作流

```
收到外部内容
    ↓
识别类型
    ↓
转换格式（PDF/Word → Markdown）
    ↓
提取关键信息（标题、来源、日期）
    ↓
触发 enrich
```

---

## 七、maintain.md 维护技能

### 7.1 职责

- 定期检查页面质量
- 修复孤儿链接
- 更新 index.md
- 提醒过期内容

### 7.2 检查项

| 检查 | 说明 | 阈值 |
|------|------|------|
| 孤儿页面 | 有链接但无反向链接 | 提醒 |
| 过期内容 | 超过 90 天未更新 | 提醒 |
| 缺失字段 | frontmatter 必填字段缺失 | 自动补充 |
| 死链接 | 链接目标不存在 | 标记 AMBIGUOUS |

### 7.3 触发时机

- 每日定时（可配置）
- 手动触发
- 文件变更后延迟检查

---

## 八、skillify.md 技能固化

### 8.1 职责

将失败场景固化为新技能。

### 8.2 工作流

```
检测到失败场景
    ↓
记录到 failed.log
    ↓
分析失败模式
    ↓
生成新技能文件
    ↓
通知用户
```

### 8.3 failed.log 格式

```markdown
## [2026-04-27 15:30] enrich | 无法判断类型

**内容摘要**：xxx
**错误**：无法判断 type
**上下文**：xxx

## [2026-04-27 16:45] query | 搜索无结果

**查询**：xxx
**错误**：无相关页面
**建议**：需要导入相关资料
```

### 8.4 生成技能示例

如果频繁出现"无法识别投资金额格式"：

```markdown
# skill: extract-investment

处理投资相关内容的金额提取。

## 触发条件

- 内容包含"融资"、"投资"、"轮"等关键词
- 需要提取具体金额

## 处理流程

1. 识别金额格式（¥1000万 / $10M / 1亿元）
2. 标准化为：金额 + 单位
3. 写入 frontmatter.financialSummary

## 示例

输入："完成 A 轮 2 亿元融资"
输出：{ amount: "2亿", currency: "CNY", round: "A" }
```

---

## 九、conventions 规范

### 9.1 quality.md 质量标准

```markdown
# 质量标准

## 页面完整性

| type | 必填字段 | 建议字段 |
|------|----------|----------|
| person | name, created | bio, contact, tags |
| company | name, created | industry, size, tags |
| project | name, created, status | deadline, owner |
| meeting | name, created, date | attendees, decisions |
| deal | name, created, amount | counterparty, status |

## 内容质量

- summary 不超过 200 字
- openThreads 每个不超过 50 字
- seeAlso 不超过 10 个

## 引用标准

- 每个 claims 需有来源
- 来源格式：[[页面名]] 或 [URL](url)
```

### 9.2 citation.md 引用格式

```markdown
# 引用格式

## 页面内引用

- [[页面名]] - 链接到同库页面
- [[页面名|显示文本]] - 带显示文本
- [URL](url) - 外部链接

## 来源标注

```markdown
## 时间线

## [2026-04-27] 更新 | xxx
来源: [[相关页面]]
```

## 置信度标注

- EXTRACTED：[直接来源]
- INFERRED：（推断）
- AMBIGUOUS：？
```

---

## 十、实现计划（按版本）

### v1.0.0（Phase 1 · 开发中）

| 技能 | 文件 | 状态 |
|------|------|------|
| RESOLVER | RESOLVER.md | ✅ 已实现 | `resolver.ts` 读取规则 → Qwen AI 分类 |
| enrich | enrich.md | ✅ 已实现 | 分类/标签/摘要 + 导入自动触发 |
| query | query.md | ✅ 已实现 | 全库搜索 + AI 综合回答 + 引用来源 |
| ingest | ingest.md | ✅ 已实现 | 导入窗口 + auto-enrich 流水线 |
| maintain | maintain.md | ✅ 已实现 | 孤儿页面/过期/死链接/缺失字段检查 |
| index 更新 | index.md | ✅ 已实现 | AutoAI 每次执行重建内容索引 |
| log 记录 | log.md | ✅ 已实现 | AutoAI 每次执行 Append-only 记录 |

### v1.1.0（Phase 2 · 规划中）

| 技能 | 文件 | 说明 |
|------|------|------|
| URL 抓取 | ingest.md | 网页内容抓取 + 解析 + 入库 |
| 剪贴板捕获 | ingest.md | 系统级复制监听 + Popup 确认 |
| 实体识别 | enrich.md | 人物/公司/概念自动提取 |
| 主题聚类 | enrich.md | 相似内容自动聚类 |
| Ask Sidebar | query.md | 上下文保持 + 来源引用 + 快捷指令 |
| 知识图谱 | query.md | 实体节点 + 语义关系 + 交互增强 |
| Typed Links | enrich.md | 关系抽取升级 |
| 置信度 | relationships | EXTRACTED/INFERRED/AMBIGUOUS |
| Embedding | query.md | 语义搜索集成 |
| RRF | query.md | 混合排名 |

### v1.2.0（Phase 3）

| 技能 | 文件 | 说明 |
|------|------|------|
| skillify | skillify.md | 失败固化 |
| 模板 | conventions/ | 模板系统 |
| Git协同 | git-sync.md | 多人协作 |
| 权限 | permissions.md | r/w/rw+ |

### v1.3.0（Phase 4）

| 技能 | 文件 | 说明 |
|------|------|------|
| 审计 | audit.md | 操作日志 |
| SSO | sso.md | 单点登录 |
| 分享 | share.md | 公开链接 |
