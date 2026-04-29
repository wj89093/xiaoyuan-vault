import { useState, useEffect } from 'react'
import { X, Clock, Sparkles, Tag, FileText, Cpu } from 'lucide-react'

interface SettingsPanelProps {
  onClose: () => void
  autoAI: {
    enabled: boolean
    interval: number // minutes
    onClassify: boolean
    onTags: boolean
    onSummary: boolean
  }
  onUpdate: (settings: SettingsPanelProps['autoAI']) => void
}

const INTERVAL_OPTIONS = [
  { label: '每 30 分钟', value: 30 },
  { label: '每 1 小时', value: 60 },
  { label: '每 2 小时', value: 120 },
  { label: '每 6 小时', value: 360 }
]

const aiTasks = [
  { key: 'onClassify', label: 'AI 分类', desc: '自动推荐文件夹', icon: Sparkles },
  { key: 'onTags', label: 'AI 标签', desc: '提取关键词标签', icon: Tag },
  { key: 'onSummary', label: 'AI 摘要', desc: '生成内容摘要', icon: FileText }
] as const

export function SettingsPanel({ onClose, autoAI, onUpdate }: SettingsPanelProps): JSX.Element {
  const [settings, setSettings] = useState(autoAI)
  const [provider, setProvider] = useState('qwen')

  useEffect(() => {(async () => {
    try { const p = await (window.api as any).providerGet?.(); if (p) setProvider(p) } catch {}
  })()}, [])

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    onUpdate(next)
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
          {/* AI 自动任务 */}
          <div className="settings-section">
            <div className="settings-section-title">
              <Clock size={14} />
              AI 自动任务
            </div>

            <div className="settings-row">
              <div className="settings-row-label">
                <span>开启定时执行</span>
                <span className="settings-row-desc">自动对打开的文件执行 AI 任务</span>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={e => update({ enabled: e.target.checked })}
                />
                <span className="toggle-track" />
              </label>
            </div>

            {settings.enabled && (
              <>
                <div className="settings-row">
                  <div className="settings-row-label">
                    <span>执行频率</span>
                  </div>
                  <select
                    className="select"
                    value={settings.interval}
                    onChange={e => update({ interval: Number(e.target.value) })}
                    style={{ width: 140 }}
                  >
                    {INTERVAL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="settings-divider" />

                <div className="settings-row-label" style={{ padding: '4px 0' }}>
                  <span className="settings-row-desc">选择要自动执行的任务</span>
                </div>

                {aiTasks.map(task => (
                  <div key={task.key} className="settings-row">
                    <div className="settings-task-info">
                      <task.icon size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                      <div>
                        <div style={{ fontSize: 'var(--text-sm)' }}>{task.label}</div>
                        <div className="settings-row-desc">{task.desc}</div>
                      </div>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={settings[task.key]}
                        onChange={e => update({ [task.key]: e.target.checked })}
                      />
                      <span className="toggle-track" />
                    </label>
                  </div>
                ))}
              </>
            )}
          </div>

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
