import { useState, useEffect } from 'react'
import { X, Cpu } from 'lucide-react'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps): JSX.Element {
  const [provider, setProvider] = useState('qwen')

  useEffect(() => {(async () => {
    try { const p = await (window.api as any).providerGet?.(); if (p) setProvider(p) } catch {}
  })()}, [])

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
                <span>默认模型</span>
                <span className="settings-row-desc">需要配置对应的 API Key</span>
              </div>
              <select className="select" value={provider} onChange={e => {
                setProvider(e.target.value)
                ;(window.api as any).providerSet?.(e.target.value)
              }} style={{ width: 180 }}>
                <option value="qwen">通义千问 (Qwen3.6)</option>
                <option value="minimax">MiniMax M2.7</option>
                <option value="deepseek">DeepSeek V4</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}