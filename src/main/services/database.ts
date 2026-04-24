import Database from 'better-sqlite3'
import { join } from 'path'
import { readdir, stat, readFile, writeFile, mkdir } from 'fs/promises'
import log from 'electron-log/main'

let db: Database.Database | null = null
let vaultPath: string = ''

export async function initDatabase(vault: string): Promise<void> {
  vaultPath = vault
  const dbPath = join(vault, '.xiaoyuan', 'index.db')

  // Ensure .xiaoyuan directory exists
  await mkdir(join(vault, '.xiaoyuan'), { recursive: true })

  db = new Database(dbPath)

  // Create FTS5 table for full-text search
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE,
      title TEXT,
      content TEXT,
      tags TEXT,
      folder TEXT,
      modified_at INTEGER,
      content_hash TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
      path,
      title,
      content,
      tags,
      content='files',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
      INSERT INTO files_fts(rowid, path, title, content, tags)
      VALUES (new.rowid, new.path, new.title, new.content, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
      INSERT INTO files_fts(files_fts, rowid, path, title, content, tags)
      VALUES ('delete', old.rowid, old.path, old.title, old.content, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
      INSERT INTO files_fts(files_fts, rowid, path, title, content, tags)
      VALUES ('delete', old.rowid, old.path, old.title, old.content, old.tags);
      INSERT INTO files_fts(rowid, path, title, content, tags)
      VALUES (new.rowid, new.path, new.title, new.content, new.tags);
    END;
  `)

  // Index existing files
  await indexVault(vault)
  log.info('Database initialized:', dbPath)
}

async function indexVault(dir: string): Promise<void> {
  if (!db) return

  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      await indexVault(fullPath)
    } else if (entry.name.endsWith('.md')) {
      await indexFile(fullPath)
    }
  }
}

async function indexFile(filePath: string): Promise<void> {
  if (!db) return

  try {
    const content = await readFile(filePath, 'utf-8')
    const stats = await stat(filePath)
    const relPath = filePath.replace(vaultPath + '/', '')
    const title = extractTitle(content)
    const hash = simpleHash(content)

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO files (path, title, content, modified_at, content_hash, folder)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const folder = relPath.includes('/')
      ? relPath.split('/').slice(0, -1).join('/')
      : ''

    stmt.run(relPath, title, content, stats.mtimeMs, hash, folder)
  } catch (err) {
    log.error('Index error:', err)
  }
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1] : ''
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}

export async function searchFiles(query: string): Promise<any[]> {
  if (!db) return []

  if (!query.trim()) {
    // Return all files
    const stmt = db.prepare(`
      SELECT path, title, modified_at, folder
      FROM files
      ORDER BY modified_at DESC
      LIMIT 100
    `)
    const rows = stmt.all() as any[]
    return rows.map(r => ({
      path: r.path,
      name: r.path.split('/').pop() || r.path,
      isDirectory: false,
      modified: r.modified_at
    }))
  }

  // FTS search
  const stmt = db.prepare(`
    SELECT f.path, f.title, f.modified_at, f.folder
    FROM files f
    JOIN files_fts fts ON f.rowid = fts.rowid
    WHERE files_fts MATCH ?
    ORDER BY rank
    LIMIT 50
  `)

  try {
    const rows = stmt.all(query + '*') as any[]
    return rows.map(r => ({
      path: r.path,
      name: r.path.split('/').pop() || r.path,
      isDirectory: false,
      modified: r.modified_at
    }))
  } catch {
    // If FTS fails, try LIKE search
    const likeStmt = db.prepare(`
      SELECT path, title, modified_at, folder
      FROM files
      WHERE content LIKE ? OR title LIKE ?
      LIMIT 50
    `)
    const likeRows = likeStmt.all(`%${query}%`, `%${query}%`) as any[]
    return likeRows.map(r => ({
      path: r.path,
      name: r.path.split('/').pop() || r.path,
      isDirectory: false,
      modified: r.modified_at
    }))
  }
}

export async function getFileContent(filePath: string): Promise<string> {
  const fullPath = filePath.startsWith(vaultPath) ? filePath : join(vaultPath, filePath)
  const content = await readFile(fullPath, 'utf-8')
  return content
}

export async function saveFile(filePath: string, content: string): Promise<boolean> {
  try {
    const fullPath = filePath.startsWith(vaultPath) ? filePath : join(vaultPath, filePath)
    await writeFile(fullPath, content, 'utf-8')

    // Re-index
    if (db) {
      const relPath = filePath.startsWith(vaultPath)
        ? filePath.replace(vaultPath + '/', '')
        : filePath
      const stats = await stat(fullPath)
      const title = extractTitle(content)
      const hash = simpleHash(content)
      const folder = relPath.includes('/')
        ? relPath.split('/').slice(0, -1).join('/')
        : ''

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO files (path, title, content, modified_at, content_hash, folder)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      stmt.run(relPath, title, content, stats.mtimeMs, hash, folder)
    }

    return true
  } catch (err) {
    log.error('Save error:', err)
    return false
  }
}

export async function createFolder(folderPath: string): Promise<boolean> {
  try {
    const fullPath = folderPath.startsWith(vaultPath) ? folderPath : join(vaultPath, folderPath)
    await mkdir(fullPath, { recursive: true })
    return true
  } catch (err) {
    log.error('Create folder error:', err)
    return false
  }
}

export async function listVaultFiles(): Promise<any[]> {
  if (!vaultPath) return []
  return scanDirectory(vaultPath)
}

async function scanDirectory(dir: string, basePath: string = ''): Promise<any[]> {
  const results: any[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const relPath = basePath ? `${basePath}/${entry.name}` : entry.name
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      const children = await scanDirectory(fullPath, relPath)
      results.push({
        path: relPath,
        name: entry.name,
        isDirectory: true,
        modified: 0,
        children
      })
    } else {
      const stats = await stat(fullPath)
      results.push({
        path: relPath,
        name: entry.name,
        isDirectory: false,
        modified: stats.mtimeMs
      })
    }
  }

  return results
}
