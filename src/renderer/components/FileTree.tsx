import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Trash2, Pencil, MoveRight } from 'lucide-react'
import type { FileInfo } from '../types'

interface FileTreeProps {
  files: FileInfo[]
  selectedFile: string | null
  onSelect: (path: string) => void
  onRefresh?: () => void
  onNewFile?: () => void
  vaultPath: string
}

export function FileTree({ files, selectedFile, onSelect, onRefresh, onNewFile, vaultPath }: FileTreeProps): JSX.Element {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([vaultPath]))
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileInfo } | null>(null)
  const [hoverPreview, setHoverPreview] = useState<{ x: number; y: number; name: string; summary: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const hoverTimer = useRef<any>(null)
  const previewBoxRef = useRef<HTMLDivElement>(null)

  const toggleFolder = (path: string) => {
    const next = new Set(expandedFolders)
    next.has(path) ? next.delete(path) : next.add(path)
    setExpandedFolders(next)
  }

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => {
      setContextMenu(null)
      setHoverPreview(null)
    }
    if (contextMenu || hoverPreview) {
      window.addEventListener('click', handler)
      return () => window.removeEventListener('click', handler)
    }
  }, [contextMenu, hoverPreview])

  // Handle mouse enter: fetch summary for preview
  const handleMouseEnter = async (e: React.MouseEvent, file: FileInfo) => {
    if (file.isDirectory) return
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    hoverTimer.current = setTimeout(async () => {
      try {
        const content = await window.api.readFile(file.path)
        // Extract summary from frontmatter or first lines
        const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
        let summary = ''
        if (fmMatch) {
          const fm = fmMatch[1]
          const sm = fm.match(/^summary:\s*(.+)/m)
          if (sm) summary = sm[1].slice(0, 120)
        }
        if (!summary) {
          const body = content.replace(/^---[\s\S]*?---\n?/, '').trim()
          summary = body.split('\n').filter(l => l.trim()).slice(0, 2).join(' ').slice(0, 120)
        }
        setHoverPreview({
          x: rect.right + 8,
          y: rect.top,
          name: file.name,
          summary: summary || '(无内容)',
        })
      } catch {
        setHoverPreview(null)
      }
    }, 500)
  }

  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current)
    // Don't close preview immediately — let user move to it
  }

  // Context menu
  const handleContextMenu = (e: React.MouseEvent, file: FileInfo) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, file })
    setHoverPreview(null)
  }

  const handleDelete = async (file: FileInfo) => {
    setContextMenu(null)
    if (file.isDirectory) {
      await window.api.deleteFolder(file.path)
    } else {
      await window.api.deleteFile(file.path)
    }
    onRefresh?.()
  }

  const handleRename = async (file: FileInfo) => {
    setContextMenu(null)
    const newName = prompt('新名称:', file.name)
    if (newName && newName !== file.name) {
      await window.api.renameFile(file.path, newName)
      onRefresh?.()
    }
  }

  const renderFile = (file: FileInfo, depth: number = 0): JSX.Element | null => {
    const isExpanded = expandedFolders.has(file.path)
    const isSelected = selectedFile === file.path

    if (file.isDirectory) {
      return (
        <div key={file.path}>
          <div
            className={`file-tree-item ${dropTarget === file.path ? 'drop-target' : ''}`}
            style={{ paddingLeft: depth * 16 + 16 }}
            onClick={() => toggleFolder(file.path)}
            onContextMenu={(e) => handleContextMenu(e, file)}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTarget(file.path) }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={async (e) => {
              e.preventDefault(); setDropTarget(null)
              const srcPath = e.dataTransfer.getData('text/plain')
              if (srcPath && srcPath !== file.path) {
                await window.api.moveFile(srcPath, file.path)
                onRefresh?.()
              }
            }}
          >
            {isExpanded ? <ChevronDown className="file-tree-icon" size={14} /> : <ChevronRight className="file-tree-icon" size={14} />}
            {isExpanded ? <FolderOpen className="file-tree-icon" size={16} /> : <Folder className="file-tree-icon" size={16} />}
            <span className="file-tree-name">{file.name}</span>
            {file.children && <span className="file-tree-count">{file.children.length}</span>}
          </div>
          {isExpanded && file.children?.map(child => renderFile(child, depth + 1))}
        </div>
      )
    }

    return (
      <div
        key={file.path}
        className={`file-tree-item ${isSelected ? 'active' : ''}`}
        style={{ paddingLeft: depth * 16 + 36 }}
        draggable
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', file.path); e.dataTransfer.effectAllowed = 'move' }}
        onClick={() => onSelect(file.path)}
        onContextMenu={(e) => handleContextMenu(e, file)}
        onMouseEnter={(e) => handleMouseEnter(e, file)}
        onMouseLeave={handleMouseLeave}
        title={file.title || file.name}
      >
        <FileText className="file-tree-icon" size={16} />
        <span className="file-tree-name">{file.title || file.name}</span>
      </div>
    )
  }

  return (
    <div className="file-tree">
      {files.length === 0 ? (
        <div className="file-tree-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a1a1a6" stroke-width="1.2">
            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
          </svg>
          <p>知识库还是空的</p>
          <p className="file-tree-empty-hint">拖拽文件到此处，或点击上方 + 新建</p>
          <button className="btn btn-secondary" onClick={() => onNewFile?.()} style={{marginTop:8}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 2v10M2 7h10"/></svg>
            新建第一个文件
          </button>
        </div>
      ) : (
        (files[0]?.children ? files : files.filter(f => !f.path.includes('/'))).map(file => renderFile(file))
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="context-menu-item" onClick={() => handleRename(contextMenu.file)}>
            <Pencil size={14} /> 重命名
          </div>
          <div className="context-menu-item danger" onClick={() => handleDelete(contextMenu.file)}>
            <Trash2 size={14} /> 删除
          </div>
        </div>
      )}

      {/* Hover Preview Tooltip */}
      {hoverPreview && (
        <div
          className="file-preview-tooltip"
          ref={previewBoxRef}
          style={{ left: hoverPreview.x, top: hoverPreview.y }}
          onMouseEnter={() => clearTimeout(hoverTimer.current)}
          onMouseLeave={() => setTimeout(() => setHoverPreview(null), 300)}
        >
          <div className="file-preview-name">{hoverPreview.name}</div>
          <div className="file-preview-summary">{hoverPreview.summary}</div>
        </div>
      )}
    </div>
  )
}
