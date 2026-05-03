import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ExternalLink, X } from 'lucide-react'

interface BacklinkFile {
  path: string
  name: string
}

interface BacklinksPanelProps {
  selectedFile: string | null
  onNavigate: (path: string) => void
  onClose: () => void
}

export function BacklinksPanel({ selectedFile, onNavigate, onClose }: BacklinksPanelProps): JSX.Element {
  const [backlinks, setBacklinks] = useState<BacklinkFile[]>([])
  const [loading, setLoading] = useState(false)

  const currentName = selectedFile?.split('/').pop()?.replace(/\.md$/, '') ?? ''

  const loadBacklinks = useCallback(async () => {
    if (!selectedFile || !currentName) return
    setLoading(true)
    setBacklinks([])

    try {
      const searchPattern = `[[${currentName}]]`
      void searchPattern // hint for lint
      const results = await window.api.searchFiles(searchPattern)
      const filtered = results
        .filter((f: { path: string }) => f.path !== selectedFile)
        .slice(0, 20)
        .map((f: { path: string; name: string }) => ({ path: f.path, name: f.name }))
      setBacklinks(filtered)
    } catch {
      setBacklinks([])
    } finally {
      setLoading(false)
    }
  }, [selectedFile, currentName])

  useEffect(() => {
    const id = requestAnimationFrame(() => { void loadBacklinks() })
    return () => cancelAnimationFrame(id)
  }, [loadBacklinks])

  if (!selectedFile) return <div className="backlinks-panel" />

  return (
    <div className="backlinks-panel">
      <div className="backlinks-header">
        <ArrowLeft size={14} />
        <span className="backlinks-title">反向链接</span>
        <span className="backlinks-count">{backlinks.length}</span>
        <button className="backlinks-close" onClick={onClose} title="关闭">
          <X size={14} />
        </button>
      </div>

      <div className="backlinks-content">
        {loading ? (
          <div className="backlinks-empty">加载中...</div>
        ) : backlinks.length === 0 ? (
          <div className="backlinks-empty">
            无反向链接
            <div className="backlinks-hint">
              在其他文档中使用 <code>[[{currentName}]]</code> 引用本文档
            </div>
          </div>
        ) : (
          <div className="backlinks-list">
            {backlinks.map(file => (
              <div
                key={file.path}
                className="backlinks-item"
                onClick={() => onNavigate(file.path)}
              >
                <div className="backlinks-item-name">
                  <ExternalLink size={12} />
                  {file.name}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
