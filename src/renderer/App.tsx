import { useState, useEffect, useCallback } from 'react'
import { FileTree } from './components/FileTree'
import { Editor } from './components/Editor'
import { AIChat } from './components/AIChat'
import { SearchResults } from './components/SearchResults'
import { WelcomeScreen } from './components/WelcomeScreen'
import { QuickSwitch } from './components/QuickSwitch'
import { Toolbar } from './components/Toolbar'
import { Search, FolderOpen } from 'lucide-react'
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
      moveFile: (filePath: string, newParentDir: string) => Promise<boolean>
      getVaultPath: () => Promise<string | null>
    }
  }
}

function App(): JSX.Element {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileInfo[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [messages, setMessages] = useState<Array<{role: string, content: string}>>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [showQuickSwitch, setShowQuickSwitch] = useState(false)

  // New vault
  const handleNewVault = useCallback(async () => {
    const path = await window.api.openVault()
    if (path) {
      setVaultPath(path)
      const fileList = await window.api.listFiles()
      setFiles(fileList)
    }
  }, [])

  // AI Chat
  const handleSendMessage = useCallback(async (text: string) => {
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setChatLoading(true)
    try {
      const result = await window.api.aiReason(text, [content])
      setMessages(prev => [...prev, { role: 'assistant', content: result }])
    } catch (err) {
      console.error('AI chat error:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，处理请求时出错。' }])
    } finally {
      setChatLoading(false)
    }
  }, [content])

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
      await window.api.saveFile(selectedFile, content)
    }
    const fileContent = await window.api.readFile(filePath)
    setSelectedFile(filePath)
    setContent(fileContent)
    setIsDirty(false)
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }, [selectedFile, isDirty, content])

  // Search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      const results = await window.api.searchFiles(query)
      setSearchResults(results)
      setShowSearchResults(true)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }, [])

  // Close search results
  const handleCloseSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }, [])

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

  // Refresh file list after import
  useEffect(() => {
    return (window.api as any).onImportCompleted?.(async () => {
      const fileList = await window.api.listFiles()
      setFiles(fileList)
    })
  }, [])

  // Cmd+P / Ctrl+P Quick Switch
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        if (vaultPath) setShowQuickSwitch(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [vaultPath])

  // Display files (search results or all files)
  const displayFiles = showSearchResults ? searchResults : files

  return (
    <div className="app-container" style={{ background: '#f5f5f5' }}>
      {showQuickSwitch && (
        <QuickSwitch
          files={files}
          onSelect={(path: string) => {
            setSelectedFile(path)
            setShowQuickSwitch(false)
          }}
          onClose={() => setShowQuickSwitch(false)}
        />
      )}
      {!vaultPath ? (
        <WelcomeScreen onOpenVault={handleOpenVault} onNewVault={handleNewVault} />
      ) : (
        <>
          <div className="sidebar">
            <div className="sidebar-header">
              <FolderOpen size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <span className="sidebar-title">{vaultPath?.split('/').pop()}</span>
            </div>
            <div className="search-container">
              <div className="search-wrapper">
                <Search className="search-icon" size={14} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="搜索文件..."
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                />
              </div>
            </div>
            
            {showSearchResults ? (
              <SearchResults
                results={searchResults}
                query={searchQuery}
                onSelect={handleSelectFile}
                onClose={handleCloseSearch}
              />
            ) : (
              <>
                <Toolbar
                  onNewFile={handleNewFile}
                  onNewFolder={handleNewFolder}
                  vaultPath={vaultPath}
                  files={files}
                />
                <div className="file-tree">
                  <FileTree
                    files={displayFiles}
                    selectedFile={selectedFile}
                    onSelect={handleSelectFile}
                    vaultPath={vaultPath}
                  />
                </div>
              </>
            )}
          </div>
          <div className="main-content">
            <div className="editor-container">
              {selectedFile ? (
                <>
                  <div className="editor-header">
                    <span className="editor-title">{selectedFile.split('/').pop()}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {isDirty && <span className="editor-status">未保存</span>}
                      <button className="btn" onClick={handleSave}>保存</button>
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
          <AIChat
            messages={messages}
            onSend={handleSendMessage}
            loading={chatLoading}
          />
        </>
      )}
    </div>
  )
}

export default App
