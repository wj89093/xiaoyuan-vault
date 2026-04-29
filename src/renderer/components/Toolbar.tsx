import { useState, useRef, useEffect } from 'react'
import { Plus, FolderPlus, Network, Settings } from 'lucide-react'
import type { FileInfo } from '../types'

interface ToolbarProps {
  onNewFile: (folderPath: string, fileName: string) => void
  onNewFolder: (parentPath: string, folderName: string) => void
  onOpenGraph: () => void
  onOpenSettings: () => void
  vaultPath: string
  files: FileInfo[]
}

export function Toolbar({ onNewFile, onNewFolder, onOpenGraph, onOpenSettings, vaultPath, files }: ToolbarProps): JSX.Element {
  const [showNewFile, setShowNewFile] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [fileName, setFileName] = useState('')
  const [folderName, setFolderName] = useState('')
  const [targetFolder, setTargetFolder] = useState(vaultPath)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const fileDropdownRef = useRef<HTMLDivElement>(null)
  const folderDropdownRef = useRef<HTMLDivElement>(null)

  const folders = files.filter(f => f.isDirectory)

  useEffect(() => {
    if (showNewFile && fileInputRef.current) {
      fileInputRef.current.focus()
    }
  }, [showNewFile])

  useEffect(() => {
    if (showNewFolder && folderInputRef.current) {
      folderInputRef.current.focus()
    }
  }, [showNewFolder])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileDropdownRef.current && !fileDropdownRef.current.contains(e.target as Node)) {
        setShowNewFile(false)
      }
      if (folderDropdownRef.current && !folderDropdownRef.current.contains(e.target as Node)) {
        setShowNewFolder(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCreateFile = () => {
    if (fileName.trim()) {
      onNewFile(targetFolder, fileName.trim())
      setFileName('')
      setShowNewFile(false)
    }
  }

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      onNewFolder(targetFolder, folderName.trim())
      setFolderName('')
      setShowNewFolder(false)
    }
  }

  return (
    <div className="toolbar">
      <button
        className="btn btn-icon"
        onClick={() => setShowNewFile(!showNewFile)}
        title="新建文件"
      >
        <Plus size={16} />
      </button>
      <button
        className="btn btn-icon"
        onClick={() => setShowNewFolder(!showNewFolder)}
        title="新建文件夹"
      >
        <FolderPlus size={16} />
      </button>
      <button
        className="btn btn-icon"
        onClick={onOpenGraph}
        title="知识图谱"
      >
        <Network size={16} />
      </button>
      <button
        className="btn btn-icon"
        onClick={onOpenSettings}
        title="设置"
      >
        <Settings size={16} />
      </button>

      {showNewFile && (
        <div className="dropdown" ref={fileDropdownRef} style={{ top: '100%', left: 0 }}>
          <div className="dropdown-section">新建文件</div>
          <div style={{ padding: 'var(--space-2)' }}>
            <input
              ref={fileInputRef}
              type="text"
              className="input"
              placeholder="文件名"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFile()}
              style={{ marginBottom: 'var(--space-2)' }}
            />
            <select
              className="select"
              value={targetFolder}
              onChange={e => setTargetFolder(e.target.value)}
              style={{ marginBottom: 'var(--space-2)' }}
            >
              <option value={vaultPath}>根目录</option>
              {folders.map(f => (
                <option key={f.path} value={f.path}>{f.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-primary" onClick={handleCreateFile}>创建</button>
              <button className="btn" onClick={() => setShowNewFile(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {showNewFolder && (
        <div className="dropdown" ref={folderDropdownRef} style={{ top: '100%', left: 0 }}>
          <div className="dropdown-section">新建文件夹</div>
          <div style={{ padding: 'var(--space-2)' }}>
            <input
              ref={folderInputRef}
              type="text"
              className="input"
              placeholder="文件夹名"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              style={{ marginBottom: 'var(--space-2)' }}
            />
            <select
              className="select"
              value={targetFolder}
              onChange={e => setTargetFolder(e.target.value)}
              style={{ marginBottom: 'var(--space-2)' }}
            >
              <option value={vaultPath}>根目录</option>
              {folders.map(f => (
                <option key={f.path} value={f.path}>{f.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className="btn btn-primary" onClick={handleCreateFolder}>创建</button>
              <button className="btn" onClick={() => setShowNewFolder(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
