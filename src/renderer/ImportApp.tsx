import { useState, useRef, useCallback } from 'react'
import { Upload, Link, X, CheckCircle } from 'lucide-react'

interface ImportResult {
  type: 'file' | 'url'
  name: string
  path: string
  status: 'ok' | 'error'
  converted?: boolean
  mdPath?: string
  error?: string
}

// ImportApp uses window.api methods exposed by preload
// (importFiles, fetchUrl, saveUrlContent)

export function ImportApp(): JSX.Element {
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ImportResult[]>([])
  const [urlInput, setUrlInput] = useState('')
  const [fetching, setFetching] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const dragCount = useRef(0)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCount.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCount.current--
    if (dragCount.current === 0) setIsDragging(false)
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleFileImport = async (filePaths: string[]) => {
    setImporting(true)
    try {
      const vaultPath = await (window.api as any).getVaultPath()
      if (!vaultPath) {
        setResults(prev => [...prev, { type: 'file' as const, name: '错误', path: '', status: 'error' as const, error: '未打开知识库' }])
        return
      }
      const res = await (window.api as any).importFiles(vaultPath, filePaths)
      setResults(prev => [...prev, ...res.map((r: any) => ({ type: 'file' as const, ...r }))])
    } catch (err: any) {
      setResults(prev => [...prev, { type: 'file' as const, name: '错误', path: '', status: 'error' as const, error: err.message || '导入失败' }])
    } finally {
      setImporting(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCount.current = 0
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return

    // Use webUtils.getPathForFile via preload (File.path is undefined under contextIsolation)
    const paths = files.map(f => (window.api as any).getPathForFile?.(f)).filter(Boolean)
    if (paths.length > 0) {
      await handleFileImport(paths)
    }
  }

  const handleFileSelect = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.onchange = async () => {
      if (input.files) {
        const paths = Array.from(input.files).map(f => (window.api as any).getPathForFile?.(f)).filter(Boolean)
        if (paths.length > 0) {
          await handleFileImport(paths)
        }
      }
    }
    input.click()
  }

  const handleFetchUrl = async () => {
    const url = urlInput.trim()
    if (!url) return

    setFetching(true)
    setUrlError(null)
    try {
      const { title, content } = await (window.api as any).fetchUrl(url)
      const vaultPath = await (window.api as any).getVaultPath()
      const path = await (window.api as any).saveUrlContent(vaultPath || '', title, content)
      setResults(prev => [...prev, { type: 'url', name: title, path, status: 'ok' }])
      setUrlInput('')
    } catch (err: any) {
      setUrlError(err.message || '获取失败')
    } finally {
      setFetching(false)
    }
  }

  const removeResult = (idx: number) => {
    setResults(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <div className="import-app">
      <div className="import-header">
        <span>导入文件</span>
        <button className="btn btn-icon" onClick={() => window.close()} style={{ padding: 2 }}>
          <X size={14} />
        </button>
      </div>

      {/* Drop zone */}
      <div
        className={`import-drop ${isDragging ? 'import-drop-active' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Upload size={28} strokeWidth={1.5} />
        <div className="import-drop-title">
          {importing ? '导入中...' : isDragging ? '松开导入' : '拖拽文件到这里'}
        </div>
        <div className="import-drop-hint">或</div>
        <button className="btn btn-primary" onClick={handleFileSelect}>
          选择文件
        </button>
      </div>

      {/* URL input */}
      <div className="import-url-section">
        <div className="import-url-header">
          <Link size={14} />
          <span>从链接导入</span>
        </div>
        <div className="import-url-row">
          <input
            type="text"
            className="input"
            placeholder="粘贴网址，按回车获取内容..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleFetchUrl()}
          />
          <button className="btn btn-primary" onClick={handleFetchUrl} disabled={!urlInput.trim() || fetching}>
            {fetching ? '获取...' : '获取'}
          </button>
        </div>
        {urlError && <div className="import-url-error">{urlError}</div>}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="import-results">
          {results.map((r, i) => (
            <div key={i} className="import-result-item">
              <CheckCircle size={14} style={{ color: r.status === 'ok' ? 'var(--color-accent)' : 'red', flexShrink: 0 }} />
              <div className="import-result-info">
                <div className="import-result-name">{r.name}</div>
                <div className="import-result-type">
                  {r.type === 'url' ? '🔗 链接' : r.converted ? '✅ 已转 Markdown' : '📄 原始文件'}
                  {r.error && <span className="import-result-error"> — {r.error}</span>}
                </div>
              </div>
              <button className="btn btn-icon" onClick={() => removeResult(i)} style={{ padding: 2, flexShrink: 0 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
