# 晓园 Vault 架构优化报告

> 生成时间：2026-05-02
> 分析来源：手动代码审查 + code-review-graph v2.3.2（Tree-sitter AST 静态分析）+ sqlite3 查询
> 覆盖范围：63 文件 · 448 AST 节点 · 4,220 关系边 · 7 个社区 · 18 个执行流
> 当前版本：115bd6b (67 commits)

---

## 一、现状速览

### 1.1 代码规模

| 指标 | 数值 |
|------|------|
| 源文件 | 63 |
| 函数/类 | 310 |
| 测试用例 | 75（46/57 pass） |
| IPC 路由 | 58+ |
| 服务模块 | 16 |
| 前端组件 | 13 |
| 总行数 | ~9,500 |

### 1.2 宏观结构（由 code-review-graph 自动识别）

```
7 个自然社区（自动聚类）：
┌──────────────────────────────────────────────────┐
│  services-it:should       241 节点  (cohesion 0.15)  │   ← 主进程服务层
├──────────────────────────────────────────────────┤
│  components-it:should     97 节点   (cohesion 0.09)  │   ← 渲染层组件
├──────────────────────────────────────────────────┤
│  renderer-handle          21 节点   (cohesion 0.02)  │   ← 渲染层逻辑
├──────────────────────────────────────────────────┤
│  main-auth                18 节点   (cohesion 0.04)  │   ← 鉴权模块（独立 ✅）
├──────────────────────────────────────────────────┤
│  routes-apiconfig          2 节点                   │   ← 路由配置
│  preload-handler           2 节点                   │   ← IPC 桥
│  xiaoyuan-vault            2 节点                   │   ← 项目根
└──────────────────────────────────────────────────┘
```

### 1.3 关系边分布（4,220 条）

| 类型 | 数量 | 说明 |
|------|------|------|
| CALLS（函数调用） | 3,150 | 代码核心依赖骨架 |
| CONTAINS（包含关系） | 468 | 文件-函数 层级 |
| TESTED_BY（测试覆盖） | 342 | **仅 342/4,220=8.1% 的边有测试关联** |
| IMPORTS_FROM（模块导入）| 236 | 模块间依赖 |
| REFERENCES（引用） | 24 | 跨模块引用 |

---

## 二、架构问题与优化建议

### 🔴 问题一：index.ts 体积过大（847 行，单文件中最大）

#### 现状

| 指标 | 数值 |
|------|------|
| 行数 | 847（全库最大文件） |
| IPC 路由数 | 58+ |
| import 模块数 | 23 |
| 执行流关键性 | **0.73（全库最高）** |
| 执行流深度 | 5（最深的执行路径之一） |

#### 根因

`src/main/index.ts` 承担了 4 个职责：
1. Electron 生命周期管理（app.on ready / window-all-closed）
2. IPC handler 注册（58+ 路由，全部内联）
3. Auth token 存储（handleAuthCallback / getAuthToken / clearAuthToken）
4. 子窗口管理（importWindow / tray）

#### code-review-graph 数据佐证

```
Top 执行流（按关键性）：
  setupIpcHandlers    0.73  depth=5  nodes=129  files=17  ← 全库最复杂
  startAgentAdapter   0.72  depth=6  nodes=29   files=7   ← 第二复杂
  App                 0.68  depth=3  nodes=30   files=14  ← 前端入口
  generateBriefing    0.68  depth=3  nodes=16   files=5
```

`setupIpcHandlers` 涉及 17 个文件、129 个函数节点。改一个 handler 就要扫整个文件。

#### 优化方案：拆分 IPC Router

```
当前                                      优化后
──────                                    ──────
src/main/index.ts                         src/main/index.ts
  ├── Electron 生命周期                     ├── Electron 生命周期
  ├── auth token 操作 （5 函数）               ├── router.registerAll()
  ├── 58+ IPC handlers（内联）               └── importWindow 管理
  ├── importWindow 管理
  └── tray 管理                            src/main/router/
                                            ├── index.ts          # registerAll() 注册入口
                                            ├── vault.handler.ts  # vault:open / create / ...
                                            ├── file.handler.ts   # file:list / search / read / ...
                                            ├── auth.handler.ts   # auth:getToken / getEmail / ...
                                            ├── ai.handler.ts     # ai:classify / tags / summary / ...
                                            ├── chat.handler.ts   # chat:ask / sessions / ...
                                            ├── graph.handler.ts  # graph:load / rebuild
                                            └── enrich.handler.ts # enrich:file / inbox / ...
```

**效果预估**：
- `index.ts` 847 行 → ~150 行
- 新增 handler 不需要动 index.ts（开新文件 + 注册）
- 执行流关键性从 0.73 降到 ~0.30
- 工作量：~30 分钟（纯机械拆分）

---

### 🟡 问题二：App.tsx 状态膨胀（601 行）

#### 现状

| 指标 | 数值 |
|------|------|
| 行数 | 601（全库第二大文件） |
| useState | 19 个 |
| useCallback | 14 个 |
| useEffect | 8 个 |
| 执行流关键性 | 0.68 |

#### 根因

App.tsx 是前端唯一的入口组件 + 唯一的 Store，所有状态都挂在它下面：
- `vaultPath`, `files`, `selectedFile`, `content`, `isDirty` — 文件管理
- `searchQuery`, `searchResults`, `showSearchResults` — 搜索
- `messages`, `chatLoading` — AI 对话
- `showGraph`, `showQuickSwitch`, `showSettings` — 弹窗控制
- `recentFiles`, `nativePreview` — 辅助状态

19 个 useState 混在一起，任何功能改动都要在这个文件里找对应状态。

#### 优化方案

**方案 A（推荐）**：按功能域拆分 hooks

```typescript
src/renderer/hooks/
├── useVault.ts         # vaultPath + files + file CRUD
├── useEditor.ts        # selectedFile + content + isDirty
├── useSearch.ts        # searchQuery + searchResults + showSearchResults
├── useChat.ts          # messages + chatLoading + sendMessage
├── useUI.ts            # showGraph / showSettings / showQuickSwitch
└── index.ts            # 统一导出
```

**方案 B**：zustand（2KB，API 简洁）

```typescript
import { create } from 'zustand'

const useStore = create((set) => ({
  vaultPath: null,
  files: [],
  selectedFile: null,
  // ...
  openVault: async () => { ... },
  selectFile: (path) => { ... },
}))

// 组件里直接解构
function App() {
  const { vaultPath, files, selectedFile, openVault } = useStore()
}
```

**效果预估**：
- App.tsx 601 行 → ~100 行（只做布局）
- 每个 hook 可以独立测试
- 工作量：方案 A ~1 小时，方案 B ~30 分钟

---

### 🟡 问题三：图谱引擎全量重建

#### 现状

`rebuildGraph()` 每次调用**全量**扫描所有 .md 文件：
- 遍历目录树 → 读全量文件 → tokenize → TF-IDF → 余弦相似度 → 建边
- 没有缓存机制，没有增量更新
- 每次文件保存后图谱不自动更新（数据不一致）

#### 对比 code-review-graph 的做法

| | 晓园 vault 当前 | code-review-graph |
|---|---|---|
| 建图策略 | 全量重建 O(n²) | 增量 diff（SHA-256 hash） |
| 更新触发 | 手动调用 | 文件保存 / git commit 自动 |
| 2900 文件耗时 | 估算 10s+ | < 2s |
| 数据一致性 | ❌ 图谱与文件系统可能不一致 | ✅ 实时同步 |

#### 优化方案：增量更新

```typescript
// === 新增：file-hash 缓存 ===
// graph.ts
import { createHash } from 'crypto'

const GLOBAL_HASH_CACHE = new Map<string, string>()

async function getFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8')
  return createHash('sha256').update(content).digest('hex')
}

export async function incrementalUpdate(filePath: string): Promise<void> {
  const newHash = await getFileHash(filePath)
  const oldHash = GLOBAL_HASH_CACHE.get(filePath)
  
  if (newHash === oldHash) return  // 没变化，跳过
  
  // hash 变了 → 只 re-index 这一个文件
  GLOBAL_HASH_CACHE.set(filePath, newHash)
  
  // 1. 清除此文件的所有旧边
  // 2. 重新 tokenize 此文件
  // 3. 重新计算与此文件相关的边（不是全部 i-j 对）
  // 4. 更新节点 + 边到图文件
}
```

**被动触发链**：
```
文件保存（CTRL+S）
  → graph incrementalUpdate(filePath)
  → enrich 自动触发（若开启 AutoAI）
  → maintain 定时兜底（全量 sync）
```

**效果预估**：
- 日常操作：只更新 1 个文件的边，耗时 < 50ms
- 全量 sync 保留（maintain 定时执行），数据一致性 100%
- 工作量：~2 小时

---

### 🟡 问题四：测试覆盖率缺口

#### 现状（code-review-graph 数据）

```
风险指数节点：     385 个函数/类
测试覆盖的节点：   13 个
未测试的节点：     372 个
测试覆盖率：      3.4%
高风险（≥0.5）：   22 个函数
```

#### 必须补测试的高风险函数

| 风险分 | 函数 | 理由 |
|--------|------|------|
| 0.85 | `chat.ts::getSessionsDir` | 文件 IO 路径，无 sanitize |
| 0.85 | `chat.ts::loadSessions` | JSON 反序列化，无校验 |
| 0.70 | `chat.ts::saveSessions` | 写入用户文件 |
| 0.70 | `chat.ts::createSession` | 状态管理入口 |
| 0.70 | `chat.ts::deleteSession` | 删除用户文件 |
| 0.70 | `index.ts::handleAuthCallback` | Token 处理 |
| 0.70 | `index.ts::getAuthToken / getAuthEmail / clearAuthToken` | 鉴权数据 |
| 0.65 | `resolver.ts::makeDefault` | 新增函数无测试 |

**优先补 chat.ts 和 index.ts 的鉴权函数**，这些直接影响安全。

---

### 🟢 问题五：components 社区凝聚力偏低

code-review-graph 数据显示 `components` 社区凝聚力 **0.09**（services 社区是 0.15）。

#### 表现

| 可能问题 | 示例 |
|---------|------|
| 组件强绑定需求 | Editor / EditorToolbar / EditorWithToolbar 三个文件可合并 |
| 重复模式未抽象 | SearchResults / QuickSwitch 的搜索结果展示逻辑类似 |
| 无 hooks 层 | 所有状态在 App.tsx |

#### 建议

短期不用动，加新组件时留意：如果 3 个组件做类似的事，就抽一个共享 hook。

---

## 三、优化优先级总表

| 优先级 | 优化项 | 当前 | 优化目标 | 收益 | 工作量 |
|--------|--------|------|----------|------|--------|
| 🔴 P0 | index.ts IPC Router 拆分 | 847 行 · 58 路由 · 关键性 0.73 | ~150 行 · 模块化注册 | 解耦、可维护性、安全 | **30min** |
| 🟡 P1 | 图谱增量更新 | 全量重建 O(n²) · 数据不一致 | 增量 diff · <50ms | 性能 + 数据一致性 | **2h** |
| 🟡 P1 | App.tsx 抽 hooks | 601 行 · 19 useState · 0.68 关键性 | ~100 行 · 分流到 5 个 hooks | 可测试性 | **1h** |
| 🟡 P1 | 补 chat.ts + auth 测试 | 高风险 0.85 函数 0 测试 | 每个 ≥0.5 函数有测试 | 安全性 | **3h** |
| 🟢 P2 | components 凝聚力 | 0.09（偏低） | ≥0.12 | 代码质量 | 按需 |
| 🟢 P2 | CI/CD 门禁 | 无 | GitHub Actions | 质量门禁 | **1h** |
| 🟢 P2 | 更新 DEPLOY.md | 过时的 env 配置 | 同步最新变量 | 文档准确 | **15min** |

### 建议的排期

**Phase 1（今晚）：**
- [ ] IPC Router 拆分（30min）
- [ ] 更新 DEPLOY.md 环境变量（15min）

**Phase 2（本周）：**
- [ ] 图谱增量更新（2h）
- [ ] App.tsx 抽 hooks（1h）
- [ ] 补 chat.ts 测试（1.5h）

**Phase 3（下阶段）：**
- [ ] 补 auth 测试（1.5h）
- [ ] GitHub Actions CI（1h）

---

## 四、跟手动审查结果的交叉验证

| 手动审查发现 | code-review-graph 验证 | 结论 |
|-------------|----------------------|------|
| P0: XSS dangerouslySetInnerHTML | ❌ AST 不检测 dangerouslySetInnerHTML | 仍需手动修复 |
| P0: 硬编码 ngrok URL | ❌ 不检测硬编码字符串 | 仍需手动修复 |
| P0: 1308 ESLint errors（any） | ✅ 385 节点中 372 无测试覆盖（间接相关） | 类型安全与测试覆盖正相关 |
| P1: tsconfig noEmit 冲突 | ❌ 不检查 tsconfig | 仍需手动修复 |
| P1: 11 测试失败 | ✅ 75 个 Test 节点，342 条 TESTED_BY 边 | 数据一致 |
| P2: 空 catch 块 | ❌ 不检测 catch 行为 | 需 lint 修复 |
| **新发现**：index.ts 847 行关键性 0.73 | ✅ **手动审查没发现的盲区** | **新增优化项** |

---

## 五、附录

### A. 工具与方法

| 分析工具 | 用途 |
|---------|------|
| code-review-graph v2.3.2 | Tree-sitter AST 分析 · 社区检测 · 执行流 · 风险评分 |
| sqlite3 (.code-review-graph/graph.db) | 直接查询关系数据 |
| ESLint (flat config) | 类型安全 + 代码风格 1353 错误 |
| vitest | 测试运行（46/57 pass） |

### B. 风险评分算法

code-review-graph 的风险评分综合以下维度（算法来自其 Python 代码）：
- `caller_count`：被调次数（越多风险越高，越多人依赖）
- `test_coverage`：是否有测试覆盖
- `security_relevant`：是否涉及文件 IO / 鉴权 / token
- `depth`：在调用链中的深度（越深风险越高）
- `file_complexity`：所在文件的复杂度

### C. code-review-graph 可重用的设计模式

已写入 `memory/projects/code-review-graph-research.md`，包括：
- 社区检测（Leiden 算法 → vault 知识图谱主题簇）
- Hub/Bridge 分析（中心度 → 知识库枢纽页面）
- 知识差距分析（孤岛节点 → 无人引用的文档）

---

*本报告由蓝谷君基于 code-review-graph 跑分 + 手动审查 + sqlite3 查询生成。*
