import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, error: err.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', padding: 32, gap: 12,
          background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}>⚠</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>出错了</div>
          <div style={{ fontSize: 13, maxWidth: 400, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
            {this.state.error || '未知错误'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '8px 20px', borderRadius: 8,
              background: '#007aff', color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 500,
            }}
          >
            重新加载
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
