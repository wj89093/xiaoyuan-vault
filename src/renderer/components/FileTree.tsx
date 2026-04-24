import { useState } from 'react'
import type { FileInfo } from '../types'

interface FileTreeProps {
  files: FileInfo[]
  selectedFile: string | null
  onSelect: (path: string) => void
  vaultPath: string
}

export function FileTree({ files, selectedFile, onSelect, vaultPath }: FileTreeProps): JSX.Element {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([vaultPath]))

  const toggleFolder = (path: string) => {
    const next = new Set(expandedFolders)
    if (next.has(path)) {
      next.delete(path)
    } else {
      next.add(path)
    }
    setExpandedFolders(next)
  }

  const renderFile = (file: FileInfo, depth: number = 0): JSX.Element | null => {
    const isExpanded = expandedFolders.has(file.path)
    const isSelected = selectedFile === file.path

    if (file.isDirectory) {
      return (
        <div key={file.path}>
          <div
            className="file-item"
            style={{ paddingLeft: depth * 16 + 8 }}
            onClick={() => toggleFolder(file.path)}
          >
            <span className="file-item-icon">{isExpanded ? '📂' : '📁'}</span>
            <span className="file-item-name">{file.name}</span>
          </div>
          {isExpanded && file.children?.map(child => renderFile(child, depth + 1))}
        </div>
      )
    }

    return (
      <div
        key={file.path}
        className={`file-item ${isSelected ? 'active' : ''}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelect(file.path)}
      >
        <span className="file-item-icon">📄</span>
        <span className="file-item-name">{file.name}</span>
      </div>
    )
  }

  // Build tree structure - use children if available
  const rootFiles = files.filter(f => !f.path.includes('/'))

  // If files have children property, use them directly
  const displayFiles = files[0]?.children ? files : rootFiles

  return (
    <div className="file-tree">
      {files.length === 0 ? (
        <div style={{ padding: 16, color: '#666', fontSize: 13 }}>
          暂无文件，点击工具栏创建
        </div>
      ) : (
        displayFiles.map(file => renderFile(file))
      )}
    </div>
  )
}
