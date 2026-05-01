const express = require('express')
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')

const router = express.Router()

// 管理员登录（简单密码保护）
router.post('/login', (req, res) => {
  const { password } = req.body
  const adminPass = process.env.ADMIN_PASSWORD || 'xiaoyuan-admin-2026'

  if (password !== adminPass) {
    return res.status(401).json({ error: '密码错误' })
  }

  // 简化：直接返回 admin token
  res.json({
    token: 'admin-token-' + Buffer.from(password).toString('base64'),
    user: { id: 'admin', role: 'admin' }
  })
})

// 获取所有用户
router.get('/users', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer admin-token-${Buffer.from(process.env.ADMIN_PASSWORD || 'xiaoyuan-admin-2026').toString('base64')}`) {
    return res.status(401).json({ error: '未授权' })
  }

  const db = req.app.locals.db
  const users = db.prepare(`
    SELECT u.id, u.email, u.plan, u.created_at,
           q.daily_limit, q.daily_used, q.total_calls, q.last_call_at
    FROM users u LEFT JOIN quotas q ON u.id = q.user_id
    ORDER BY u.created_at DESC
  `).all()

  res.json({ users, total: users.length })
})

// 开通/调整用户套餐
router.post('/alloc', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer admin-token-${Buffer.from(process.env.ADMIN_PASSWORD || 'xiaoyuan-admin-2026').toString('base64')}`) {
    return res.status(401).json({ error: '未授权' })
  }

  const { email, plan, daily_limit } = req.body
  const db = req.app.locals.db

  if (email) {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (user && plan) {
      db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, user.id)
    }
    if (user && daily_limit) {
      db.prepare('UPDATE quotas SET daily_limit = ? WHERE user_id = ?').run(daily_limit, user.id)
    }
    res.json({ ok: true })
  } else {
    res.status(400).json({ error: '缺少邮箱' })
  }
})

module.exports = router
