import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react'
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
            className="file-tree-item"
            style={{ paddingLeft: depth * 16 + 16 }}
            onClick={() => toggleFolder(file.path)}
          >
            {isExpanded ? (
              <ChevronDown className="file-tree-icon" size={14} />
            ) : (
              <ChevronRight className="file-tree-icon" size={14} />
            )}
            {isExpanded ? (
              <FolderOpen className="file-tree-icon" size={16} />
            ) : (
              <Folder className="file-tree-icon" size={16} />
            )}
            <span className="file-tree-name">{file.name}</span>
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
        onClick={() => onSelect(file.path)}
      >
        <FileText className="file-tree-icon" size={16} />
        <span className="file-tree-name">{file.name}</span>
      </div>
    )
  }

  const hasChildren = files[0]?.children
  const displayFiles = hasChildren ? files : files.filter(f => !f.path.includes('/'))

  return (
    <div className="file-tree">
      {files.length === 0 ? (
        <div className="loading">No files yet</div>
      ) : (
        displayFiles.map(file => renderFile(file))
      )}
    </div>
  )
}
