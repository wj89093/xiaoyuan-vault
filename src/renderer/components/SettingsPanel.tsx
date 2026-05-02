import { useState, useEffect } from 'react'
import { X, Cpu, LogIn, LogOut, User, CheckCircle } from 'lucide-react'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
  const [email, setEmail] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loginHint, setLoginHint] = useState<string>('')

  // 加载登录状态
  useEffect(() => {
    void (async () => {
      try {
        const [e, t] = await Promise.all([
          (window.api).authGetEmail?.(),
          (window.api).authGetToken?.(),
        ])
        setEmail(e)
        setToken(t)
      } catch {
        // ignore
      }
    })()

    // 监听 token 接收（OAuth 回调触发）
    const unsub = (window.api).onAuthTokenReceived?.((data: { token: string; email: string }) => {
      setToken(data.token)
      setEmail(data.email)
      setLoginHint('登录成功 ✅')
      setTimeout(() => setLoginHint(''), 3000)
    })

    return () => { unsub?.() }
  }, [])

  // 打开登录页
  const handleLogin = async () => {
    setLoading(true)
    try {
      await (window.api).authOpenLogin?.()
    } catch (err) {
      setLoginHint('打开发登录页失败：' + (err instanceof Error ? err.message : String(err)))
    }
    setLoading(false)
  }

  // 登出
  const handleLogout = async () => {
    await (window.api).authClear?.()
    setToken(null)
    setEmail(null)
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <span>设置</span>
          <button className="btn btn-icon" onClick={onClose} style={{ padding: 4 }}>
            <X size={16} />
          </button>
        </div>

        <div className="settings-body">
          {/* ─── 账户 ─────────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">
              <User size={14} />
              晓园账户
            </div>

            {token ? (
              <div className="settings-row">
                <div className="settings-row-label">
                  <span>已登录</span>
                  <span className="settings-row-desc" style={{ color: 'var(--color-accent)' }}>
                    {email ?? '账户'}
                  </span>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={() => { void handleLogout() }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                >
                  <LogOut size={12} />
                  退出
                </button>
              </div>
            ) : (
              <div className="settings-row">
                <div className="settings-row-label">
                  <span>未登录</span>
                  <span className="settings-row-desc">登录后可使用 AI 功能</span>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => { void handleLogin() }}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <LogIn size={13} />
                  {loading ? '打开中...' : '登录晓园'}
                </button>
              </div>
            )}

            {loginHint && (
              <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                {loginHint}
              </div>
            )}
          </div>

          {/* ─── AI 模型 ──────────────────── */}
          <div className="settings-section">
            <div className="settings-section-title">
              <Cpu size={14} />
              AI 模型
            </div>
            <div className="settings-row">
              <div className="settings-row-label">
                <span>当前模型</span>
                <span className="settings-row-desc">通过晓园账户调用 API</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} style={{ color: 'var(--color-accent)' }} />
                <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>DeepSeek V4 Flash</span>
              </div>
            </div>
          </div>

          {/* ─── 说明 ─────────────────────── */}
          {!token && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '8px 16px', lineHeight: 1.6 }}>
              点击「登录晓园」后，浏览器会打开晓园账户登录页面。
              登录成功后，AI 功能自动可用。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
