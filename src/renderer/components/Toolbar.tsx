import { useState } from 'react'
import { Plus, FolderPlus } from 'lucide-react'
import type { FileInfo } from '../types'

interface ToolbarProps {
  onNewFile: (folderPath: string, fileName: string) => void
  onNewFolder: (parentPath: string, folderName: string) => void
  vaultPath: string
  files: FileInfo[]
}

export function Toolbar({ onNewFile, onNewFolder, vaultPath, files }: ToolbarProps): JSX.Element {
  const [showNewFile, setShowNewFile] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [fileName, setFileName] = useState('')
  const [folderName, setFolderName] = useState('')
  const [targetFolder, setTargetFolder] = useState(vaultPath)

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

  const folders = files.filter(f => f.isDirectory)

  return (
    <div className="toolbar">
      <button className="btn" onClick={() => setShowNewFile(!showNewFile)}>
        <Plus size={14} />
        文件
      </button>
      <button className="btn" onClick={() => setShowNewFolder(!showNewFolder)}>
        <FolderPlus size={14} />
        文件夹
      </button>

      {showNewFile && (
        <div className="dropdown">
          <div className="dropdown-section">创建新文件</div>
          <div style={{ padding: '8px 12px' }}>
            <input
              type="text"
              className="input"
              placeholder="文件名"
              value={fileName}
              onChange={e => setFileName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFile()}
              autoFocus
              style={{ marginBottom: 8 }}
            />
            <select
              className="select"
              value={targetFolder}
              onChange={e => setTargetFolder(e.target.value)}
              style={{ marginBottom: 8 }}
            >
              <option value={vaultPath}>根目录</option>
              {folders.map(f => (
                <option key={f.path} value={f.path}>{f.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleCreateFile}>创建</button>
              <button className="btn" onClick={() => setShowNewFile(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {showNewFolder && (
        <div className="dropdown">
          <div className="dropdown-section">创建新文件夹</div>
          <div style={{ padding: '8px 12px' }}>
            <input
              type="text"
              className="input"
              placeholder="文件夹名"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
              style={{ marginBottom: 8 }}
            />
            <select
              className="select"
              value={targetFolder}
              onChange={e => setTargetFolder(e.target.value)}
              style={{ marginBottom: 8 }}
            >
              <option value={vaultPath}>根目录</option>
              {folders.map(f => (
                <option key={f.path} value={f.path}>{f.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleCreateFolder}>创建</button>
              <button className="btn" onClick={() => setShowNewFolder(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
