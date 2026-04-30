import { X } from 'lucide-react'

interface ShortcutGuideProps {
  onClose: () => void
}

const SHORTCUTS = [
  { keys: 'Ctrl+P', desc: '快速切换文件' },
  { keys: 'Ctrl+F', desc: '搜索文件' },
  { keys: 'Ctrl+D', desc: '深色/亮色模式' },
  { keys: 'Ctrl+E', desc: '阅读/编辑模式' },
  { keys: 'Ctrl+B', desc: '粗体' },
  { keys: 'Ctrl+I', desc: '斜体' },
  { keys: 'Ctrl+K', desc: '链接' },
  { keys: 'Ctrl+S', desc: '保存文件' },
  { keys: 'Ctrl+Enter', desc: '发送消息' },
  { keys: 'Cmd+Shift+O', desc: '全局：显示窗口' },
  { keys: 'Cmd+Shift+F', desc: '全局：搜索' },
]

export function ShortcutGuide({ onClose }: ShortcutGuideProps): JSX.Element {
  return (
    <div className="quick-switch-overlay" onClick={onClose}>
      <div className="quick-switch" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
        <div className="quick-switch-header">
          <span style={{ fontWeight: 600, fontSize: 14 }}>快捷键</span>
          <span style={{ fontSize: 11, color: '#a1a1a6', flex: 1, textAlign: 'right' }}>macOS: Cmd = Ctrl</span>
          <button className="quick-switch-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: '8px 0', maxHeight: 400, overflowY: 'auto' }}>
          {SHORTCUTS.map((s, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 20px', fontSize: 13,
              borderBottom: i < SHORTCUTS.length - 1 ? '1px solid #f0f0f2' : 'none'
            }}>
              <span style={{ color: '#1d1d1f' }}>{s.desc}</span>
              <kbd style={{
                background: '#f0f0f2', padding: '2px 8px', borderRadius: 4,
                fontSize: 12, color: '#6e6e73', fontFamily: 'SF Mono, monospace',
              }}>{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
