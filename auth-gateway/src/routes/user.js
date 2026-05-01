const express = require('express')
const { authMiddleware } = require('./auth')

const router = express.Router()

// 获取用户额度信息
router.get('/quota', authMiddleware, (req, res) => {
  const db = req.app.locals.db
  const quota = db.prepare('SELECT * FROM quotas WHERE user_id = ?').get(req.userId)
  const now = Math.floor(Date.now() / 1000)
  const dayStart = Math.floor(now / 86400) * 86400

  // 每日重置
  if (quota && quota.daily_reset < dayStart) {
    db.prepare('UPDATE quotas SET daily_used = 0, daily_reset = ? WHERE user_id = ?').run(dayStart, req.userId)
    quota.daily_used = 0
    quota.daily_reset = dayStart
  }

  res.json({
    remaining: Math.max(0, quota.daily_limit - quota.daily_used),
    limit: quota.daily_limit,
    used: quota.daily_used,
    plan: db.prepare('SELECT plan FROM users WHERE id = ?').get(req.userId)?.plan || 'free'
  })
})

// 升级套餐
router.post('/upgrade', authMiddleware, (req, res) => {
  const { plan } = req.body // free / pro / enterprise
  const planLimits = {
    free: 10,
    pro: 200,
    enterprise: 999999
  }

  if (!planLimits[plan]) {
    return res.status(400).json({ error: '无效的套餐' })
  }

  const db = req.app.locals.db
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.userId)
  db.prepare('UPDATE quotas SET daily_limit = ? WHERE user_id = ?').run(planLimits[plan], req.userId)

  res.json({ ok: true, plan, limit: planLimits[plan] })
})

module.exports = router
