import Database from 'better-sqlite3'
import { join, dirname, basename } from 'path'
import { readdir, stat, readFile, writeFile, mkdir, rename as fsRename, unlink, rmdir } from 'fs/promises'
import log from 'electron-log/main'
import { parseFrontmatter } from './frontmatter'

let db: Database.Database | null = null
let vaultPath: string = ''

export interface FileRecord {
  path: string
  name: string
  isDirectory: boolean
  modified: number
  children?: FileRecord[]
  title?: string
  tags?: string
}

export async function initDatabase(vault: string): Promise<void> {
  vaultPath = vault
  const dbPath = join(vault, '.xiaoyuan', 'index.db')

  // Ensure .xiaoyuan directory exists
  await mkdir(join(vault, '.xiaoyuan'), { recursive: true })

  db = new Database(dbPath)

  // Enable WAL for better concurrency
  db.pragma('journal_mode = WAL')

  // FTS5 全文索引 (content_rowid references SQLite implicit rowid, not files.id)
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      path TEXT UNIQUE,
      name TEXT,
      title TEXT,
      content TEXT,
      tags TEXT,
      frontmatter TEXT,
      folder TEXT,
      modified_at INTEGER,
      content_hash TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
      path,
      name,
      title,
      content,
      tags,
      content='files',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
      INSERT INTO files_fts(rowid, path, name, title, content, tags)
      VALUES (new.rowid, new.path, new.name, new.title, new.content, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
      INSERT INTO files_fts(files_fts, rowid, path, name, title, content, tags)
      VALUES ('delete', old.rowid, old.path, old.name, old.title, old.content, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
      INSERT INTO files_fts(files_fts, rowid, path, name, title, content, tags)
      VALUES ('delete', old.rowid, old.path, old.name, old.title, old.content, old.tags);
      INSERT INTO files_fts(rowid, path, name, title, content, tags)
      VALUES (new.rowid, new.path, new.name, new.title, new.content, new.tags);
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
    const name = basename(relPath)
    const { frontmatter } = parseFrontmatter(content)
    const title = frontmatter.title || extractTitle(content) || name.replace(/\.md$/, '')
    const hash = simpleHash(content)

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO files (path, name, title, content, tags, frontmatter, modified_at, content_hash, folder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const folder = relPath.includes('/')
      ? relPath.split('/').slice(0, -1).join('/')
      : ''

    stmt.run(
      relPath,
      name,
      title,
      content,
      frontmatter.tags?.join(', ') || '',
      JSON.stringify(frontmatter),
      stats.mtimeMs,
      hash,
      folder
    )
  } catch (err) {
    log.error('Index error:', err)
  }
}

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : ''
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

export async function searchFiles(query: string): Promise<FileRecord[]> {
  if (!db) return []

  if (!query.trim()) {
    // Return all files
    const stmt = db.prepare(`
      SELECT path, name, title, tags, modified_at, folder
      FROM files
      ORDER BY modified_at DESC
      LIMIT 100
    `)
    return stmt.all().map(r => normalizeRecord(r))
  }

  // FTS search
  const stmt = db.prepare(`
    SELECT f.path, f.name, f.title, f.tags, f.modified_at, f.folder
    FROM files f
    JOIN files_fts fts ON f.rowid = fts.rowid
    WHERE files_fts MATCH ?
    ORDER BY rank
    LIMIT 50
  `)

  try {
    const rows = stmt.all(query + '*')
    return rows.map(r => normalizeRecord(r))
  } catch {
    // If FTS fails, try LIKE search
    const likeStmt = db.prepare(`
      SELECT path, name, title, tags, modified_at, folder
      FROM files
      WHERE content LIKE ? OR title LIKE ? OR tags LIKE ?
      LIMIT 50
    `)
    return likeStmt.all(`%${query}%`, `%${query}%`, `%${query}%`).map(r => normalizeRecord(r))
  }
}

function normalizeRecord(r: any): FileRecord {
  return {
    path: r.path,
    name: r.name || r.path.split('/').pop() || r.path,
    isDirectory: false,
    modified: r.modified_at,
    title: r.title || undefined,
    tags: r.tags || undefined
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
      const name = basename(relPath)
      const { frontmatter } = parseFrontmatter(content)
      const title = frontmatter.title || extractTitle(content) || name.replace(/\.md$/, '')
      const hash = simpleHash(content)
      const folder = relPath.includes('/')
        ? relPath.split('/').slice(0, -1).join('/')
        : ''

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO files (path, name, title, content, tags, frontmatter, modified_at, content_hash, folder)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(relPath, name, title, content, frontmatter.tags?.join(', ') || '', JSON.stringify(frontmatter), stats.mtimeMs, hash, folder)
    }

    return true
  } catch (err) {
    log.error('Save error:', err)
    return false
  }
}

export async function renameFile(oldPath: string, newName: string): Promise<boolean> {
  try {
    const oldFullPath = oldPath.startsWith(vaultPath) ? oldPath : join(vaultPath, oldPath)
    const parentDir = dirname(oldFullPath)
    const newFullPath = join(parentDir, newName)

    // Check if target already exists
    try {
      await stat(newFullPath)
      return false // Target exists, can't rename
    } catch {
      // OK, target doesn't exist
    }

    await fsRename(oldFullPath, newFullPath)

    // Update database
    if (db) {
      const oldRelPath = oldPath.startsWith(vaultPath) ? oldPath.replace(vaultPath + '/', '') : oldPath
      const newRelPath = join(dirname(oldRelPath), newName)

      const existing = db.prepare('SELECT * FROM files WHERE path = ?').get(oldRelPath) as any
      if (existing) {
        // Update file record
        db.prepare(`
          UPDATE files SET path = ?, name = ? WHERE path = ?
        `).run(newRelPath, newName, oldRelPath)

        // Also update FTS by re-indexing
        const content = await readFile(newFullPath, 'utf-8')
        const stats = await stat(newFullPath)
        const { frontmatter } = parseFrontmatter(content)
        const title = frontmatter.title || extractTitle(content) || newName.replace(/\.md$/, '')
        const hash = simpleHash(content)
        const folder = newRelPath.includes('/') ? newRelPath.split('/').slice(0, -1).join('/') : ''

        db.prepare(`
          UPDATE files SET content = ?, title = ?, tags = ?, frontmatter = ?, modified_at = ?, content_hash = ?, folder = ? WHERE path = ?
        `).run(content, title, frontmatter.tags?.join(', ') || '', JSON.stringify(frontmatter), stats.mtimeMs, hash, folder, newRelPath)
      }
    }

    return true
  } catch (err) {
    log.error('Rename error:', err)
    return false
  }
}

export async function moveFile(oldPath: string, newParentDir: string): Promise<boolean> {
  try {
    const oldFullPath = oldPath.startsWith(vaultPath) ? oldPath : join(vaultPath, oldPath)
    const newFullPath = join(vaultPath, newParentDir, basename(oldFullPath))

    // Check if source exists
    try { await stat(oldFullPath) } catch { return false }

    // Check if target already exists
    try { await stat(newFullPath); return false } catch { /* OK */ }

    // Ensure parent dir exists
    await mkdir(dirname(newFullPath), { recursive: true })

    await fsRename(oldFullPath, newFullPath)

    // Update database
    if (db) {
      const oldRelPath = oldPath.startsWith(vaultPath + '/') ? oldPath.slice(vaultPath.length + 1) : oldPath
      const newRelPath = join(newParentDir, basename(oldRelPath))

      const existing = db.prepare('SELECT * FROM files WHERE path = ?').get(oldRelPath) as any
      if (existing) {
        db.prepare('UPDATE files SET path = ?, folder = ? WHERE path = ?').run(newRelPath, newParentDir, oldRelPath)

        // Re-index content
        const content = await readFile(newFullPath, 'utf-8')
        const stats = await stat(newFullPath)
        const { frontmatter } = parseFrontmatter(content)
        const title = frontmatter.title || extractTitle(content) || basename(oldRelPath).replace(/\.md$/, '')
        const hash = simpleHash(content)
        db.prepare(`
          UPDATE files SET content = ?, title = ?, tags = ?, frontmatter = ?, modified_at = ?, content_hash = ? WHERE path = ?
        `).run(content, title, frontmatter.tags?.join(', ') || '', JSON.stringify(frontmatter), stats.mtimeMs, hash, newRelPath)
      }
    }
    return true
  } catch (err) {
    log.error('Move error:', err)
    return false
  }
}

export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const fullPath = filePath.startsWith(vaultPath) ? filePath : join(vaultPath, filePath)
    await unlink(fullPath)

    // Remove from database
    if (db) {
      const relPath = filePath.startsWith(vaultPath) ? filePath.replace(vaultPath + '/', '') : filePath
      db.prepare('DELETE FROM files WHERE path = ?').run(relPath)
    }

    return true
  } catch (err) {
    log.error('Delete error:', err)
    return false
  }
}

export async function deleteFolder(folderPath: string): Promise<boolean> {
  try {
    const fullPath = folderPath.startsWith(vaultPath) ? folderPath : join(vaultPath, folderPath)

    // Remove all files in this folder from DB first
    if (db) {
      const relPath = folderPath.startsWith(vaultPath) ? folderPath.replace(vaultPath + '/', '') : folderPath
      db.prepare('DELETE FROM files WHERE folder LIKE ?').run(`${relPath}%`)
    }

    // Remove the directory recursively from filesystem
    await fsDeleteRecursive(fullPath)
    return true
  } catch (err) {
    log.error('Delete folder error:', err)
    return false
  }
}

async function fsDeleteRecursive(dirPath: string): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      await fsDeleteRecursive(fullPath)
    } else {
      await unlink(fullPath)
    }
  }
  await rmdir(dirPath)
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

export async function listVaultFiles(): Promise<FileRecord[]> {
  if (!vaultPath) return []
  return scanDirectory(vaultPath)
}

async function scanDirectory(dir: string, basePath: string = ''): Promise<FileRecord[]> {
  const results: FileRecord[] = []
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
      // Check DB for metadata
      let title: string | undefined
      let tags: string | undefined
      if (db) {
        const record = db.prepare('SELECT title, tags FROM files WHERE path = ?').get(relPath) as any
        if (record) {
          title = record.title || undefined
          tags = record.tags || undefined
        }
      }
      results.push({
        path: relPath,
        name: entry.name,
        isDirectory: false,
        modified: stats.mtimeMs,
        title,
        tags
      })
    }
  }

  // Sort: folders first, then files alphabetically
  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return results
}

/**
 * Get the vault path
 */
export function getVaultPath(): string {
  return vaultPath
}
