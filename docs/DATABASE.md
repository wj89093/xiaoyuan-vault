# 晓园 Vault 数据库设计

> 版本：v1.0
> 更新：2026-04-29

---

## 一、概述

- **数据库**：SQLite 3
- **位置**：`{vault}/.xiaoyuan/index.db`
- **访问方式**：better-sqlite3（同步 API）
- **全文搜索**：SQLite FTS5 虚拟表
- **并发模式**：WAL（Write-Ahead Logging）

---

## 二、数据库结构

### 2.1 ER 图

```
┌─────────────────┐       ┌─────────────────┐
│     files       │       │   files_fts     │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │───1:1─│ rowid (FK)     │
│ path            │       │ path            │
│ name            │       │ name            │
│ title           │       │ title           │
│ content         │       │ content         │
│ tags            │       │ tags            │
│ frontmatter     │       └─────────────────┘
│ folder          │
│ modified_at     │       ┌─────────────────┐
│ content_hash    │       │   triggers      │
└─────────────────┘       ├─────────────────┤
                          │ files_ai        │
                          │ files_ad        │
                          │ files_au        │
                          └─────────────────┘
```

---

## 三、表设计

### 3.1 files 主表

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,        -- 文件相对路径（相对于 vault）
  name TEXT NOT NULL,              -- 文件名（不含路径）
  title TEXT,                       -- 从 frontmatter 或 # heading 提取的标题
  content TEXT,                     -- 完整 Markdown 内容
  tags TEXT,                        -- 逗号分隔的标签
  frontmatter TEXT,                 -- JSON 序列化的完整 frontmatter
  folder TEXT,                      -- 所属文件夹（相对路径）
  modified_at INTEGER,               -- 文件修改时间（Unix timestamp ms）
  content_hash TEXT                 -- 内容哈希（用于检测变化）
);
```

**索引**：
```sql
CREATE UNIQUE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_folder ON files(folder);
CREATE INDEX idx_files_modified ON files(modified_at DESC);
```

### 3.2 files_fts 全文搜索表

```sql
CREATE VIRTUAL TABLE files_fts USING fts5(
  path,
  name,
  title,
  content,
  tags,
  content='files',
  content_rowid='rowid',
  tokenize='porter unicode61'        -- 中英文分词
);
```

**搜索字段权重**：
| 字段 | 权重 | 说明 |
|------|------|------|
| title | 最高 | 标题匹配优先 |
| name | 高 | 文件名匹配 |
| tags | 中 | 标签匹配 |
| content | 标准 | 正文匹配 |

### 3.3 触发器（Triggers）

FTS 表与主表通过触发器保持同步：

```sql
-- INSERT 触发器
CREATE TRIGGER files_ai AFTER INSERT ON files BEGIN
  INSERT INTO files_fts(rowid, path, name, title, content, tags)
  VALUES (new.rowid, new.path, new.name, new.title, new.content, new.tags);
END;

-- DELETE 触发器
CREATE TRIGGER files_ad AFTER DELETE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, path, name, title, content, tags)
  VALUES ('delete', old.rowid, old.path, old.name, old.title, old.content, old.tags);
END;

-- UPDATE 触发器
CREATE TRIGGER files_au AFTER UPDATE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, path, name, title, content, tags)
  VALUES ('delete', old.rowid, old.path, old.name, old.title, old.content, old.tags);
  INSERT INTO files_fts(rowid, path, name, title, content, tags)
  VALUES (new.rowid, new.path, new.name, new.title, new.content, new.tags);
END;
```

---

## 四、Frontmatter 结构

frontmatter 存储为 JSON 字符串，示例：

```json
{
  "title": "张三",
  "type": "person",
  "status": "active",
  "summary": "某公司创始人",
  "confidence": "high",
  "tags": ["创始人", "AI"],
  "created": "2026-04-29",
  "updated": "2026-04-29",
  "openThreads": [
    { "content": "待确认教育背景", "status": "open", "created": "2026-04-29" }
  ],
  "seeAlso": ["相关公司A", "相关公司B"],
  "relationships": [
    {
      "type": "founded",
      "target": "某公司",
      "confidence": "EXTRACTED",
      "source": "融资新闻"
    }
  ]
}
```

**字段类型**：

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 页面标题 |
| type | enum | person/company/project/meeting/deal/concept/research/collection |
| status | enum | active/archived |
| summary | string | 一句话摘要 |
| confidence | enum | high/medium/low |
| tags | string[] | 标签数组 |
| created | string | 创建日期 (YYYY-MM-DD) |
| updated | string | 更新日期 (YYYY-MM-DD) |
| openThreads | OpenThread[] | 待办事项 |
| seeAlso | string[] | 关联页面 |
| relationships | Relationship[] | 关系抽取 |

---

## 五、操作接口

### 5.1 文件索引

```typescript
// 主进程
async function indexFile(filePath: string): Promise<void>
```

**流程**：
1. 读取文件内容
2. 解析 frontmatter
3. 计算 content_hash
4. INSERT OR REPLACE 到 files 表
5. 触发器自动更新 FTS

### 5.2 搜索

```typescript
// 主进程
async function searchFiles(query: string): Promise<FileRecord[]>
```

**SQL**：
```sql
SELECT f.path, f.name, f.title, f.tags, f.modified_at, f.folder
FROM files f
JOIN files_fts fts ON f.rowid = fts.rowid
WHERE files_fts MATCH ?
ORDER BY rank
LIMIT 50
```

**FTS 搜索语法**：
- 精确词：`"word"`
- 前缀：`word*`
- OR：`word1 OR word2`
- AND：`word1 AND word2`

### 5.3 文件列表

```typescript
async function listVaultFiles(): Promise<FileRecord[]>
```

**返回结构**：
```typescript
interface FileRecord {
  path: string       // 相对路径
  name: string       // 文件名
  isDirectory: boolean
  modified: number   // 修改时间
  children?: FileRecord[]  // 子文件/文件夹
  title?: string     // 从 frontmatter 提取
  tags?: string      // 逗号分隔
}
```

---

## 六、Vault 创建

新建 Vault 时的初始化 SQL：

```typescript
async function initDatabase(vault: string): Promise<void> {
  const dbPath = join(vault, '.xiaoyuan', 'index.db');
  await mkdir(dirname(dbPath), { recursive: true });
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (...);
    CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(...);
    CREATE TRIGGER IF NOT EXISTS files_ai ...;
    CREATE TRIGGER IF NOT EXISTS files_ad ...;
    CREATE TRIGGER IF NOT EXISTS files_au ...;
  `);
}
```

---

## 七、备份与恢复

### 7.1 备份

直接复制 `.xiaoyuan/index.db` 文件即可。

**建议**：配合 Vault 文件夹的 Git 同步一起备份。

### 7.2 重建索引

如果 index.db 损坏，删除后重启应用会自动重建：

```bash
rm -rf /path/to/vault/.xiaoyuan/index.db
# 重启晓园 Vault
```

---

## 八、性能考量

### 8.1 WAL 模式

```sql
PRAGMA journal_mode = WAL;
```

- 读操作不阻塞写
- 写操作不阻塞读
- 适合 Electron 多进程场景

### 8.2 批量索引

首次打开 Vault 或大量文件变更时，分批处理避免阻塞：

```typescript
async function indexVault(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    // 递归处理，避免深度递归
  }
}
```

### 8.3 FTS 优化

- 定期 `OPTIMIZE TABLE files_fts`
- 避免搜索超长内容（前 10000 字符足够）

---

## 九、未来表结构（按开发阶段）

### 9.1 当前（v0.5.x）

```sql
-- files 主表 + FTS5（已实现）
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  title TEXT,
  content TEXT,
  tags TEXT,
  frontmatter TEXT,
  folder TEXT,
  modified_at INTEGER,
  content_hash TEXT
);

CREATE VIRTUAL TABLE files_fts USING fts5(
  path, name, title, content, tags,
  content='files',
  content_rowid='rowid',
  tokenize='porter unicode61'
);
```

### 9.2 Phase 2（v1.1.0）

```sql
-- 关系表
CREATE TABLE relationships (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  target_name TEXT NOT NULL,
  rel_type TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source TEXT,
  created_at INTEGER
);

-- 实体表
CREATE TABLE entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('person', 'company', 'concept', 'project', 'product')),
  context TEXT,
  source_file TEXT,
  confidence TEXT CHECK(confidence IN ('EXTRACTED', 'INFERRED', 'AMBIGUOUS')),
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- 实体关系表
CREATE TABLE entity_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_entity INTEGER NOT NULL,
  to_entity INTEGER NOT NULL,
  type TEXT NOT NULL,
  source_file TEXT,
  confidence TEXT CHECK(confidence IN ('EXTRACTED', 'INFERRED', 'AMBIGUOUS')),
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (from_entity) REFERENCES entities(id),
  FOREIGN KEY (to_entity) REFERENCES entities(id)
);

-- 剪贴板历史表
CREATE TABLE clipboard_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  content_type TEXT CHECK(content_type IN ('text', 'url', 'image')),
  source_app TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  saved INTEGER DEFAULT 0,
  file_path TEXT
);

-- 向量表
CREATE TABLE embeddings (
  path TEXT PRIMARY KEY,
  model TEXT,
  vector BLOB,
  updated_at INTEGER
);
```

### 9.3 Phase 3（v1.2.0）

```sql
-- 权限表
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  folder TEXT NOT NULL,
  role TEXT NOT NULL,
  user_id TEXT,
  created_at INTEGER
);

-- 协作锁
CREATE TABLE locks (
  file_path TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  locked_at INTEGER
);
```

### 9.4 Phase 4（v1.3.0）

```sql
-- 审计日志
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_path TEXT,
  details TEXT,
  ip_address TEXT,
  timestamp INTEGER
);
```

---

## 十、错误处理

| 错误 | 处理 |
|------|------|
| 数据库锁定 | 重试 3 次，间隔 100ms |
| 磁盘满 | 提示用户清理空间 |
| 文件不存在 | 从索引中移除 |
| JSON 解析失败 | 跳过 frontmatter 字段 |
