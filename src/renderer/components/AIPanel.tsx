import { Sparkles, Tag, FileText, PenTool } from 'lucide-react'
import { AIGenerating } from './AIGenerating'

interface AIPanelProps {
  aiResults: Record<string, string>
  onAI: (action: string) => void
  hasContent: boolean
  aiLoading?: string | null
}

const aiActions = [
  { key: 'classify', label: 'AI 分类', desc: '推荐文件夹', icon: Sparkles },
  { key: 'tags', label: 'AI 标签', desc: '提取关键词', icon: Tag },
  { key: 'summary', label: 'AI 摘要', desc: '生成摘要', icon: FileText },
  { key: 'write', label: 'AI 写作', desc: '大纲生成文档', icon: PenTool }
]

export function AIPanel({ aiResults, onAI, hasContent, aiLoading }: AIPanelProps): JSX.Element {
  return (
    <div className="ai-panel">
      <div className="ai-panel-header">AI 助手</div>
      <div className="ai-panel-content">
        <div className="ai-section">
          <div className="ai-section-title">功能</div>
          <div className="ai-actions">
            {aiActions.map(action => {
              const Icon = action.icon
              const isLoading = aiLoading === action.key
              return (
                <button
                  key={action.key}
                  className="btn"
                  onClick={() => onAI(action.key)}
                  disabled={!hasContent || !!aiLoading}
                  style={{ justifyContent: 'flex-start', gap: 'var(--space-3)' }}
                >
                  {isLoading ? (
                    <AIGenerating />
                  ) : (
                    <Icon size={16} style={{ color: 'var(--color-text-tertiary)' }} />
                  )}
                  <span>{action.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {action.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {Object.entries(aiResults).length > 0 && (
          <div className="ai-section">
            <div className="ai-section-title">结果</div>
            {Object.entries(aiResults).map(([key, value]) => {
              const action = aiActions.find(a => a.key === key)
              return (
                <div key={key} className="ai-result">
                  <div className="ai-result-title">{action?.label}</div>
                  <div className="ai-result-content">{value}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
