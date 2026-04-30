# 代码审查标准与流程 — 概览

## 完成内容

为晓园 Vault 项目建立了系统的代码审查机制，包括：

### 1. 代码审查标准文档
- **文件**: `docs/CODE_REVIEW.md`
- 审查流程（7 步流程 + 分级审查 P0/P1/P2）
- 6 大审查维度 + 权重分配（正确性 30%、类型安全 20%、安全 15%、可维护性 15%、性能 10%、测试 10%）
- 完整的自查清单（作者提交前）和审查清单（审查人使用）
- 审查意见规范（MUST / SHOULD / IDEA / QUESTION 分类）
- 常见问题速查表
- 度量指标

### 2. ESLint + Prettier 配置
- **文件**: `eslint.config.ts`、`.prettierrc`、`.prettierignore`
- ESLint 10 flat config + typescript-eslint（含类型感知规则）
- 主进程 / 渲染进程 / 测试文件分区配置
- React Hooks + React Refresh 插件
- 首次扫描发现 1090 错误 / 43 警告，主要集中在 any/unsafe 类型

### 3. package.json 脚本补齐
- 新增: `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `check`
- 与 CODING_STANDARDS.md 文档保持一致

### 4. PR 模板
- **文件**: `.github/pull_request_template.md`
- 包含自查清单、变更类型、审查等级、测试说明

### 5. 文档更新
- `docs/CODING_STANDARDS.md` — 更新 ESLint/Prettier 章节，匹配实际配置
- `docs/CODE_REVIEW.md` — 附首次扫描统计数据和现有问题清单

## 关键发现

| 问题 | 数量 | 优先级 |
|------|------|--------|
| any 类型 / unsafe 操作 | ~770 | P0 |
| prefer-nullish-coalescing | 129 | P1 |
| no-unused-vars | 44 | P1 |
| no-console | 30 | P2 |
| Promise 相关（misused/floating） | 49 | P1 |

## 后续建议

1. 分批修复现有 lint 错误，优先处理 P0 安全问题
2. 配置 husky + lint-staged 实现 pre-commit 自动检查
3. 配置 GitHub Actions CI 门禁
4. 定期回顾审查度量指标
