const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const nodemailer = require('nodemailer')
const fetch = require('node-fetch')

const router = express.Router()

// JWT 密钥（生产环境从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || 'xiaoyuan-secret-key-change-me'
const JWT_EXPIRES = '30d'

// 邮件发送配置（可配置）
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.qq.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  }
})

// 中间件：验证 JWT
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' })
  }
  const token = auth.slice(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.userId = decoded.userId
    next()
  } catch {
    res.status(401).json({ error: 'Token 无效' })
  }
}

// ==================== 邮箱验证码登录 ====================

// 登录页面（用于桌面 App OAuth 回调）
router.get('/email/login', (req, res) => {
  const redirectUri = req.query.redirect_uri || 'xiaoyuan://auth/callback'
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>晓园登录</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f7; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: white; border-radius: 16px; padding: 40px; width: 360px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  h1 { font-size: 22px; margin-bottom: 8px; color: #1d1d1f; }
  p { color: #86868b; font-size: 14px; margin-bottom: 28px; }
  label { display: block; font-size: 13px; color: #1d1d1f; margin-bottom: 6px; font-weight: 500; }
  input { width: 100%; padding: 12px 14px; border: 1.5px solid #d2d2d7; border-radius: 8px; font-size: 15px; outline: none; transition: border-color 0.2s; margin-bottom: 4px; }
  input:focus { border-color: #0071e3; }
  .code-row { display: flex; gap: 8px; margin-bottom: 20px; }
  .code-row input { flex: 1; }
  button { width: 100%; padding: 13px; background: #0071e3; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
  button:hover { background: #0077ed; }
  button:disabled { background: #a8a8a8; cursor: not-allowed; }
  .error { color: #ff3b30; font-size: 13px; margin-bottom: 12px; min-height: 18px; }
  .hint { font-size: 12px; color: #86868b; margin-top: 16px; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <h1>登录晓园</h1>
  <p>使用邮箱验证码登录</p>
  <div class="error" id="err"></div>
  <form id="form">
    <label>邮箱</label>
    <div class="code-row">
      <input type="email" id="email" placeholder="your@email.com" required />
      <button type="button" id="sendBtn" onclick="sendCode()">发送</button>
    </div>
    <label>验证码</label>
    <input type="text" id="code" placeholder="请输入6位验证码" maxlength="6" required />
    <button type="submit" id="loginBtn">登录</button>
  </form>
  <div class="hint" id="hint"></div>
</div>
<script>
let email = '';
function el(id) { return document.getElementById(id) }

async function sendCode() {
  const e = el('email').value.trim();
  if (!e) { el('err').textContent = '请输入邮箱'; return; }
  email = e;
  el('sendBtn').disabled = true;
  el('hint').textContent = '发送中...';
  try {
    const r = await fetch('/auth/email/send', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email: e })
    });
    const d = await r.json();
    if (!r.ok) { el('err').textContent = d.error || '发送失败'; el('sendBtn').disabled = false; el('hint').textContent = ''; return; }
    el('hint').textContent = '验证码已发送 ✅';
    el('sendBtn').textContent = '已发送';
    let s = 60;
    const t = setInterval(() => { el('sendBtn').textContent = (--s) + 's'; if (s <= 0) { clearInterval(t); el('sendBtn').disabled = false; el('sendBtn').textContent = '重发'; el('hint').textContent = ''; }}, 1000);
  } catch(e) { el('err').textContent = '网络错误'; el('sendBtn').disabled = false; el('hint').textContent = ''; }
}

document.getElementById('form').onsubmit = async (e) => {
  e.preventDefault();
  const code = el('code').value.trim();
  if (!code || code.length !== 6) { el('err').textContent = '请输入6位验证码'; return; }
  el('loginBtn').disabled = true; el('loginBtn').textContent = '登录中...';
  try {
    const r = await fetch('/auth/email/verify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email, code })
    });
    const d = await r.json();
    if (!r.ok) { el('err').textContent = d.error || '验证失败'; el('loginBtn').disabled = false; el('loginBtn').textContent = '登录'; return; }
    // 登录成功，重定向到 App
    const params = new URLSearchParams({ token: d.token });
    if (d.user?.email) params.set('email', d.user.email);
    window.location.href = '${redirectUri}?' + params.toString();
  } catch(e) { el('err').textContent = '网络错误'; el('loginBtn').disabled = false; el('loginBtn').textContent = '登录'; }
};
</script>
</body>
</html>`)
})

// 发送验证码
router.post('/email/send', async (req, res) => {
  const { email } = req.body
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: '无效的邮箱' })
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expires_at = Math.floor(Date.now() / 1000) + 600 // 10分钟

  const db = req.app.locals.db
  db.prepare('INSERT INTO email_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email, code, expires_at)

  // 发送邮件
  try {
    await mailer.sendMail({
      from: `"晓园" <${process.env.SMTP_USER || 'noreply@xiaoyuan.app'}>`,
      to: email,
      subject: '晓园验证码',
      text: `你的验证码是：${code}，10分钟内有效。`
    })
    res.json({ ok: true, message: '验证码已发送' })
  } catch (err) {
    console.error('[邮件发送失败]', err.message)
    res.status(500).json({ error: '邮件发送失败: ' + err.message })
  }
})

// 验证验证码并登录/注册
router.post('/email/verify', async (req, res) => {
  const { email, code } = req.body
  if (!email || !code) {
    return res.status(400).json({ error: '缺少参数' })
  }

  const db = req.app.locals.db
  const now = Math.floor(Date.now() / 1000)

  // 查找验证码记录
  const record = db.prepare(
    'SELECT * FROM email_codes WHERE email = ? AND code = ? AND expires_at > ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ).get(email, code, now)

  if (!record) {
    return res.status(400).json({ error: '验证码无效或已过期' })
  }

  // 标记为已使用
  db.prepare('UPDATE email_codes SET used = 1 WHERE id = ?').run(record.id)

  // 查找或创建用户
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) {
    const userId = uuidv4()
    db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run(userId, email)
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)

    // 初始化免费额度
    db.prepare('INSERT INTO quotas (user_id, daily_limit, daily_used, daily_reset) VALUES (?, 10, 0, ?)').run(userId, now)
  }

  // 记录登录
  db.prepare('INSERT INTO login_logs (user_id, method, ip) VALUES (?, ?, ?)').run(
    user.id, 'email', req.ip
  )

  // 生成 JWT
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES })

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan
    }
  })
})

// ==================== 账号密码登录/注册 ====================

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: '缺少参数' })
  }

  const db = req.app.locals.db
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND password_hash IS NOT NULL').get(email)
  if (!user) {
    return res.status(401).json({ error: '账号不存在' })
  }

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: '密码错误' })
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
  db.prepare('INSERT INTO login_logs (user_id, method, ip) VALUES (?, ?, ?)').run(user.id, 'password', req.ip)

  res.json({ token, user: { id: user.id, email: user.email, plan: user.plan } })
})

router.post('/register', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: '缺少参数' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6位' })
  }

  const db = req.app.locals.db
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (existing) {
    return res.status(400).json({ error: '该邮箱已注册' })
  }

  const userId = uuidv4()
  const hash = bcrypt.hashSync(password, 10)
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, email, hash)
  db.prepare('INSERT INTO quotas (user_id, daily_limit, daily_used, daily_reset) VALUES (?, 10, 0, ?)').run(userId, Math.floor(Date.now() / 1000))

  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES })

  res.json({ token, user: { id: userId, email, plan: 'free' } })
})

// ==================== 飞书 OAuth ====================

const FEISHU_APP_ID = process.env.FEISHU_APP_ID || ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET || ''
const FEISHU_REDIRECT_URI = process.env.FEISHU_REDIRECT_URI || 'http://localhost:3000/auth/feishu/callback'

router.get('/feishu', (req, res) => {
  const url = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${FEISHU_APP_ID}&redirect_uri=${encodeURIComponent(FEISHU_REDIRECT_URI)}&state=${uuidv4()}`
  res.redirect(url)
})

router.get('/feishu/callback', async (req, res) => {
  const { code, state } = req.query
  if (!code) {
    return res.status(400).json({ error: '缺少授权码' })
  }

  // 用 code 换 token
  const tokenRes = await fetch('https://open.feishu.cn/open-apis/authen/v1/oidc/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    })
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.data?.open_id) {
    return res.status(400).json({ error: '飞书授权失败', detail: tokenData })
  }

  const openid = tokenData.data.open_id
  const db = req.app.locals.db

  // 查找或创建用户
  let user = db.prepare('SELECT * FROM users WHERE feishu_openid = ?').get(openid)
  if (!user) {
    const userId = uuidv4()
    db.prepare('INSERT INTO users (id, feishu_openid) VALUES (?, ?)').run(userId, openid)
    db.prepare('INSERT INTO quotas (user_id, daily_limit, daily_used, daily_reset) VALUES (?, 10, 0, ?)').run(userId, Math.floor(Date.now() / 1000))
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES })
  db.prepare('INSERT INTO login_logs (user_id, method, ip) VALUES (?, ?, ?)').run(user.id, 'feishu', req.ip)

  // 返回 token 到前端（简单重定向带 token）
  const redirectUrl = `http://localhost:5173/#/login?token=${token}&user_id=${user.id}&plan=${user.plan}`
  res.redirect(redirectUrl)
})

// ==================== 获取当前用户 ====================

router.get('/me', authMiddleware, (req, res) => {
  const db = req.app.locals.db
  const user = db.prepare('SELECT id, email, plan, created_at FROM users WHERE id = ?').get(req.userId)
  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }
  const quota = db.prepare('SELECT * FROM quotas WHERE user_id = ?').get(req.userId)

  // 检查是否需要重置每日额度
  const now = Math.floor(Date.now() / 1000)
  const dayStart = Math.floor(now / 86400) * 86400
  if (quota && quota.daily_reset < dayStart) {
    db.prepare('UPDATE quotas SET daily_used = 0, daily_reset = ? WHERE user_id = ?').run(dayStart, req.userId)
    quota.daily_used = 0
  }

  res.json({ user, quota })
})

module.exports = router
module.exports.authMiddleware = authMiddleware
