import { useState, useEffect } from 'react'
import { FileText, RefreshCw, X, CheckCircle, AlertCircle } from 'lucide-react'
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */

interface BriefingReport {
  date: string
  period: string
  newPages: number
  updatedPages: number
  entities: string[]
  highlights: string[]
  health: string
  raw: string
}

interface BriefingPanelProps {
  onClose: () => void
}

export function BriefingPanel({ onClose }: BriefingPanelProps): JSX.Element {
  const [report, setReport] = useState<BriefingReport | null>(null)
  const [loading, setLoading] = useState(true)

  const loadBriefing = async () => {
    setLoading(true)
    try {
      const result = await window.api.generateBriefing()
      setReport(result)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBriefing()
  }, [])

  const isHealthy = report?.health && !report.health.includes('失败') && !report.health.includes('异常')

  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        <FileText size={14} />
        <span className="backlinks-title">本周变化</span>
        <button
          className="backlinks-close"
          onClick={() => { void loadBriefing() }}
          title="刷新"
          style={{ marginLeft: 4 }}
        >
          <RefreshCw size={12} />
        </button>
        <button className="backlinks-close" onClick={onClose} title="关闭" style={{ marginLeft: 'auto' }}>
          <X size={14} />
        </button>
      </div>

      <div className="backlinks-content">
        {loading ? (
          <div className="backlinks-empty">AI 汇总中...</div>
        ) : !report ? (
          <div className="backlinks-empty">无法生成简报</div>
        ) : (
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Period header */}
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
              {report.period || report.date}
            </div>

            {/* Health badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isHealthy ? (
                <CheckCircle size={13} style={{ color: 'var(--color-success, #34c759)' }} />
              ) : (
                <AlertCircle size={13} style={{ color: 'var(--color-warning, #ff9500)' }} />
              )}
              <span style={{ fontSize: 12, fontWeight: 500 }}>{report.health}</span>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{report.newPages}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>新增页面</div>
              </div>
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{report.updatedPages}</div>
                <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>更新页面</div>
              </div>
            </div>

            {/* Raw summary */}
            {report.raw && (
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5, padding: '8px 10px', background: 'var(--color-bg-secondary)', borderRadius: 6 }}>
                {report.raw}
              </div>
            )}

            {/* Highlights */}
            {report.highlights && report.highlights.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-tertiary)' }}>要点</div>
                {report.highlights.map((h, i) => (
                  <div key={i} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 4, display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Entities */}
            {report.entities && report.entities.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-tertiary)' }}>涉及实体</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {report.entities.map((e, i) => (
                    <span key={i} style={{ fontSize: 11, background: 'var(--color-bg-secondary)', padding: '2px 8px', borderRadius: 10 }}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
