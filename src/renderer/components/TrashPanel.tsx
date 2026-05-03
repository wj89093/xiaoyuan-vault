import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react'
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */

interface TrashItem {
  originalPath: string
  trashPath: string
  deletedAt: number
  name: string
}

interface TrashPanelProps {
  vaultPath: string | null
  onNavigate: (path: string) => void
  onClose: () => void
}

export function TrashPanel({ vaultPath, onNavigate, onClose }: TrashPanelProps): JSX.Element {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadTrash = useCallback(async () => {
    if (!vaultPath) return
    setLoading(true)
    try {
      const list = await window.api.trashList(vaultPath)
      setItems(list)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [vaultPath])

  useEffect(() => {
    const id = requestAnimationFrame(() => { void loadTrash() })
    return () => cancelAnimationFrame(id)
  }, [loadTrash])

  const handleRestore = async (item: TrashItem) => {
    if (!vaultPath) return
    await window.api.trashRestore(vaultPath, item.originalPath)
    await loadTrash()
  }

  const handlePermanentDelete = async (item: TrashItem) => {
    if (!vaultPath) return
    if (!confirm(`永久删除 "${item.name}"？此操作不可恢复。`)) return
    await window.api.trashDelete(vaultPath, item.originalPath)
    await loadTrash()
  }

  const handleEmpty = async () => {
    if (!vaultPath) return
    if (!confirm('清空回收站？所有文件将永久删除。')) return
    for (const item of items) {
      await window.api.trashDelete(vaultPath, item.originalPath)
    }
    await loadTrash()
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        <Trash2 size={14} />
        <span className="backlinks-title">回收站</span>
        <span className="backlinks-count">{items.length}</span>
        {items.length > 0 && (
          <button className="backlinks-close" onClick={() => { void handleEmpty() }} title="清空回收站" style={{ marginLeft: 4 }}>
            <AlertTriangle size={12} />
          </button>
        )}
        <button className="backlinks-close" onClick={onClose} title="关闭" style={{ marginLeft: 'auto' }}>
          <X size={14} />
        </button>
      </div>

      <div className="backlinks-content">
        {loading ? (
          <div className="backlinks-empty">加载中...</div>
        ) : items.length === 0 ? (
          <div className="backlinks-empty">回收站为空</div>
        ) : (
          <div className="backlinks-list">
            {items.map(item => (
              <div key={item.originalPath} className="backlinks-item">
                <div className="backlinks-item-name" onClick={() => { void onNavigate(item.originalPath) }}>
                  <Trash2 size={12} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 4 }}>
                    {formatDate(item.deletedAt)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '2px 8px', flex: 1 }}
                    onClick={() => { void handleRestore(item) }}
                  >
                    <RotateCcw size={11} /> 恢复
                  </button>
                  <button
                    className="btn"
                    style={{ fontSize: 11, padding: '2px 8px', color: '#ff3b30' }}
                    onClick={() => { void handlePermanentDelete(item) }}
                  >
                    <X size={11} /> 删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
