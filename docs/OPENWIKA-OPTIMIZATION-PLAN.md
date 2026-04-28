# OpenWiki 借鉴优化方案 — 晓园 Vault v1.1.0

> 基于 OpenWiki (kdsz001/OpenWiki) 研究，四个方向 + URL 抓取一起规划
> 时间：2026-04-28

---

## 一、剪贴板捕获 Popup（系统级复制监听）

### OpenWiki 实现原理
- **Tauri 后端监听**：通过 macOS `NSPasteboard` 或全局快捷键监听剪贴板变化
- **Popup 确认框**：复制内容后自动弹出小窗口，用户选择「保存/忽略/编辑」
- **内容分类**：文本/链接/图片自动识别，分别处理

### 晓园 Vault 适配方案

**技术选型**：
- Electron 主进程监听剪贴板：`clipboard` 模块轮询 + `nativeTheme` 判断
- 或使用 `globalShortcut` 注册 Cmd+Shift+V 触发捕获
- **更优方案**：`iohook` 或 `@nut-tree/nut.js` 全局监听复制事件

**实现架构**：
```
剪贴板监听 (main/index.ts)
  ↓ 检测到新内容
内容识别（文本/URL/图片）
  ↓
弹出 Mini Window（无边框、跟随鼠标位置）
  ↓
用户确认 → 保存到 0-收集/clip-YYYYMMDD-HHMMSS.md
  ↓
触发 AutoAI enrich（分类/标签/摘要）
```

**Mini Popup UI 设计**：
- 尺寸：400x200px，无边框，圆角 12px
- 内容预览：前 200 字符 + 类型图标
- 三个按钮：「✓ 保存」「✗ 忽略」「✎ 编辑」
- 自动消失：5 秒无操作自动关闭

**数据库表扩展**：
```sql
-- clipboard_history 表
CREATE TABLE clipboard_history (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  content_type TEXT CHECK(content_type IN ('text', 'url', 'image')),
  source_app TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  saved INTEGER DEFAULT 0,
  file_path TEXT
);
```

---

## 二、URL 内容抓取（网页解析 + 内容提取）

### OpenWiki 实现原理
- **网页抓取**：`fetch` + `cheerio` 解析 HTML
- **内容提取**：Readability 算法提取正文，去除广告/导航
- **元数据提取**：标题、作者、发布时间、封面图
- **YouTube 特殊处理**：`yt-dlp` 提取字幕

### 晓园 Vault 适配方案

**技术选型**：
- 主进程使用 `axios` + `cheerio` 抓取
- `readability` 包提取正文（Mozilla 开源）
- `turndown` HTML → Markdown 转换

**实现架构**：
```
用户粘贴 URL → 识别为链接
  ↓
主进程抓取网页（axios + cheerio）
  ↓
readability 提取正文
  ↓
turndown 转 Markdown
  ↓
保存到 0-收集/web-YYYYMMDD-HHMMSS.md
  ↓
元数据写入 frontmatter：
---
title: "原标题"
url: "https://..."
author: "作者"
date: "2026-04-28"
tags: ["auto-import", "web"]
---
  ↓
触发 enrich（分类/标签/摘要）
```

**特殊站点处理**：
| 站点类型 | 处理方案 |
|---------|---------|
| 微信公众号 | 搜狗微信搜索中转 + 特殊解析 |
| YouTube | yt-dlp 提取字幕 + 视频元数据 |
| Bilibili | API 获取视频信息 + 弹幕可选 |
| 知乎 | 移动端 UA + 反爬虫策略 |
| 普通网页 | readability + 通用规则 |

**IPC 接口**：
```typescript
// preload/index.ts
fetchURL: (url: string) => Promise<{
  title: string
  content: string
  author?: string
  date?: string
  url: string
}>
```

---

## 三、AI 自动整理 Wiki（enrich 流程加强）

### OpenWiki 实现原理
- **MECE 分类**：内置 9 个分类（收集/人物/公司/项目/会议/交易/概念/研究/归档）
- **实体识别**：AI 提取人名、公司、概念等实体
- **主题聚类**：相似内容自动聚类
- **知识图谱**：实体间关系自动构建

### 晓园 Vault 现有能力
- ✅ RESOLVER 分类（type/confidence/folder）
- ✅ enrich 入库（分类/标签/摘要）
- ✅ 导入自动触发
- ⚠️ 实体识别缺失
- ⚠️ 主题聚类缺失
- ⚠️ 知识图谱关系薄弱

### 优化方案

**1. 实体识别增强**：
```typescript
// enrich.ts 新增
async function extractEntities(content: string): Promise<Entity[]> {
  const prompt = `从以下内容中提取实体：
- 人物（姓名、职位）
- 公司（名称、行业）
- 概念（术语、方法论）
- 项目（名称、状态）

返回 JSON 数组：
[{type: "person", name: "...", context: "..."}, ...]`
  
  const result = await qwenAI(prompt, content)
  return JSON.parse(result)
}
```

**2. 主题聚类**：
- 使用 TF-IDF + K-Means 对文档聚类
- 或调用 AI 生成主题标签
- 自动建议「相关文档」

**3. 知识图谱关系加强**：
- 从实体识别结果自动构建 `vault_links`
- 关系类型：mentions、works_at、founded_by、related_to
- 图谱可视化：D3 force-directed + 关系标签

**4. 整理建议**：
- 定期扫描 `0-收集/` 内容
- AI 建议迁移目标文件夹
- 用户一键确认

---

## 四、知识图谱可视化（D3 图谱优化）

### OpenWiki 实现原理
- **D3.js force-directed graph**：节点 = 实体/文档，边 = 关系
- **交互**：点击节点展开详情，拖拽调整布局
- **过滤**：按实体类型/时间范围筛选
- **聚类**：相同颜色 = 同一主题

### 晓园 Vault 现有实现
- ✅ `VaultGraph.jsx` D3 组件
- ⚠️ 节点只有文档，无实体
- ⚠️ 关系只有双向链接，无语义关系
- ⚠️ 交互简单，无筛选/聚类

### 优化方案

**1. 图谱数据层增强**：
```typescript
// 节点类型扩展
interface GraphNode {
  id: string
  type: 'document' | 'person' | 'company' | 'concept' | 'project'
  label: string
  size: number  // 基于引用次数
  color: string  // 基于类型
}

interface GraphLink {
  source: string
  target: string
  type: 'mentions' | 'links_to' | 'related_to' | 'works_at'
  strength: number
}
```

**2. 可视化增强**：
- 节点大小 = 引用次数/重要性
- 节点颜色 = 类型（文档灰/人物蓝/公司绿/概念橙）
- 边粗细 = 关系强度
- 力导向参数可调（引力/斥力/距离）

**3. 交互增强**：
- 点击节点 → 侧边栏显示详情
- 双击节点 → 打开对应文档
- 框选多个 → 批量操作
- 右键菜单 → 添加到收藏/删除
- 缩放/平移/重置视图

**4. 筛选面板**：
- 按类型筛选节点
- 按时间范围筛选
- 按关系类型筛选
- 搜索定位节点

---

## 五、Ask Sidebar（AIChat 加强）

### OpenWiki 实现原理
- **上下文感知**：基于当前选中文档/整个知识库回答
- **来源引用**：回答中标注引用来源 [[文档标题]]
- **追问模式**：连续对话保持上下文
- **快捷指令**：/summarize /tag /classify 等命令

### 晓园 Vault 现有实现
- ✅ AIChat 组件（messages/onSend/loading）
- ✅ 基于文档内容回答（aiReason）
- ⚠️ 无追问上下文保持
- ⚠️ 无快捷指令
- ⚠️ 无来源引用高亮

### 优化方案

**1. 上下文保持**：
```typescript
// AIChat.tsx
const [sessionContext, setSessionContext] = useState<string[]>([])

// 发送时包含最近 6 轮对话
const fullPrompt = [
  ...sessionContext.slice(-6),
  `用户: ${input}`
].join('\n')
```

**2. 来源引用**：
- query 服务返回 `sources: [{title, path, relevance}]`
- AIChat 渲染时解析 `[[标题]]` 为可点击链接
- 点击跳转对应文档

**3. 快捷指令**：
| 指令 | 功能 |
|-----|------|
| /summarize | 总结当前文档 |
| /tags | 生成标签建议 |
| /classify | 分类建议 |
| /entities | 提取实体 |
| /graph | 显示相关图谱 |
| /export | 导出为 PDF |

**4. 双模式切换**：
- **文档模式**（有选中文件）：基于当前文档回答
- **全局模式**（无选中文件）：RAG 搜索全库回答
- 模式指示器显示当前状态

---

## 六、实施优先级

### Phase 1（v1.1.0，2-3 周）
1. **URL 内容抓取** — 独立功能，用户价值高
2. **Ask Sidebar 加强** — 上下文保持 + 来源引用 + 快捷指令
3. **剪贴板捕获 MVP** — 基础监听 + Popup + 保存到 0-收集/

### Phase 2（v1.2.0，3-4 周）
4. **AI 整理加强** — 实体识别 + 主题聚类 + 整理建议
5. **知识图谱优化** — 实体节点 + 语义关系 + 交互增强

### Phase 3（v1.3.0，2-3 周）
6. **Insight Reports** — 注意力分析、知识库周报、热点话题

---

## 七、技术文档更新清单

| 文档 | 更新内容 |
|-----|---------|
| `SKILLS.md` | 新增剪贴板/URL/实体识别技能定义 |
| `API.md` | 新增 IPC 接口：fetchURL、clipboardListen |
| `ARCHITECTURE.md` | 新增系统架构图（剪贴板/URL 模块） |
| `DATABASE.md` | 新增 clipboard_history、entities 表 |
| `CHANGELOG.md` | v1.1.0 变更记录 |
| `PRD.md` | 功能规格更新 |

---

## 八、关键代码实现（预览）

### 剪贴板监听（主进程）
```typescript
// main/index.ts
import { clipboard } from 'electron'

let lastClipboard = ''
setInterval(() => {
  const text = clipboard.readText()
  if (text && text !== lastClipboard) {
    lastClipboard = text
    // 发送到渲染进程显示 Popup
    mainWindow.webContents.send('clipboard:new', {
      content: text,
      type: detectContentType(text),
      timestamp: Date.now()
    })
  }
}, 1000)
```

### URL 抓取（主进程）
```typescript
// main/services/urlFetch.ts
import axios from 'axios'
import * as cheerio from 'cheerio'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'

export async function fetchURL(url: string) {
  const { data: html } = await axios.get(url, { timeout: 10000 })
  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()
  
  const turndown = new TurndownService()
  const markdown = turndown.turndown(article.content)
  
  return {
    title: article.title,
    content: markdown,
    author: article.byline,
    url
  }
}
```

### 实体识别（enrich 服务）
```typescript
// main/services/enrich.ts 新增
export async function extractEntities(content: string) {
  const prompt = `提取实体，返回 JSON：
[{type, name, context}]`
  
  const result = await qwenAI(prompt, content)
  return JSON.parse(result)
}
```

---

## 九、风险评估

| 风险 | 缓解措施 |
|-----|---------|
| 剪贴板监听性能 | 轮询间隔 1s，非空才处理 |
| URL 抓取被封 | User-Agent 轮换 + 请求间隔 |
| AI 调用成本 | 本地缓存 + 批量处理 |
| 隐私合规 | 本地存储，不上传云端 |

---

## 十、下一步行动

1. **用户确认方案** → 确定 Phase 1 范围
2. **更新技术文档** → SKILLS.md / API.md / ARCHITECTURE.md
3. **实现 URL 抓取** → 独立 PR，快速交付
4. **剪贴板 MVP** → 基础功能先跑通
5. **AIChat 加强** → 上下文 + 引用 + 指令

---

*方案制定：蓝谷君*
*参考：OpenWiki v0.2.0 (kdsz001/OpenWiki)*
