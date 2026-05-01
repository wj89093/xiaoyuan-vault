const express = require('express')
const fetch = require('node-fetch')
const { authMiddleware } = require('./auth')

const router = express.Router()

// DeepSeek V4 Flash（默认，便宜 ¥1/M）
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

// Qwen 备用（如果 DEEPSEEK_API_KEY 未配置）
const QWEN_API_KEY = process.env.QWEN_API_KEY || ''
const QWEN_MODEL = process.env.QWEN_MODEL || 'qwen3.6-flash'

function getAPIConfig() {
  if (DEEPSEEK_API_KEY) {
    return { key: DEEPSEEK_API_KEY, url: DEEPSEEK_API_URL, model: DEEPSEEK_MODEL, name: 'DeepSeek' }
  }
  return { key: QWEN_API_KEY, url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: QWEN_MODEL, name: 'Qwen' }
}

// AI 查询（需鉴权+扣额度）
router.post('/query', authMiddleware, async (req, res) => {
  const { question, context, max_tokens } = req.body
  if (!question) {
    return res.status(400).json({ error: '缺少问题' })
  }

  const db = req.app.locals.db
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  const quota = db.prepare('SELECT * FROM quotas WHERE user_id = ?').get(req.userId)
  const config = getAPIConfig()

  // 无可用 API key
  if (!config.key) {
    return res.status(503).json({ error: 'AI 服务未配置，请联系管理员' })
  }

  const now = Math.floor(Date.now() / 1000)
  const dayStart = Math.floor(now / 86400) * 86400

  // 每日重置
  if (quota.daily_reset < dayStart) {
    db.prepare('UPDATE quotas SET daily_used = 0, daily_reset = ? WHERE user_id = ?').run(dayStart, req.userId)
    quota.daily_used = 0
  }

  // 检查额度
  if (quota.daily_used >= quota.daily_limit) {
    return res.status(403).json({
      error: '今日额度已用完',
      plan: user.plan,
      limit: quota.daily_limit,
      remaining: 0
    })
  }

  // 扣额度
  db.prepare('UPDATE quotas SET daily_used = daily_used + 1, total_calls = total_calls + 1, last_call_at = ? WHERE user_id = ?').run(now, req.userId)

  // 调用 AI
  try {
    const contextText = Array.isArray(context) ? context.join('\n\n') : (context || '')
    const prompt = contextText ? `${contextText}\n\n---\n\n${question}` : question

    const aiRes = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: max_tokens || 2000,
      })
    })

    if (!aiRes.ok) {
      const errText = await aiRes.text()
      console.error(`[AI] ${config.name} 调用失败`, aiRes.status, errText.slice(0, 200))
      return res.status(502).json({ error: 'AI 服务异常', detail: errText.slice(0, 100) })
    }

    const aiData = await aiRes.json()
    const answer = aiData.choices?.[0]?.message?.content || ''

    // 估算 token 用量（粗略：输入 ~ prompt长度/2，输出 ~ answer长度/2）
    const inputTokens = Math.ceil(prompt.length / 2)
    const outputTokens = Math.ceil(answer.length / 2)
    const totalTokens = inputTokens + outputTokens

    // 记录用量
    db.prepare('UPDATE quotas SET total_tokens = total_tokens + ? WHERE user_id = ?').run(totalTokens, req.userId)

    res.json({
      answer,
      used: quota.daily_used + 1,
      limit: quota.daily_limit,
      model: config.model,
      tokens: totalTokens,
    })
  } catch (err) {
    console.error('[AI] 调用异常', err.message)
    res.status(500).json({ error: err.message })
  }
})

// AI 状态检查（不扣额度）
router.get('/status', (req, res) => {
  const config = getAPIConfig()
  res.json({
    model: config.model,
    provider: config.name,
    apiConfigured: !!config.key,
  })
})

module.exports = router
