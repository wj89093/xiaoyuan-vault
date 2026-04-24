import { useState } from 'react'
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

  // Get folder list for dropdown
  const folders = files.filter(f => f.isDirectory)

  return (
    <div className="toolbar">
      <button className="toolbar-btn" onClick={() => setShowNewFile(!showNewFile)}>
        + 文件
      </button>
      <button className="toolbar-btn" onClick={() => setShowNewFolder(!showNewFolder)}>
        + 文件夹
      </button>

      {showNewFile && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 16,
          background: 'white',
          padding: 12,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 100,
          minWidth: 200
        }}>
          <div style={{ marginBottom: 8, fontSize: 12 }}>创建新文件</div>
          <input
            type="text"
            placeholder="文件名"
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateFile()}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #e8e8e8',
              borderRadius: 4,
              marginBottom: 8
            }}
            autoFocus
          />
          <select
            value={targetFolder}
            onChange={e => setTargetFolder(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #e8e8e8',
              borderRadius: 4,
              marginBottom: 8
            }}
          >
            <option value={vaultPath}>根目录</option>
            {folders.map(f => (
              <option key={f.path} value={f.path}>{f.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="toolbar-btn primary" onClick={handleCreateFile}>创建</button>
            <button className="toolbar-btn" onClick={() => setShowNewFile(false)}>取消</button>
          </div>
        </div>
      )}

      {showNewFolder && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: 80,
          background: 'white',
          padding: 12,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 100,
          minWidth: 200
        }}>
          <div style={{ marginBottom: 8, fontSize: 12 }}>创建新文件夹</div>
          <input
            type="text"
            placeholder="文件夹名"
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #e8e8e8',
              borderRadius: 4,
              marginBottom: 8
            }}
            autoFocus
          />
          <select
            value={targetFolder}
            onChange={e => setTargetFolder(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              border: '1px solid #e8e8e8',
              borderRadius: 4,
              marginBottom: 8
            }}
          >
            <option value={vaultPath}>根目录</option>
            {folders.map(f => (
              <option key={f.path} value={f.path}>{f.name}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="toolbar-btn primary" onClick={handleCreateFolder}>创建</button>
            <button className="toolbar-btn" onClick={() => setShowNewFolder(false)}>取消</button>
          </div>
        </div>
      )}
    </div>
  )
}
