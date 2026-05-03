# 晓园 Vault 重构规划
> 基于 `CODE_REVIEW_GRAPH_REPORT.md` (2026-05-02) 的系统化重构方案

---

## 一、当前状态快照

| 文件 | 行数 | 问题 |
|------|------|------|
| `src/main/index.ts` | **850** | 58 IPC handlers，setupIpcHandlers 642行 |
| `src/renderer/App.tsx` | **581** | 组件过大，耦合多个状态 |
| `src/main/services/agentAdapter.ts` | 134 | path traversal + catch bug |
| `src/main/services/chat.ts` | 460 | 会话管理，报告高风险函数 |
| `src/main/services/` (合计) | ~3000 | 分散在 15+ services |

---

## 二、重构优先级

### P0 — 立即修复（不改结构，只修 bug）

| # | 问题 | 文件 | 修复方案 |
|---|------|------|----------|
| P0-1 | `processCommand` catch 块引用未定义变量 `e` | `agentAdapter.ts:51` | 改 `catch` 为 `catch(e)` |
| P0-2 | `startAgentAdapter` path traversal：`filename` 未校验 | `agentAdapter.ts:36` | 加 `basename(filename) === filename` 校验 |

**工作量**：各 1 行，5 分钟。

---

### P1 — 核心重构：`main/index.ts` 拆解

**目标**：850 行 → ~150 行

**现状**：58 个 IPC handler 全堆在 `setupIpcHandlers()`，按文件混乱排列。

**拆分方案**：按领域分组，每组一个 handler 文件。

```
src/main/ipc/
├── index.ts          # setupIpcHandlers 统一注册（~50行）
├── fileHandlers.ts  # file:rename/move/delete, folder:*, file:create/save/read/search/list/import
├── vaultHandlers.ts # vault:open/getLast/create/clear/path
├── chatHandlers.ts  # chat:*
├── aiHandlers.ts   # ai:write/summary/tags/classify/reason
├── graphHandlers.ts # graph:load/rebuild
├── importHandlers.ts # import:*/converter:*/url:*
├── enrichHandlers.ts # enrich:*
├── authHandlers.ts  # auth:*
├── providerHandlers.ts # provider:*
└── miscHandlers.ts  # autoAI:*/clipboard:*/folderMap:*/maintain:*
```

**handler 数量分布**（58 个）：
- `fileHandlers.ts`: 11 个
- `chatHandlers.ts`: 6 个
- `aiHandlers.ts`: 5 个
- `importHandlers.ts`: 8 个 + `converter`: 3 个 + `url`: 2 个
- `enrichHandlers.ts`: 4 个
- `vaultHandlers.ts`: 5 个
- `authHandlers.ts`: 4 个
- `providerHandlers.ts`: 2 个
- `graphHandlers.ts`: 2 个
- `miscHandlers.ts`: 6 个（autoAI + clipboard + folderMap + maintain）

**步骤**：
1. 创建 `src/main/ipc/` 目录
2. 按领域拆出各个 handler 文件
3. 每个 handler 文件独立 import 所需 service
4. `index.ts` 统一 `import * as fileHandlers from './fileHandlers'` 并注册
5. 删除原 `setupIpcHandlers` 内容

**验收标准**：
- `main/index.ts` < 200 行
- 所有 58 个 handler 功能不变（回归测试）
- Build ✅，Lint ✅

---

### P2 — App.tsx 拆分

**目标**：581 行 → < 250 行

**现状**：单文件组件，状态过多（messages、fileList、activeTab 等）。

**拆分方案**：

```
src/renderer/components/
├── ChatPanel.tsx      # chat: 会话列表 + ChatInput + 流式响应
├── FilePanel.tsx      # file: 文件列表 + 搜索栏 + 导入按钮
├── AIPanel.tsx        # ai: AI 对话界面（已有框架）
└── SettingsPanel.tsx # 设置面板（可选）

src/renderer/hooks/
├── useChatSession.ts  # chat: 会话状态管理
├── useFileList.ts    # file: 文件列表状态
└── useVault.ts       # vault: 路径状态
```

App.tsx 剩余职责：
- 顶层状态（currentVault）
- 路由（hash → render 对应面板）
- 布局（CSS Grid）
- 快捷键

**步骤**：
1. 提取 `ChatPanel.tsx`（会话列表 + 流式响应）
2. 提取 `FilePanel.tsx`（文件树 + 搜索）
3. 提取自定义 hooks
4. App.tsx 仅保留布局 + 路由逻辑

---

### P3 — chat.ts 会话管理加固

**目标**：给高风险函数加防护 + 补类型

**报告高风险函数**（无测试）：
- `getSessionsDir` (0.85)
- `loadSessions` (0.85)
- `saveSessions` (0.70)
- `createSession` (0.70)
- `deleteSession` (0.70)

**改进项**：
| # | 改进 | 原因 |
|---|------|------|
| 1 | `loadSessions` 返回值加类型断言 | 防止 JSON 解析异常 |
| 2 | `saveSessions` 写前备份 | 防止数据损坏 |
| 3 | `deleteSession` 加确认机制（IPC 层面） | 防误删 |
| 4 | 所有函数加 `vaultPath` 非空校验 | 已在 `getSessionsDir` 有，需检查其他 |

**工作量**：~2 小时，不改核心逻辑。

---

### P4 — 鉴权模块安全审计

**当前函数**：
- `handleAuthCallback` (line 11)
- `getAuthToken` (line 29)
- `getAuthEmail` (line 33)
- `clearAuthToken` (line 37)

**审计结果**：结构安全，用 `electron-store`，无明显漏洞。

**建议**：
| # | 建议 | 优先级 |
|---|------|--------|
| 1 | `handleAuthCallback` 加 token 格式校验（JWT 长度/格式） | 中 |
| 2 | `clearAuthToken` 后应广播 `auth:cleared` 事件 | 低 |
| 3 | OAuth URL 加 state 参数防 CSRF | 低 |

---

### P5 — 测试覆盖（可选，长期）

**高风险无测试函数**：
```
chat.ts:      getSessionsDir, loadSessions, saveSessions, createSession, deleteSession
main/index:   handleAuthCallback, getAuthToken, getAuthEmail, clearAuthToken
auth-gateway: authMiddleware
resolver.ts:  makeDefault (报告新增)
```

**测试框架建议**：Vitest（已内置 Electron 测试支持）

---

## 三、推荐执行顺序

```
Phase 1: P0 bug 修复（5 分钟）
  → 修复 processCommand catch + path traversal

Phase 2: P1 main/index.ts 拆解（3-4 小时）
  → 最关键，代码量最大
  → 完成后 main/index.ts 从 850 行 → ~150 行

Phase 3: P2 App.tsx 拆分（2-3 小时）
  → 依赖 Phase 2 的 IPC 拆分（需要确认 API 不变）

Phase 4: P3 chat.ts 加固（1-2 小时）
  → 独立于其他 phases，可并行

Phase 5: P4 鉴权审计（1 小时）
  → 独立，可并行

Phase 6: P5 测试覆盖（长期，Vitest 配置好后可逐步加）
```

---

## 四、技术约束

1. **不能破坏现有 API**：`window.api` 对 renderer 的接口必须向后兼容
2. **IPC handler 拆分后**：所有 handler 名称不能变（renderer 端依赖）
3. **Build 必须始终通过**：每次 commit 前 `npm run build`
4. **Git push 策略**：每完成一个 phase commit 一次，避免大合并
5. **Lint**：保持 0 warnings（已建立基线）

---

## 五、当前已知 bug（可直接修）

### B1: agentAdapter.ts catch 块
```typescript
// 当前（错误）：
} catch {
  log.error('[AgentAdapter] failed to parse command file:', filePath, e)
  return
}

// 修复：
} catch (e) {
  log.error('[AgentAdapter] failed to parse command file:', filePath, e)
  return
}
```

### B2: agentAdapter.ts path traversal
```typescript
// 当前（危险）：
const filePath = join(COMMANDS_DIR, filename)

// 修复：
const safeName = basename(filename)
if (safeName !== filename || !filename.endsWith('.json')) return
const filePath = join(COMMANDS_DIR, safeName)
```
