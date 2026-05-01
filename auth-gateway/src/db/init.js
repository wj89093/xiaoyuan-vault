const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

function initDB() {
  const dbPath = path.join(__dirname, '../../data/xiaoyuan-auth.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      feishu_openid TEXT UNIQUE,
      wechat_openid TEXT UNIQUE,
      plan TEXT DEFAULT 'free',
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `)

  // 额度表
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotas (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      daily_limit INTEGER DEFAULT 10,
      daily_used INTEGER DEFAULT 0,
      daily_reset INTEGER DEFAULT (strftime('%s', 'now')),
      total_calls INTEGER DEFAULT 0,
      last_call_at INTEGER
    )
  `)

  // 邮箱验证码
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT,
      code TEXT,
      expires_at INTEGER,
      used INTEGER DEFAULT 0
    )
  `)

  // 登录日志
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      method TEXT,
      ip TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `)

  // 管理员
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      password_hash TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `)

  // 支付记录
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      amount REAL,
      plan TEXT,
      method TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `)

  // 索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_email_codes_email ON email_codes(email)
  `)

  console.log('[DB] 数据库初始化完成:', dbPath)
  return db
}

module.exports = { initDB }
