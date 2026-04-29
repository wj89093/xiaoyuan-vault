import { useState, useEffect, useCallback } from 'react'
import { FileTree } from './components/FileTree'
import { Editor } from './components/Editor'
import { AIChat } from './components/AIChat'
import { SearchResults } from './components/SearchResults'
import { WelcomeScreen } from './components/WelcomeScreen'
import { QuickSwitch } from './components/QuickSwitch'
import { KnowledgeGraph } from './components/KnowledgeGraph'
import { SettingsPanel } from './components/SettingsPanel'
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
      chatAsk: (question: string, history?: any[]) => Promise<{answer: string; sources: {file: string; title: string; snippet: string}[]; confidence: number}>
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
  const [showGraph, setShowGraph] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [autoAI, setAutoAI] = useState({ enabled: true, interval: 60, onClassify: true, onTags: true, onSummary: true })

  // New vault
  const handleNewVault = useCallback(async () => {
    const path = await window.api.openVault()
    if (path) {
      setVaultPath(path)
      const fileList = await window.api.listFiles()
      setFiles(fileList)
    }
  }, [])

  // AI Chat (RAG-enhanced: file-context when selected, vault-wide when not)
  const handleSendMessage = useCallback(async (text: string) => {
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setChatLoading(true)
    try {
      let response: string
      if (selectedFile && content) {
        // File-focused Q&A
        response = await window.api.aiReason(text, [content])
      } else {
        // Vault-wide RAG
        const rag = await (window.api as any).chatAsk?.(text, messages.slice(-6))
        response = rag?.answer
          ? `${rag.answer}\n\n---\n${rag.sources?.map((s: any) => `📄 [[${s.title}]]`).join(' | ') || ''}`
          : '抱歉，未找到相关信息。'
      }
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (err) {
      console.error('AI chat error:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，处理请求时出错。' }])
    } finally {
      setChatLoading(false)
    }
  }, [content, selectedFile, messages])

  // Open vault
  // Save AI message to vault
  const handleSaveAIMessage = useCallback(async (content: string) => {
    if (!vaultPath) return
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const collectDir = vaultPath + '/0-收集/AI对话'
    try {
      await (window.api as any).createFolder?.('0-收集/AI对话')
    } catch {}
    const title = content.split('\n')[0].slice(0, 40).replace(/[#*`\[\]]/g, '')
    const md = `---\ntitle: "${title || 'AI 对话'}"\ntype: note\nsource: ai-chat\ncreated: ${new Date().toISOString().slice(0, 10)}\ntags: [ai-chat]\n---\n\n${content}`
    const filePath = `0-收集/AI对话/ai-${timestamp}.md`
    await window.api.createFile(filePath, title || 'AI 对话', 'note')
    await window.api.saveFile(filePath, md)
  }, [vaultPath])

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

  // Cmd+P / Ctrl+P Quick Switch + Cmd+F search focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        if (vaultPath) setShowQuickSwitch(v => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && vaultPath) {
        ;(document.querySelector('.search-input') as HTMLInputElement)?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [vaultPath])

  // Global shortcut Cmd+Shift+F → Quick Switch
  useEffect(() => {
    return (window.api as any).onQuickSwitch?.(() => {
      if (vaultPath) setShowQuickSwitch(true)
    })
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
      {showGraph && vaultPath && (
        <div className="kg-overlay">
          <KnowledgeGraph
            files={files}
            selectedFile={selectedFile}
            onSelect={(path) => { setSelectedFile(path); setShowGraph(false) }}
            onClose={() => setShowGraph(false)}
          />
        </div>
      )}
      {showSettings && vaultPath && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          autoAI={autoAI}
          onUpdate={(s) => { setAutoAI(s); window.api.saveAutoAISettings?.(s as any) }}
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
                  onOpenGraph={() => setShowGraph(true)}
                  onOpenSettings={() => setShowSettings(true)}
                  vaultPath={vaultPath}
                  files={files}
                />
                <div className="file-tree">
                  <FileTree
                    files={displayFiles}
                    selectedFile={selectedFile}
                    onSelect={handleSelectFile}
                    onNewFile={() => handleNewFile('', '')}
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
            onSaveToVault={async (msgId: string) => {
              const msg = messages.find((m: any) => m.id === msgId || m.id === undefined)
              if (msg) await handleSaveAIMessage(msg.content)
            }}
          />
        </>
      )}
    </div>
  )
}

export default App
