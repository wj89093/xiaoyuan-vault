import { useState, useEffect, useCallback } from 'react'
import { FileTree } from './components/FileTree'
import { Editor } from './components/Editor'
import { AIPanel } from './components/AIPanel'
import { WelcomeScreen } from './components/WelcomeScreen'
import { Toolbar } from './components/Toolbar'
import type { FileInfo } from './types'

declare global {
  interface Window {
    api: {
      openVault: () => Promise<string | null>
      listFiles: () => Promise<FileInfo[]>
      searchFiles: (query: string) => Promise<FileInfo[]>
      readFile: (path: string) => Promise<string>
      saveFile: (path: string, content: string) => Promise<boolean>
      createFolder: (path: string) => Promise<boolean>
      aiClassify: (content: string, folders: string[]) => Promise<string>
      aiTags: (content: string) => Promise<string[]>
      aiSummary: (content: string) => Promise<string>
      aiReason: (question: string, context: string[]) => Promise<string>
      aiWrite: (outline: string) => Promise<string>
    }
  }
}

function App(): JSX.Element {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [aiResults, setAiResults] = useState<Record<string, string>>({})

  // Open vault
  const handleOpenVault = useCallback(async () => {
    const path = await window.api.openVault()
    if (path) {
      setVaultPath(path)
      const fileList = await window.api.listFiles()
      setFiles(fileList)
    }
  }, [])

  // Select file
  const handleSelectFile = useCallback(async (filePath: string) => {
    if (selectedFile && isDirty) {
      // Auto-save on file switch
      await window.api.saveFile(selectedFile, content)
    }
    const fileContent = await window.api.readFile(filePath)
    setSelectedFile(filePath)
    setContent(fileContent)
    setIsDirty(false)
    setAiResults({})
  }, [selectedFile, isDirty, content])

  // Save file
  const handleSave = useCallback(async () => {
    if (selectedFile) {
      await window.api.saveFile(selectedFile, content)
      setIsDirty(false)
    }
  }, [selectedFile, content])

  // Create new file
  const handleNewFile = useCallback(async (folderPath: string, fileName: string) => {
    const filePath = `${folderPath}/${fileName}.md`
    await window.api.saveFile(filePath, `# ${fileName}\n\n`)
    const fileList = await window.api.listFiles()
    setFiles(fileList)
    setSelectedFile(filePath)
    setContent(`# ${fileName}\n\n`)
    setIsDirty(false)
  }, [])

  // Create folder
  const handleNewFolder = useCallback(async (parentPath: string, folderName: string) => {
    const folderPath = `${parentPath}/${folderName}`
    await window.api.createFolder(folderPath)
    const fileList = await window.api.listFiles()
    setFiles(fileList)
  }, [])

  // AI operations
  const handleAI = useCallback(async (action: string) => {
    if (!content) return
    try {
      let result: string | string[]
      switch (action) {
        case 'classify': {
          const folders = files.filter(f => f.isDirectory).map(f => f.name)
          result = await window.api.aiClassify(content, folders)
          break
        }
        case 'tags':
          result = await window.api.aiTags(content)
          break
        case 'summary':
          result = await window.api.aiSummary(content)
          break
        case 'write':
          result = await window.api.aiWrite(content)
          break
        default:
          return
      }
      setAiResults(prev => ({ ...prev, [action]: Array.isArray(result) ? result.join(', ') : result }))
    } catch (err) {
      console.error('AI error:', err)
    }
  }, [content, files])

  // Content change
  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    setIsDirty(true)
  }, [])

  // Auto-save before close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (selectedFile && isDirty) {
        window.api.saveFile(selectedFile, content)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [selectedFile, isDirty, content])

  return (
    <div className="app-container">
      {!vaultPath ? (
        <WelcomeScreen onOpenVault={handleOpenVault} />
      ) : (
        <>
          <div className="sidebar">
            <div className="sidebar-header">
              <span className="sidebar-title">📁 {vaultPath?.split('/').pop()}</span>
            </div>
            <Toolbar
              onNewFile={handleNewFile}
              onNewFolder={handleNewFolder}
              vaultPath={vaultPath}
              files={files}
            />
            <div className="file-tree">
              <FileTree
                files={files}
                selectedFile={selectedFile}
                onSelect={handleSelectFile}
                vaultPath={vaultPath}
              />
            </div>
          </div>
          <div className="main-content">
            <div className="editor-container">
              {selectedFile ? (
                <>
                  <div className="editor-header">
                    <span className="editor-title">{selectedFile.split('/').pop()}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {isDirty && <span style={{ fontSize: 12, color: '#faad14' }}>未保存</span>}
                      <button className="toolbar-btn" onClick={handleSave}>
                        保存
                      </button>
                    </div>
                  </div>
                  <div className="editor-wrapper">
                    <Editor value={content} onChange={handleContentChange} />
                  </div>
                </>
              ) : (
                <div className="welcome-screen">
                  <span className="welcome-title">选择或创建文件</span>
                  <span className="welcome-desc">在左侧选择一个文件进行编辑，或点击工具栏创建新文件</span>
                </div>
              )}
            </div>
          </div>
          <AIPanel
            aiResults={aiResults}
            onAI={handleAI}
            hasContent={!!content}
          />
        </>
      )}
    </div>
  )
}

export default App
