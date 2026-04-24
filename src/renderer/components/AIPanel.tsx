interface AIPanelProps {
  aiResults: Record<string, string>
  onAI: (action: string) => void
  hasContent: boolean
}

const aiActions = [
  { key: 'classify', label: 'AI 分类', desc: '推荐文件夹' },
  { key: 'tags', label: 'AI 标签', desc: '提取关键词' },
  { key: 'summary', label: 'AI 摘要', desc: '生成摘要' },
  { key: 'write', label: 'AI 写作', desc: '大纲生成文档' }
]

export function AIPanel({ aiResults, onAI, hasContent }: AIPanelProps): JSX.Element {
  return (
    <div className="ai-panel">
      <div className="ai-panel-header">🤖 AI 助手</div>
      <div className="ai-panel-content">
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            选择 AI 功能，分析当前文档内容
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aiActions.map(action => (
              <button
                key={action.key}
                className={`toolbar-btn ${hasContent ? 'primary' : ''}`}
                onClick={() => onAI(action.key)}
                disabled={!hasContent}
                style={{ textAlign: 'left' }}
              >
                <div style={{ fontWeight: 600 }}>{action.label}</div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>{action.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {Object.entries(aiResults).map(([key, value]) => (
          <div key={key} className="ai-result">
            <div className="ai-result-label">
              {aiActions.find(a => a.key === key)?.label}
            </div>
            <div className="ai-result-content">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
