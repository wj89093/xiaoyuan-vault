import { useState, useRef, useCallback } from 'react'
import { Upload, X } from 'lucide-react'

interface DropZoneProps {
  vaultPath: string
  compact?: boolean
  onFilesImported: () => void
}

export function DropZone({ vaultPath, compact = false, onFilesImported }: DropZoneProps): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const dragCount = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const doImport = useCallback(async (paths: string[]) => {
    setImporting(true)
    setResult(null)
    try {
      const imported = await window.api.importFiles(vaultPath, paths)
      if (imported.length > 0) {
        setResult(`已导入 ${imported.length} 个文件`)
        onFilesImported()
        setTimeout(() => { setExpanded(false); setResult(null) }, 2000)
      } else {
        setResult('未导入任何文件')
      }
    } catch {
      setResult('导入失败')
    } finally {
      setImporting(false)
    }
  }, [vaultPath, onFilesImported])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const paths = files.map(f => (f as any).path).filter(Boolean)
    if (paths.length > 0) doImport(paths)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleBrowse = () => fileInputRef.current?.click()

  // Remove compact handleBrowse since it used IPC
  // and update compact to use the simpler input approach
  

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCount.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
      setExpanded(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCount.current--
    if (dragCount.current === 0) {
      timerRef.current = setTimeout(() => {
        setIsDragging(false)
        setExpanded(false)
      }, 200)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (timerRef.current) clearTimeout(timerRef.current)
    dragCount.current = 0
    setIsDragging(false)

    const items = Array.from(e.dataTransfer.files)
    if (items.length === 0) return
    const paths = items.map(f => (f as any).path).filter(Boolean)
    if (paths.length > 0) doImport(paths)
  }

  if (compact) {
    return (
      <div
        className={`dropzone-float ${isDragging ? 'dropzone-float-active' : ''} ${expanded ? 'dropzone-float-expanded' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
        {expanded ? (
          <div className="dropzone-float-inner">
            <div className="dropzone-float-header">
              <span>{importing ? '导入中...' : isDragging ? '松开导入' : '拖拽文件到这里'}</span>
              <button className="btn btn-icon" onClick={() => { setExpanded(false); setResult(null) }} style={{ padding: 2 }}>
                <X size={12} />
              </button>
            </div>
            <div className="dropzone-float-desc">支持 PDF/Word/Excel/PPT/图片/音频 | <button className="btn-link" onClick={handleBrowse}>点击选择</button></div>
            {result && <div className="dropzone-float-result">{result}</div>}
          </div>
        ) : (
          <div className="dropzone-float-btn">
            <Upload size={16} />
            <span>导入文件</span>
          </div>
        )}
      </div>
    )
  }

  // Non-compact version - inline drop area
  return (
    <div
      className={`drop-zone ${isDragging ? 'drop-zone-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Upload size={32} strokeWidth={1.5} />
      <div className="drop-zone-title">
        {importing ? '正在导入...' : isDragging ? '松开导入' : '拖拽文件到这里'}
      </div>
      <div className="drop-zone-desc">支持 PDF/Word/Excel/PPT/图片/音频等格式</div>
      <div className="drop-zone-desc" style={{ marginTop: 4, opacity: 0.7 }}>
        或 <button className="btn-link" onClick={handleBrowse}>点击选择文件</button>
      </div>
      {result && <div className="drop-zone-result">{result}</div>}
    </div>
  )
}
