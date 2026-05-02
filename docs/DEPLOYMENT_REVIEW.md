# 晓园 Vault 生产部署审查报告

> 审查日期：2026-05-02
> 审查人：蓝谷君
> 审查范围：全量代码审查（main + renderer + preload + services）
> 审查版本：`115bd6b` (67 commits)

---

## 一、审查结论

### 总体评分：7.5 / 10 ✅ 可以部署，但必须修复 P0 问题

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构设计 | ⭐⭐⭐⭐ | 16 服务模块化，IPC 40+ 路由，LLM-first 设计 |
| 类型安全 | ⭐⭐ | 1308 ESLint errors（770+ 是 unsafe any） |
| 测试覆盖 | ⭐⭐⭐ | 46/57 pass ✅，3 文件 11 测试失败 |
| 安全 | ⭐⭐⭐ | 3 个 P0 安全风险（XSS + ngrok + console） |
| 错误处理 | ⭐⭐⭐ | 基本有 try-catch，部分 catch 为空 |
| 性能 | ⭐⭐⭐⭐ | 建图 ~200ms，FTS5 亚毫秒，AutoAI 分钟级合理 |
| 可维护性 | ⭐⭐⭐⭐ | 文档完整（PRD/ARCHITECTURE/CODE_REVIEW），Git 规范 |
| 构建部署 | ⭐⭐⭐ | electron-builder 已配，但未验证多平台打包 |

---

## 二、项目概览

### 2.1 代码规模

```
21 个主进程文件 (.ts) — 16 services + index + tray + importWindow + qwen + agentAdapter
10 个渲染进程文件 (.tsx) — App + Editor + FileTree + AIChat + KnowledgeGraph + ...
 3 个测试文件 (.test.ts/.test.tsx) — frontmatter + graph + integration
 1 个 preload — IPC 通信桥
 1 个全局样式 — global.css
─────────────────────────────────
总计 ~9,500 行
```

### 2.2 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Electron + React + TypeScript | 34 / 19 / 5.x |
| 编辑器 | CodeMirror 6 | 6.x |
| 数据库 | SQLite + better-sqlite3 + FTS5 | 3.x |
| 图谱 | D3.js force simulation | 7.x |
| AI | DeepSeek V4 Flash（默认）/ MiniMax M2.7 / Qwen3.6-Flash | - |
| 导入 | pdftotext / mammoth / xlsx / tesseract.js v7 | - |
| 鉴权 | Auth Gateway + JWT + electron-store | - |
| 构建 | electron-vite + electron-builder | 3.x / 26.x |

### 2.3 功能矩阵

| 功能 | 状态 | 备注 |
|------|------|------|
| Markdown 编辑器 (CodeMirror) | ✅ 完成 | |
| SQLite FTS5 全文搜索 | ✅ 完成 | WAL 模式 |
| D3 知识图谱 | ✅ 完成 | TF-IDF 自动建边 |
| 文件树 + 目录浏览 | ✅ 完成 | |
| 拖拽导入 + 悬浮球 | ✅ 完成 | 悬浮窗口捕获 |
| URL 抓取 (Jina Reader) | ✅ 完成 | 含微信/YouTube 专用抓取 |
| 文件转换 (PDF/Word/Excel/图片) | ✅ 完成 | pdftotext + mammoth + tesseract |
| RAG 问答 (三阶段) | ✅ 完成 | rewrite → retrieve → answer |
| AI 分类/标签/摘要 | ✅ 完成 | LLM-first resolver |
| 双链 + 多页面联动 | ✅ 完成 | Phase 1 + Phase 2 |
| AutoAI 定时引擎 | ✅ 完成 | 可配置间隔 |
| Daily/Weekly Briefing | ✅ 完成 | LLM 生成变化摘要 |
| LLM 矛盾检测 | ✅ 完成 | 定期兜底扫描 |
| Auth Gateway 鉴权 | ✅ 完成 | JWT + Quota 控制 |
| 语音转写 (Whisper) | ✅ 完成 | whisper.cpp（需模型文件）|
| Agent 文件协议适配 | ✅ 完成 | ~/.vault/commands/ |

---

## 三、问题清单

### 🔴 P0 — 部署前必须修复

#### P0-1: dangerouslySetInnerHTML — XSS 风险

- **文件**：`src/renderer/components/Editor.tsx:205`、`src/main/services/clipboard.ts:290/360/381`
- **问题**：HTML preview 直接用 `dangerouslySetInnerHTML={{ __html: ... }}` 渲染用户导入的文件内容
- **风险**：如果导入的 HTML / Word / Excel 文件包含 `<script>` 标签或事件处理器（如 `onload`），**脚本直接在 Electron 主进程中执行**，可以读取本地文件、访问用户数据
- **Electron 特殊性**：即使在 `contextIsolation: true` 下，XSS 仍可以操作 DOM 和触发 IPC 调用
- **修复方案**：
  ```typescript
  // 方案 A（推荐）：使用 DOMPurify 过滤
  import DOMPurify from 'dompurify'
  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
  
  // 方案 B：限制只渲染安全标签
  // 只允许 p/h1-h6/ul/ol/li/table/pre 等标签
  ```

#### P0-2: 硬编码 ngrok URL

- **文件**：`src/main/services/aiService.ts:206`
- **代码**：
  ```typescript
  const AUTH_GATEWAY_URL = process.env.AUTH_GATEWAY_URL || 
    'https://chance-unnamed-camera.ngrok-free.dev'
  ```
- **风险**：
  1. ngrok URL 有 8 小时有效期，过期后 Auth Gateway 全部不可用
  2. 源码暴露内部网络地址
  3. Fallback 到硬编码 → 线上无声失败（走 useless URL 导致超时）
- **修复方案**：
  ```typescript
  // 强制环境变量，无配置时明文报错
  const AUTH_GATEWAY_URL = process.env.AUTH_GATEWAY_URL
  if (!AUTH_GATEWAY_URL && !is.dev) {
    throw new Error('AUTH_GATEWAY_URL 未配置')
  }
  ```

#### P0-3: 生产环境 console.log 依然输出

- **问题**：`clipboard.ts` 等文件大量使用 `console.log/warn/error`，生产打包后不会自动屏蔽
- **影响**：
  1. 日志混杂，无法按级别过滤和轮转
  2. 主进程已用了 `electron-log`，但渲染进程没用
  3. 生产环境输出到控制台可能导致 Electron 日志膨胀
- **修复方案**：
  ```typescript
  // 渲染进程也用 electron-log
  import log from 'electron-log/renderer'
  // 或：生产环境屏蔽 console
  if (process.env.NODE_ENV === 'production') {
    console.log = () => {}
  }
  ```

#### P0-4: 1308 ESLint errors — 770+ unsafe any

| 规则 | 数量 | 说明 |
|------|------|------|
| `@typescript-eslint/no-unsafe-*` | ~770 | IPC handler / API call / JSON 解析 |
| `@typescript-eslint/prefer-nullish-coalescing` | 129 | `||` 替代 `??` |
| `no-unused-vars` | 44 | 未使用的变量 |
| `@typescript-eslint/no-misused-promises` | 49 | Promise 在事件监听中未处理 |
| `react-refresh/only-export-components` | 2 | Toast 组件导出了非组件函数 |
- **风险**：`any` 传播 → 运行时类型崩溃。IPC handler 中 `any` 传参一旦类型不对直接报错
- **修复策略**：先修 IPC 层（`index.ts` + `handler`），约 200 个 error；其他分批

---

### 🟡 P1 — 强烈建议上线前修复

#### P1-1: tsconfig `noEmit: true` 与 `composite: true` 冲突

- **问题**：`tsconfig.json` 设 `noEmit: true`，但两个子配置 `tsconfig.web.json` / `tsconfig.node.json` 都设了 `composite: true`
- **`composite` 要求**：必须有 `declaration: true` 和 `emitDeclarationOnly` 或 `declarationDir`
- **后果**：`npx tsc --noEmit` 报 10 个 TS6305 错误（输出文件未构建）
- **修复**：
  ```json
  // tsconfig.json 中删掉 noEmit，或：
  "compilerOptions": {
    "noEmit": true,
    "composite": false  // 根 tsconfig 不需要 composite
  }
  ```

#### P1-2: 11 个测试用例失败

- **测试文件**：
  - `src/main/services/graph.test.ts` — 6 fail
  - `src/main/services/integration.test.ts` — 3 fail
  - `src/main/services/autoAIEngine.test.ts` — 2 fail?（从输出看 <11）
- **根因**：`TFIDFDocument` 类型在 Phase 2 新增了 `relationships` 字段，但 test mock 数据没更新
- **修复**：
  ```typescript
  // graph.test.ts 中补上 doc.relationships
  const doc = {
    file: 'test.md', title: 'Test', tags: [],
    tokens: new Map(), relationships: []
  }
  ```

#### P1-3: better-sqlite3 原生模块兼容性

- **问题**：`better-sqlite3` 是 C++ 原生模块，编译结果依赖 Node.js ABI
- **风险**：升级 Electron（内含 Node）时若不 rebuild 会挂
- **建议**：
  1. CI 中跑一次 `npm run package` 验证打包成功
  2. `postinstall` 脚本确保 `electron-builder install-app-deps` 自动触发
  3. 在 `.github/workflows/ci.yml` 加 matrix 构建

#### P1-4: 动态 import 在性能关键路径

- **问题**：`converters.ts` 每个转换函数都 `await import(...)` 动态加载模块
- **影响**：每次转换都要额外 ~50-200ms 的模块加载时间
- **建议**：顶部集中 import
  ```typescript
  // 改为：
  import { execFile } from 'child_process'
  import { promisify } from 'util'
  // ...所有 import 都在顶部
  ```

---

### 🟢 P2 — 建议路线图规划

| 序号 | 问题 | 文件/位置 | 说明 |
|------|------|-----------|------|
| P2-1 | 空 catch 块 | database.ts, enrich.ts 等 | `catch {}` 静默吞错误，至少 `log.warn` |
| P2-2 | prefer-const | 全局 | `let` 替代 `const` 的安全问题较小，但违反一致性 |
| P2-3 | `flattenFiles` 递归 | graph.ts / maintain.ts | 深层目录可能栈溢出，建议迭代实现 |
| P2-4 | API Key 在源码中 | aiService.ts | 环境变量 fallback 到空字符串，不算泄露但不够优雅 |
| P2-5 | 缺少 CI/CD | - | 无 GitHub Actions，无 lint/typecheck/test 门禁 |
| P2-6 | 自动更新 | - | PRD 写了但还没实现，建议 electron-updater |
| P2-7 | 渲染进程日志 | clipboard.ts | 渲染进程没用 `electron-log`，统一性差 |
| P2-8 | whitelist 校验 | agentAdapter.ts | 命令文件路径没有 sanitize，理论路径穿越风险 |

---

## 四、详细代码审查

### 4.1 架构评分

```
架构：⭐⭐⭐⭐
✓ 16 服务分层清晰，单一职责
✓ IPC 40+ 路由，Handler 注册规范
✓ LLM-first 设计：Resolver → Enrich → Briefing → Maintain 都在 AI 层
✓ 文档齐全（PRD.md / ARCHITECTURE.md / CODE_REVIEW.md）

✗ 部分函数 >300 行（enrich.ts: 400+ 行，建议拆分）
✗ 前端 App.tsx >400 行，状态管理开始膨胀（建议抽 hooks）
✗ 无 State Management（全在 App.tsx useState)
```

### 4.2 安全评分

```
安全：⭐⭐⭐
✓ Auth Gateway JWT 鉴权 + Quota 控制
✓ IPC 路由有 basic schema 校验
✓ electron-store 加密存储 token

✗ dangerouslySetInnerHTML XSS（P0）
✗ 硬编码 ngrok URL（P0）
✗ 无 CSP Header 配置
✗ clipboard.ts 中 innerHTML 拼接用户内容
✗ 无 SQL 注入检查（better-sqlite3 用参数化查询 -> 安全，但需确认全量 diff）
```

### 4.3 性能评分

```
性能：⭐⭐⭐⭐
✓ 图表建边：余弦相似度 early exit（COSINE_EARLY_ZERO = 0.001）
✓ FTS5 全文搜索 < 1ms
✓ AutoAI 间隔可配置（默认 60min），避免频繁调用
✓ TF-IDF 用单次累加，skip 短文档（MIN_TOKENS_FOR_SIMILARITY = 5）
✓ MAX_EDGES = 200 防爆炸

✗ 每张图片 OCR 都新建 tesseract worker → 建议 worker 池
✗ 动态 import 每次调用都加载 → 建议顶部集中
✗ frontmatter 解析每次读全文件 → 不影响，但量大时可考虑 LRU cache
```

### 4.4 测试覆盖评分

```
测试：⭐⭐⭐
✓ 46/57 pass
✓ frontmatter.test.ts 覆盖了 parse + apply + wikiLinks 场景
✓ integration.test.ts 覆盖了 enrich + chat + graph 端到端
✓ 测试环境用 vitest，速度较快

✗ App.tsx 前端无任何测试
✗ IPC handler 无集成测试（端到端需要 Electron 环境）
✗ Mock 数据未同步最新类型定义（P1-2）
```

### 4.5 构建部署评分

```
构建部署：⭐⭐⭐
✓ electron-vite 构建配置合理
✓ electron-builder 已配 Mac/Windows/Linux 三平台
✓ asarUnpack 正确处理 native 模块
✓ .gitignore 排除 node_modules/out/dist/

✗ 未验证 dmg 打包成功
✗ 未验证 Windows 平台打包
✗ CI/CD 缺失
✗ 自动更新未实现
✗ env 变量未在文档中同步更新（DEPLOY.md 还写着旧的 QWEN_MODEL=qwen3.5-flash）
```

---

## 五、修复优先级计划

### Phase 1 — 立即执行（1-2 小时）

| # | 任务 | 预估时间 | 难度 |
|---|------|----------|------|
| 1 | 注入 DOMPurify 修复 XSS | 20min | 低 |
| 2 | ngrok URL 改为强制 env | 10min | 低 |
| 3 | 统一渲染进程日志 | 15min | 低 |
| 4 | 修复 graph.test.ts mock 数据 | 10min | 低 |
| 5 | 修复 tsconfig noEmit 冲突 | 5min | 低 |

### Phase 2 — 上线前（2-4 小时）

| # | 任务 | 预估时间 | 难度 |
|---|------|----------|------|
| 1 | 批量修复 IPC 层类型安全 | 1h | 中 |
| 2 | 加 GitHub Actions CI | 30min | 低 |
| 3 | 验证 Mac/Windows 双平台打包 | 30min | 中 |
| 4 | 修复空 catch 块 | 20min | 低 |
| 5 | 顶部集中 import | 15min | 低 |

### Phase 3 — 短期规划（1-2 天）

| # | 任务 | 预估时间 | 难度 |
|---|------|----------|------|
| 1 | 批量修复 prefer-const / no-unused-vars | 30min | 低 |
| 2 | 补 App.tsx 前端测试 | 2h | 中 |
| 3 | 实现 electron-updater | 3h | 中 |
| 4 | 配置 CSP Header | 30min | 低 |
| 5 | tesseract worker 池 | 1h | 中 |

---

## 六、亮点 & 最佳实践

### 🏆 值得推广的设计

1. **LLM-first 设计模式**：Resolver 模块不写规则（不用 if-else 判断文件类型），而是让 LLM 读完内容后决定完整 action plan。这比传统规则引擎灵活得多
2. **TF-IDF + early exit**：图谱建边时的优化很专业，`COSINE_EARLY_ZERO` 阈值在高维稀疏向量下能省大量无效计算
3. **MECE 目录结构**：`RESOLVER.md` / `schema.md` / `index.md` / `log.md` 的层次设计清晰
4. **三阶段 RAG**：rewrite → retrieve → answer 管道比单次搜索效果更好
5. **Phase 1 + Phase 2 渐进式功能开发**：先双向链接，再多页面联动，设计稳健

### 📝 Git 规范

```
115bd6b feat: graph entities + AIChat context window + sources clickable
bd7a587 chore: remove binary files from git
6edd63a feat: Auth Gateway + Agent Adapter + tesseract data files
d54bcc5 docs: 更新 ARCHITECTURE/CHANGELOG/PRD
7655add fix: 补全丢失的 URL scheme 注册 + auth 函数
b1990f9 feat: Phase 2 - Enrich 多页面联动
b5620aa feat: Phase 1 - Bidirectional Links
```

- 前缀规范（feat/fix/docs/chore）
- 消息简明，信息量足
- 67 commits 覆盖了从项目初始化到 Phase 2 的完整演进

---

## 七、部署 Checklist

### 部署前

- [ ] 🔴 P0-1: DOMPurify XSS 修复
- [ ] 🔴 P0-2: ngrok URL 强制环境变量
- [ ] 🔴 P0-3: 统一日志系统
- [ ] 🔴 P0-4: IPC 层类型安全修复
- [ ] 🟡 P1-1: tsconfig 修复
- [ ] 🟡 P1-2: 测试修复
- [ ] 🟡 P1-3: 原生模块验证（npm run package）
- [ ] 🟡 P1-4: 动态 import 重构
- [ ] 验证 macOS 打包：`npm run package`
- [ ] 配置 .env.example 同步更新（DEPLOY.md）
- [ ] 确认 electron-log 日志轮转配置

### 部署后

- [ ] 验证 AI 功能（classify / tags / summary / RAG）
- [ ] 验证文件导入（PDF / Word / Excel / 图片 OCR / 音频）
- [ ] 验证 URL 抓取
- [ ] 验证知识图谱重建
- [ ] 验证 AutoAI 定时任务
- [ ] 验证 Briefing 生成
- [ ] 验证 Auth Gateway 鉴权流程
- [ ] 验证悬浮球捕获 + 拖拽导入

---

## 八、附录

### A. 命令参考

```bash
# 类型检查
npx tsc --noEmit --project tsconfig.web.json
npx tsc --noEmit --project tsconfig.node.json

# Lint
npm run lint       # 全部检查
npm run lint:fix   # 自动修复可修复项

# 测试
npm test

# 构建 + 打包
npm run package

# 查看构建产物
ls -la dist/
```

### B. 关键文件导航

| 文件 | 路径 | 说明 |
|------|------|------|
| 主进程入口 | `src/main/index.ts` | Electron 生命周期 + IPC 注册 |
| 服务清单 | `src/main/services/` | 16 个模块 |
| AI 服务 | `src/main/services/aiService.ts` | 多 Provider + Auth Gateway |
| 核心数据 | `src/main/services/database.ts` | SQLite FTS5 + CRUD |
| LLM Resolver | `src/main/services/resolver.ts` | LLM-first 内容判断 |
| 富化引擎 | `src/main/services/enrich.ts` | 文件分类 + 多页联动 |
| 图谱 | `src/main/services/graph.ts` | TF-IDF + D3 |
| RAG 问答 | `src/main/services/chat.ts` | 三阶段管道 |
| 前端入口 | `src/renderer/App.tsx` | 主应用组件 |
| 架构文档 | `docs/ARCHITECTURE.md` | 完整架构描述 |
| PRD | `docs/PRD.md` | 产品定义 |
| 部署文档 | `docs/DEPLOY.md` | 部署指南 |

---

*本报告由蓝谷君自动生成，基于代码审查 + 自动化工具扫描。*
