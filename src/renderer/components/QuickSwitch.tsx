import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, FileText, Clock, ArrowRight, X, Hash } from 'lucide-react'
import type { FileInfo } from '../types'

interface QuickSwitchProps {
  files: FileInfo[]
  recentFiles: Array<{ path: string; name: string }>
  onSelect: (path: string) => void
  onClose: () => void
}

interface FlatFile {
  name: string
  path: string
  isDirectory: boolean
}

function flattenFiles(items: FileInfo[], path = ''): FlatFile[] {
  const result: FlatFile[] = []
  for (const item of items) {
    const fullPath = path ? `${path}/${item.name}` : item.name
    if (!item.isDirectory) {
      result.push({ name: item.name, path: item.path || fullPath, isDirectory: false })
    }
    if (item.children) {
      result.push(...flattenFiles(item.children, item.path || fullPath))
    }
  }
  return result
}

export function QuickSwitch({ files, recentFiles, onSelect, onClose }: QuickSwitchProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [snippetMap, setSnippetMap] = useState<Record<string, string>>({})
  const [loadingSnippets, setLoadingSnippets] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const flatFiles = useMemo(() => flattenFiles(files), [files])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Load snippets for search results (first 5)
  useEffect(() => {
    if (!query.trim()) {
      setSnippetMap({})
      return
    }
    const results = flatFiles
      .filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)

    const needed = results.filter(r => !snippetMap[r.path] && !loadingSnippets.has(r.path))
    if (needed.length === 0) return

    setLoadingSnippets(prev => new Set([...prev, ...needed.map(r => r.path)]))

    // Load first 3 snippets concurrently
    Promise.all(
      needed.slice(0, 3).map(async (file) => {
        try {
          const content = await (window.api as any).readFile?.(file.path) ?? ''
          const lines = content.split('\n')
          // Find first non-frontmatter, non-empty line as snippet
          const snippet = lines.find(l => l.trim() && !l.trim().startsWith('---')) ?? lines[0] ?? ''
          return { path: file.path, snippet: snippet.slice(0, 80) }
        } catch {
          return { path: file.path, snippet: '' }
        }
      })
    ).then(snippets => {
      setSnippetMap(prev => {
        const next = { ...prev }
        for (const s of snippets) next[s.path] = s.snippet
        return next
      })
      setLoadingSnippets(prev => {
        const next = new Set(prev)
        needed.slice(0, 3).forEach(r => next.delete(r.path))
        return next
      })
    }).catch(() => {})
  }, [query])

  // Recent files shown when query is empty
  const showRecent = !query.trim()

  // Recent items that are still in the file tree
  const validRecent = recentFiles.filter(r => flatFiles.some(f => f.path === r.path))

  const results: Array<FlatFile & { snippet?: string }> = query.trim()
    ? flatFiles
        .filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
        .map(f => ({ ...f, snippet: snippetMap[f.path] }))
    : validRecent.map(r => ({ name: r.name, path: r.path, isDirectory: false }))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex].path)
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }

  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: '#fef08a', fontWeight: 600 }}>{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
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
            placeholder={showRecent ? '搜索文件... 或查看最近的文件' : '搜索文件内容...'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="quick-switch-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="quick-switch-results">
          {results.length === 0 ? (
            <div className="quick-switch-empty">
              <p>{query.trim() ? '未找到匹配文件' : '暂无最近文件'}</p>
              <p className="quick-switch-empty-hint">
                {query.trim() ? '试试其他关键词' : '打开文件后会显示在这里'}
              </p>
            </div>
          ) : (
            <>
              {showRecent && (
                <div className="quick-switch-section-label">
                  <Clock size={11} />
                  最近文件
                </div>
              )}
              {query.trim() && (
                <div className="quick-switch-section-label">
                  <Hash size={11} />
                  搜索结果
                </div>
              )}
              {results.map((file, i) => (
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
                    {file.snippet && (
                      <span className="quick-switch-item-snippet">{file.snippet}</span>
                    )}
                  </div>
                  <ArrowRight size={14} className="quick-switch-item-arrow" />
                </div>
              ))}
            </>
          )}
        </div>

        <div className="quick-switch-footer">
          {showRecent
            ? <span>输入关键词搜索文件</span>
            : <><span>↑↓ 导航</span><span>Enter 选中</span><span>Esc 关闭</span></>
          }
        </div>
      </div>
    </div>
  )
}