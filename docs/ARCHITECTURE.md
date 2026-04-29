# 晓园 Vault 架构文档

> 版本：v1.0
> 更新：2026-04-28

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Electron 主进程                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   数据库服务   │  │  AutoAI 引擎  │  │      系统托盘         │ │
│  │ (SQLite FTS5)│  │  (定时任务)   │  │   (Tray Manager)    │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  剪贴板监听   │  │  URL 抓取    │  │      文件导入        │ │
│  │(Clipboard)   │  │(URL Fetch)  │  │   (Import Window)   │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                      IPC Handler                          │  │
│  │  vault:* / file:* / folder:* / ai:* / import:*           │  │
│  │  clipboard:* / url:*                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC
┌─────────────────────────────────────────────────────────────────┐
│                      Electron 渲染进程                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  侧边栏       │  │  编辑器       │  │     AI 面板         │  │
│  │ FileTree     │  │ CodeMirror   │  │   AIChat           │  │
│  │ SearchResults │  │ Editor       │  │   (分类/标签/摘要/对话) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    React 19 App.tsx                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **主进程** | Electron 34 | 窗口管理、文件系统、AI引擎 |
| **渲染进程** | React 19 + React Router | UI 框架 |
| **编辑器** | CodeMirror 6 | Markdown 编辑器 |
| **状态管理** | React hooks (useState/useCallback) | 无 Redux |
| **数据库** | SQLite + better-sqlite3 + FTS5 | 本地全文搜索 |
| **图谱** | D3.js | 力导向知识图谱 |
| **AI** | 通义千问 API (Qwen3.5-Flash) | 文字处理 |
| **剪贴板** | electron clipboard + iohook | 系统级复制监听（📋 Phase 2 规划） |
| **URL 抓取** | axios + cheerio + readability | 网页内容提取 |
| **日志** | electron-log | 日志记录 |
| **构建** | electron-vite + electron-builder | 打包发布 |

---

## 三、目录结构

```
xiaoyuan-vault/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 入口、窗口管理、IPC 注册
│   │   ├── tray.ts             # 系统托盘
│   │   ├── importWindow.ts     # 导入窗口
│   │   └── services/           # 服务层
│   │       ├── database.ts     # SQLite FTS5 搜索
│   │       ├── frontmatter.ts  # YAML 解析/序列化
│   │       ├── autoAIEngine.ts # AutoAI 定时引擎
│   │       ├── qwen.ts         # 通义千问 API
│   │       ├── converters.ts    # 文件格式转换
│   │       └── whisper.ts       # 语音转写
│   │
│   ├── preload/                # 预加载脚本
│   │   └── index.ts            # IPC 桥接
│   │
│   └── renderer/               # 渲染进程
│       ├── App.tsx             # 主应用
│       ├── ImportApp.tsx       # 导入应用
│       ├── main.tsx            # 入口
│       ├── types.ts            # 类型定义
│       ├── components/          # React 组件
│       │   ├── FileTree.tsx    # 文件树
│       │   ├── Editor.tsx      # 编辑器
│       │   ├── EditorWithToolbar.tsx
│       │   ├── AIPanel.tsx     # AI 面板
│       │   ├── AIChat.tsx      # AI 对话
│       │   ├── KnowledgeGraph.tsx # D3 知识图谱
│       │   ├── SearchResults.tsx
│       │   ├── Toolbar.tsx
│       │   ├── DropZone.tsx
│       │   └── ...
│       └── styles/             # 样式
│
├── docs/                       # 技术文档
├── package.json
├── electron-builder.json
├── electron.vite.config.ts
└── tsconfig.json
```

---

## 四、数据流

### 4.1 文件读取流程

```
用户点击文件
    ↓
App.tsx.handleSelectFile()
    ↓
window.api.readFile(path)        [IPC: file:read]
    ↓
主进程: getFileContent(path)     [fs: readFile]
    ↓
返回 Markdown 文本
    ↓
Editor.tsx 显示内容
```

### 4.2 文件保存流程

```
用户编辑内容 → Editor.tsx onChange
    ↓
App.tsx.handleSave()            [用户手动保存]
    ↓
window.api.saveFile(path, content) [IPC: file:save]
    ↓
主进程: saveFile(path, content)  [fs: writeFile + 重新索引]
    ↓
更新 SQLite FTS5 索引
    ↓
返回成功
```

### 4.3 AI 分类流程

```
用户点击 "AI 分类"
    ↓
AIPanel → onAI('classify')
    ↓
window.api.aiClassify(content)   [IPC: ai:classify]
    ↓
主进程: callQwenAI('classify')
    ↓
通义千问 API → 返回文件夹建议
    ↓
更新 frontmatter → 保存文件
```

### 4.4 搜索流程

```
用户输入搜索词
    ↓
App.tsx.handleSearch(query)
    ↓
window.api.searchFiles(query)     [IPC: file:search]
    ↓
主进程: searchFiles(query)
    ↓
SQLite FTS5 全文搜索
    ↓
返回 FileRecord[] → SearchResults 显示
```

---

## 五、模块设计

### 5.1 数据库服务 (database.ts)

**职责**：
- SQLite 数据库初始化
- 文件索引（path, title, content, tags, frontmatter）
- FTS5 全文搜索
- 文件 CRUD 操作

**关键表**：

```sql
-- 文件索引表
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE,
  name TEXT,
  title TEXT,
  content TEXT,
  tags TEXT,
  frontmatter TEXT,    -- JSON 序列化的 frontmatter
  folder TEXT,
  modified_at INTEGER,
  content_hash TEXT
);

-- FTS5 全文搜索表
CREATE VIRTUAL TABLE files_fts USING fts5(
  path, name, title, content, tags,
  content='files',
  content_rowid='rowid'
);

-- 触发器：增删改同步 FTS
```

### 5.2 Frontmatter 服务 (frontmatter.ts)

**职责**：
- YAML frontmatter 解析
- frontmatter 序列化
- 双层页面模板生成
- Wiki links 抽取

**关键接口**：

```typescript
interface Frontmatter {
  title?: string
  type?: string           // person/company/project/meeting/deal/concept/research/collection
  status?: string         // active/archived
  summary?: string
  confidence?: string     // high/medium/low
  tags?: string[]
  created?: string
  updated?: string
  openThreads?: OpenThread[]
  seeAlso?: string[]
  relationships?: Relationship[]
}

parseFrontmatter(content: string): { frontmatter: Frontmatter; content: string }
stringifyFrontmatter(frontmatter: Frontmatter): string
generateFileTemplate(title: string, type?: string): string
extractWikiLinks(content: string): string[]
```

### 5.3 AutoAI 引擎 (autoAIEngine.ts)

**职责**：
- 定时扫描文件
- 自动执行 AI 任务（分类/标签/摘要）
- 根据设置自动更新 frontmatter

**配置**：
```typescript
interface AutoAISettings {
  enabled: boolean
  interval: number        // 分钟: 30/60/120/360
  onClassify: boolean     // 自动分类
  onTags: boolean         // 自动标签
  onSummary: boolean      // 自动摘要
}
```

### 5.4 Qwen AI 服务 (qwen.ts)

**职责**：
- 通义千问 API 调用
- 5 种 AI 能力封装

**支持的 Action**：
| Action | 说明 | 输入 | 输出 |
|--------|------|------|------|
| classify | AI 分类 | content + folders | folder name |
| tags | AI 标签 | content | string[] |
| summary | AI 摘要 | content | string |
| reason | AI 推理 | question + context | string |
| write | AI 写作 | outline | string |

### 5.5 导入服务 (converters.ts)

**职责**：
- 文件格式检测
- 多格式转 Markdown

**支持格式**：
| 格式 | 方法 | 说明 |
|------|------|------|
| PDF | pdf-parse | 文本提取 |
| Word | mammoth | DOCX → Markdown |
| 图片 | tesseract.js | OCR 文字识别 |
| Excel | xlsx | 数据提取 |

---

## 六、版本与模块对照

### 6.1 模块状态

| 模块 | 状态 | 说明 |
|------|------|------|
| **数据库** | | |
| files 主表 + FTS5 | ✅ 已实现 | SQLite + 全文搜索 |
| relationships 表 | 📋 Phase 2 | Typed links 关系表 |
| embeddings 表 | 📋 Phase 2 | 语义搜索向量存储 |
| **AI 引擎** | | |
| ai:classify / tags / summary / reason / write | ✅ 已实现 | 5 种 AI 能力 |
| autoAIEngine | ✅ 已实现 | 定时自动执行引擎 |
| **技能系统** | | |
| RESOLVER.md | ⚠️ 骨架已建 | 决策树文件已创建，代码路由未实现 |
| enrich / query / maintain | ✅ v1.0 | 已实现（代码完成） |
| **协作** | | |
| Git 协同 / 权限 / 团队 | 📋 Phase 3 | |
| **企业** | | |
| SSO / 审计 / 分享 | 📋 Phase 4 | |

### 6.2 定价模型

- 第 1 人免费，每增加 1 人 ¥19/月
- 无功能分级，所有功能对所有付费用户开放
- 座位数 = 实际使用人数

---

## 七、Vault 结构

新建 Vault 时的目录结构（Phase 0.5）：

```
用户选择的 Vault/
├── 0-收集/                    # 快速入口
├── .raw/                     # 原始文件
│   ├── 文档/
│   ├── 截图/
│   └── 来源/
├── .xiaoyuan/               # 应用数据
│   └── index.db             # SQLite 索引
├── RESOLVER.md              # AI 决策树
├── schema.md                # 页面规范
├── index.md                 # 内容目录
└── log.md                   # 操作日志
```

---

## 七、IPC 接口

| 类别 | 接口 | 说明 |
|------|------|------|
| **Vault** | vault:create / open / getLast / clear | Vault 管理 |
| **File** | file:list / read / save / create / delete | 文件 CRUD |
| **Folder** | folder:create / delete | 文件夹操作 |
| **Search** | file:search | FTS5 搜索 |
| **AI** | ai:classify / tags / summary / reason / write | AI 能力 |
| **Import** | file:import / import:fetchUrl / saveUrl | 导入功能 |
| **AutoAI** | autoAI:get / save | AutoAI 配置 |

详见 [API.md](./API.md)

---

## 八、知识图谱

### 8.1 节点

- 每个 Markdown 文件 = 一个节点
- 节点属性：path, name, tags, folder
- 节点大小：tags 越多越大

### 8.2 连线

**Wiki 链接**（实线）：
- 从 [[双链]] 正则抽取
- 双向关系

**文件夹共现**（虚线）：
- 同一文件夹内的文件互相连接

### 8.3 力导向布局

```javascript
d3.forceSimulation(nodes)
  .force('link', d3.forceLink(links).distance(80).strength(0.3))
  .force('charge', d3.forceManyBody().strength(-120))  // 节点互斥
  .force('cluster', forceCluster(folderIndex))         // 按文件夹聚类
```

---

## 九、依赖关系

```
package.json
├── electron ^34.0.0
├── react ^19.0.0
├── better-sqlite3 ^11.7.0      # SQLite
├── d3 ^7.9.0                   # 图谱
├── @codemirror/* ^6.35.0      # 编辑器
├── @uiw/react-codemirror       # React 封装
├── electron-log ^5.2.0         # 日志
├── electron-builder ^25.1.8     # 打包
└── electron-vite ^3.0.0         # 构建工具
```

---

## 十、构建流程

```bash
# 开发
npm run dev          # electron-vite dev

# 生产构建
npm run build        # electron-vite build

# 打包安装包
npm run package      # electron-vite build + electron-builder
```

输出：
- macOS: `.dmg`
- Windows: `.exe` (NSIS installer)
- Linux: `.AppImage`
