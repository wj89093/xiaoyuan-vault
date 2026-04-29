import { useState, useEffect, useRef } from 'react'
import { Search, FileText, Folder, ArrowRight, X } from 'lucide-react'
import type { FileInfo } from '../types'

interface QuickSwitchProps {
  files: FileInfo[]
  onSelect: (path: string) => void
  onClose: () => void
}

export function QuickSwitch({ files, onSelect, onClose }: QuickSwitchProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Flatten file tree for searching
  const flatFiles: FileInfo[] = []
  const flatten = (items: FileInfo[], path = '') => {
    for (const item of items) {
      const fullPath = path ? `${path}/${item.name}` : item.name
      if (!item.isDirectory) {
        flatFiles.push({ ...item, path: item.path || fullPath })
      }
      if (item.children) flatten(item.children, item.path || fullPath)
    }
  }
  flatten(files)

  // Filter based on query (fuzzy match)
  const filtered = query.trim()
    ? flatFiles.filter(f => 
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.path?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
    : flatFiles.slice(0, 10)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex].path)
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#fef08a', fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    )
  }

  return (
    <div className="quick-switch-overlay" onClick={onClose}>
      <div className="quick-switch" onClick={e => e.stopPropagation()}>
        <div className="quick-switch-header">
          <Search size={16} />
          <input
            ref={inputRef}
            className="quick-switch-input"
            placeholder="搜索文件... (Enter 选中, ↑↓ 导航, Esc 关闭)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="quick-switch-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="quick-switch-results">
          {filtered.length === 0 ? (
            <div className="quick-switch-empty">未找到匹配文件</div>
          ) : (
            filtered.map((file, i) => (
              <div
                key={file.path}
                className={`quick-switch-item ${i === selectedIndex ? 'selected' : ''}`}
                onClick={() => onSelect(file.path)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <FileText size={14} />
                <div className="quick-switch-item-info">
                  <span className="quick-switch-item-name">{highlightMatch(file.name, query)}</span>
                  {file.path && (
                    <span className="quick-switch-item-path">{file.path}</span>
                  )}
                </div>
                <ArrowRight size={14} className="quick-switch-item-arrow" />
              </div>
            ))
          )}
        </div>
        <div className="quick-switch-footer">
          <span>↑↓ 导航</span>
          <span>Enter 选中</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
