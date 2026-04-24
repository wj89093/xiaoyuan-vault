import { FileText } from 'lucide-react'
import type { FileInfo } from '../types'

interface SearchResultsProps {
  results: FileInfo[]
  query: string
  onSelect: (path: string) => void
  onClose: () => void
}

export function SearchResults({ results, query, onSelect, onClose }: SearchResultsProps): JSX.Element {
  if (!query.trim()) return <div />

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
            未找到 "{query}"
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
                <span className="search-results-name">{file.name}</span>
                <span className="search-results-path">{file.path}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
