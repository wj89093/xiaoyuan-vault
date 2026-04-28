# 晓园 Vault 代码规范

> 版本：v1.0
> 更新：2026-04-27

---

## 一、TypeScript 规范

### 1.1 严格模式

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

### 1.2 类型定义

**优先使用 interface**，除非需要联合类型或枚举：

```typescript
// ✅ 推荐：interface
interface User {
  id: string
  name: string
  email: string
}

// ✅ 可用：type alias
type Status = 'active' | 'archived' | 'pending'
type ID = string | number
```

### 1.3 避免 any

```typescript
// ❌ 禁止
function process(data: any) {
  return data.value
}

// ✅ 使用 unknown + 类型守卫
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value
  }
  throw new Error('Invalid data')
}
```

### 1.4 可选链 & 空值合并

```typescript
// ❌ 避免
const name = user && user.profile && user.profile.name

// ✅ 使用可选链
const name = user?.profile?.name ?? 'Anonymous'
```

### 1.5 函数类型

```typescript
// ✅ 推荐：显式函数类型
type FileHandler = (file: FileRecord) => Promise<void>

// ✅ 回调使用 type
type Callback = (error: Error | null, result?: string) => void
```

---

## 二、React 规范

### 2.1 组件定义

```typescript
// ✅ 使用函数组件
export function FileTree({ files, onSelect }: FileTreeProps): JSX.Element {
  // ...
}

// ❌ 避免类组件
class FileTree extends Component<FileTreeProps> {
  // ...
}
```

### 2.2 Props 类型

```typescript
// ✅ 定义 Props 接口
interface ButtonProps {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  className?: string
}

// ✅ 解构时标注默认值
export function Button({
  label,
  onClick,
  variant = 'primary',
  disabled = false,
  className
}: ButtonProps) {
  // ...
}
```

### 2.3 Hooks

```typescript
// ✅ useState 泛型
const [files, setFiles] = useState<FileRecord[]>([])

// ✅ useCallback 依赖数组完整
const handleSave = useCallback(async () => {
  await window.api.saveFile(path, content)
}, [path, content])

// ✅ useMemo 复杂计算
const sortedFiles = useMemo(() => {
  return files.slice().sort((a, b) => a.name.localeCompare(b.name))
}, [files])
```

### 2.4 条件渲染

```typescript
// ✅ 使用短路求值
{isLoading && <Spinner />}

// ✅ 使用三元表达式（简单情况）
{isEmpty ? <EmptyState /> : <List items={items} />}

// ❌ 避免复杂嵌套
{condition1 ? (
  condition2 ? (
    <A />
  ) : (
    <B />
  )
) : (
  <C />
)}
```

---

## 三、文件组织

### 3.1 导入顺序

```typescript
// 1. React / 内置
import { useState, useCallback } from 'react'
import { useEffect } from 'react'

// 2. 第三方
import { join } from 'path'
import log from 'electron-log/main'

// 3. 相对导入
import { FileRecord } from '../types'
import { parseFrontmatter } from './frontmatter'

// 4. 类型导入
import type { Frontmatter } from './types'
```

### 3.2 导出方式

```typescript
// ✅ 命名导出（常用）
export function processFile() { ... }

// ✅ 默认导出（组件）
export default function App() { ... }

// ❌ 避免混合使用
export function A() {}
export default function B() {}
```

---

## 四、命名规范

### 4.1 变量和函数

```typescript
// ✅ camelCase
const filePath = '/path/to/file'
const handleClick = () => {}

// ✅ 常量 UPPER_SNAKE
const MAX_FILE_SIZE = 10 * 1024 * 1024
const API_BASE_URL = 'https://api.example.com'

// ❌ 避免缩写
const fp = '/path'  // 不清晰
const hc = () => {}  // 不清晰
```

### 4.2 组件和类型

```typescript
// ✅ PascalCase
function KnowledgeGraph() {}
interface FileTreeProps {}
type SearchStatus = 'idle' | 'loading' | 'success' | 'error'

// ❌ 避免下划线
function knowledge_graph() {}
```

### 4.3 文件名

```typescript
// ✅ 组件文件：PascalCase.tsx
FileTree.tsx
AIPanel.tsx
KnowledgeGraph.tsx

// ✅ 非组件：kebab-case.ts
database.ts
frontmatter.ts
auto-ai-engine.ts

// ✅ 类型文件：types.ts 或 [name].types.ts
types.ts                    // 通用类型
file-tree.types.ts         // 组件专用类型
```

---

## 五、错误处理

### 5.1 同步错误

```typescript
// ✅ 使用 try-catch
try {
  const content = await readFile(path)
  return parseContent(content)
} catch (error) {
  log.error('Failed to read file:', path, error)
  throw new FileReadError(`Cannot read ${path}`, { cause: error })
}
```

### 5.2 异步错误

```typescript
// ✅ async/await + try-catch
async function loadData(): Promise<Data> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new HTTPError(response.status, response.statusText)
    }
    return response.json()
  } catch (error) {
    log.error('Load failed:', error)
    throw error
  }
}
```

### 5.3 错误类型

```typescript
// ✅ 定义错误类型
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'AppError'
  }
}

class FileReadError extends AppError {
  constructor(path: string, options?: ErrorOptions) {
    super(`Cannot read file: ${path}`, 'FILE_READ', options)
    this.name = 'FileReadError'
  }
}
```

---

## 六、日志规范

### 6.1 日志级别

| 级别 | 使用场景 |
|------|----------|
| `log.info()` | 正常流程、重要状态变更 |
| `log.warn()` | 可恢复的错误、异常情况 |
| `log.error()` | 操作失败、需要调查的问题 |

### 6.2 日志格式

```typescript
// ✅ 包含上下文
log.info('File saved', { path, size, duration: elapsed })

// ❌ 缺少上下文
log.info('File saved')
log.error('Save failed')
```

### 6.3 敏感信息

```typescript
// ❌ 禁止记录敏感信息
log.info('User logged in', { password: 'xxx' })
log.info('API response', { apiKey: 'sk-xxx' })

// ✅ 脱敏处理
log.info('API called', { key: apiKey.slice(0, 8) + '...' })
```

---

## 七、代码格式

### 7.1 ESLint + Prettier

项目使用 ESLint + Prettier：

```bash
# 检查
npm run lint

# 自动修复
npm run lint:fix

# 格式化
npm run format
```

### 7.2 Git Hooks

提交前自动检查：

```bash
# .husky/pre-commit
npm run lint:fix
npm test
```

---

## 八、性能规范

### 8.1 避免不必要的重渲染

```typescript
// ✅ React.memo 包裹纯组件
export const MemoizedComponent = React.memo(PureComponent)

// ✅ useCallback 稳定回调
const handleClick = useCallback(() => {
  onAction(id)
}, [id, onAction])
```

### 8.2 懒加载

```typescript
// ✅ 大组件懒加载
const HeavyComponent = React.lazy(() => import('./HeavyComponent'))

// ✅ 在 Suspense 中使用
<Suspense fallback={<Loading />}>
  <HeavyComponent />
</Suspense>
```

### 8.3 避免深度嵌套

```typescript
// ❌ 过度嵌套
function process(items) {
  if (items) {
    if (items.length > 0) {
      for (const item of items) {
        if (item.valid) {
          // 处理
        }
      }
    }
  }
}

// ✅ 提前返回
function process(items) {
  if (!items?.length) return
  for (const item of items) {
    if (!item.valid) continue
    // 处理
  }
}
```

---

## 九、安全规范

### 9.1 输入验证

```typescript
// ✅ 验证输入
function sanitizePath(input: string): string {
  if (input.includes('..')) {
    throw new Error('Invalid path: parent directory reference')
  }
  return input.replace(/[<>:"|?*]/g, '_')
}
```

### 9.2 避免 eval

```typescript
// ❌ 禁止
eval(userInput)

// ✅ 使用 JSON.parse（带异常处理）
function parseJSON(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}
```

### 9.3 IPC 安全

```typescript
// ✅ 验证 IPC 参数
ipcMain.handle('file:read', async (_, filePath: string) => {
  if (typeof filePath !== 'string') {
    throw new Error('Invalid path')
  }
  // 处理...
})
```

---

## 十、注释规范

### 10.1 JSDoc

```typescript
/**
 * 解析 Markdown 文件的 frontmatter
 *
 * @param content - 完整的 Markdown 文件内容
 * @returns 解析后的 frontmatter 对象和正文内容
 *
 * @example
 * const { frontmatter, content } = parseFrontmatter(markdownText)
 */
export function parseFrontmatter(content: string) {
  // ...
}
```

### 10.2 行内注释

```typescript
// ✅ 解释为什么，不解释是什么
// 使用负指数避免重复计算
const normalizedValue = value / (max - min + 1)

// ❌ 解释显而易见的代码
// 累加数组
const sum = values.reduce((a, b) => a + b, 0)
```
