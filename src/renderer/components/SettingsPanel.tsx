import { X, Cpu } from 'lucide-react'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
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
          <div className="settings-section">
            <div className="settings-section-title">
              <Cpu size={14} />
              AI 模型
            </div>
            <div className="settings-row">
              <div className="settings-row-label">
                <span>当前模型</span>
                <span className="settings-row-desc">API Key 在 .env 文件中配置</span>
              </div>
              <span style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
                DeepSeek V4 Flash
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
