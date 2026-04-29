import { FileText } from 'lucide-react'
import React from 'react'
import type { FileInfo } from '../types'

interface SearchResultsProps {
  results: FileInfo[]
  query: string
  onSelect: (path: string) => void
  onClose: () => void
}

export function SearchResults({ results, query, onSelect, onClose }: SearchResultsProps): JSX.Element {
  if (!query.trim()) return <div />

  const highlight = (text: string, q: string) => {
    if (!q.trim()) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    )
  }

  return (
    <div className="search-results">
      <div className="search-results-header">
        <span className="search-results-count">{results.length} 个结果</span>
        <button className="btn btn-icon" onClick={onClose} title="关闭">
          <span style={{ fontSize: 16, lineHeight: 1 }}>×</span>
        </button>
      </div>
      <div className="search-results-list">
        {results.length === 0 ? (
          <div className="search-results-empty">
            <p>未找到 &quot;{query}&quot;</p>
            <p className="search-results-empty-hint">试试其他关键词，或检查拼写</p>
          </div>
        ) : (
          results.map(file => (
            <div
              key={file.path}
              className="search-results-item"
              onClick={() => onSelect(file.path)}
            >
              <FileText size={14} className="search-results-icon" />
              <div className="search-results-info">
                <span className="search-results-name">{highlight(file.name, query)}</span>
                <span className="search-results-path">{highlight(file.path, query)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
