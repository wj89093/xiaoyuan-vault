# 晓园 Vault 贡献指南

> 版本：v1.0
> 更新：2026-04-27

---

## 一、开发环境

### 1.1 环境要求

| 要求 | 版本 |
|------|------|
| Node.js | ≥ 20.x |
| npm | ≥ 10.x |
| macOS | ≥ 13 (Ventura) |

### 1.2 快速开始

```bash
# 1. Fork 项目
# 2. 克隆你的 Fork
git clone https://github.com/your-name/xiaoyuan-vault.git
cd xiaoyuan-vault

# 3. 安装依赖
npm install

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 QWEN_API_KEY

# 5. 启动开发
npm run dev
```

---

## 二、代码规范

### 2.1 TypeScript

- 使用 **TypeScript** 严格模式
- 避免 `any`，使用具体类型
- 接口和类型定义放在 `types.ts`

```typescript
// ✅ 推荐
interface FileRecord {
  path: string
  name: string
  isDirectory: boolean
}

// ❌ 避免
const file: any = {}
```

### 2.2 React 组件

- 使用 **函数组件** + Hooks
- 组件文件使用 `.tsx` 扩展名
- Props 类型定义在组件文件顶部

```typescript
// ✅ 推荐
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return <button className={variant}>{label}</button>
}
```

### 2.3 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `KnowledgeGraph.tsx` |
| 函数 | camelCase | `handleSelectFile` |
| 常量 | UPPER_SNAKE | `MAX_FILE_SIZE` |
| 类型/接口 | PascalCase | `FileRecord` |
| 文件夹 | kebab-case | `src/renderer/components/` |

### 2.4 文件组织

```
src/
├── main/                    # Electron 主进程
│   ├── index.ts            # 入口
│   └── services/           # 服务
│       ├── database.ts
│       └── ...
│
├── preload/                # 预加载
│   └── index.ts
│
└── renderer/              # 渲染进程
    ├── App.tsx            # 主应用
    ├── components/         # React 组件
    │   └── ComponentName/
    │       ├── index.tsx  # 组件
    │       └── styles.ts  # 样式（可选）
    ├── hooks/             # 自定义 Hooks
    └── utils/             # 工具函数
```

---

## 三、Git 工作流

### 3.1 分支命名

```
feature/xxx          # 新功能
fix/xxx              # Bug 修复
docs/xxx             # 文档更新
refactor/xxx         # 重构
```

### 3.2 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**类型**：
| Type | 说明 |
|------|------|
| feat | 新功能 |
| fix | Bug 修复 |
| docs | 文档 |
| style | 格式（不影响代码）|
| refactor | 重构 |
| test | 测试 |
| chore | 构建/工具 |

**示例**：

```bash
feat(frontmatter): 添加 openThreads 字段支持

- 支持待办事项列表
- 支持状态标记 [ ] / [x]
- 解析和序列化

Closes #123
```

### 3.3 Pull Request

1. Fork 并创建新分支
2. 开发并测试
3. 提交并 push
4. 创建 Pull Request
5. 等待 review

**PR 模板**：

```markdown
## 描述
简要说明这个 PR 做了什么。

## 类型
- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 重构

## 测试
- [ ] 本地测试通过
- [ ] 添加了测试用例

## 截图（如果是 UI 变更）
```

---

## 四、测试

### 4.1 本地测试

```bash
# 运行所有测试
npm test

# 开发模式测试
npm run dev
```

### 4.2 构建测试

```bash
# 构建生产版本
npm run build

# 打包安装包
npm run package
```

---

## 五、调试

### 5.1 主进程调试

```typescript
// 添加日志
import log from 'electron-log/main'

log.info('debug message')
log.error('error:', err)
```

日志位置：`~/Library/Logs/xiaoyuan-vault/`

### 5.2 渲染进程调试

打开 DevTools：`View → Toggle Developer Tools`

### 5.3 React DevTools

安装 [React DevTools](https://react.dev/learn/react-developer-tools) 扩展。

---

## 六、问题反馈

### 6.1 Bug 报告

请包含：
- 环境（macOS 版本、Node 版本）
- 复现步骤
- 预期 vs 实际
- 相关日志

### 6.2 功能建议

请描述：
- 你的使用场景
- 期望的行为
- 可能的替代方案

---

## 七、代码审查

### 7.1 Review 清单

- [ ] 代码符合规范
- [ ] 有适当的测试
- [ ] 更新了相关文档
- [ ] 没有引入新警告
- [ ] 类型定义完整

### 7.2 Review 原则

- 尊重他人代码
- 提供建设性反馈
- 讨论优于争论
