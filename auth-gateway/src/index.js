require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const { initDB } = require('./db/init')
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/user')
const aiRoutes = require('./routes/ai')
const adminRoutes = require('./routes/admin')

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors({ origin: '*', credentials: true }))
app.use(express.json())

// 静态文件
app.use(express.static(path.join(__dirname, '../public')))

// 数据库初始化
const db = initDB()
app.locals.db = db

// 路由（直接挂载 Router，不需要调用）
app.use('/auth', authRoutes)
app.use('/user', userRoutes)
app.use('/ai', aiRoutes)
app.use('/admin', adminRoutes)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// 启动
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[晓园 Auth Gateway] http://0.0.0.0:${PORT}`)
})
