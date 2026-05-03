import { useState, useEffect, useCallback } from 'react'
import React from 'react'
import log from 'electron-log/renderer'
import { FileTree } from './components/FileTree'
import { Editor } from './components/Editor'
import { AIChat } from './components/AIChat'
import { SearchResults } from './components/SearchResults'
import { WelcomeScreen } from './components/WelcomeScreen'
import { QuickSwitch } from './components/QuickSwitch'
import { KnowledgeGraph } from './components/KnowledgeGraph'
import { Toolbar } from './components/Toolbar'
import { ToastContainer, useToasts, showToast } from './components/Toast'
import { ShortcutGuide } from './components/ShortcutGuide'
import { ImportApp } from './ImportApp'
import { Search, FolderPlus, FolderOpen } from 'lucide-react'
import type { FileInfo } from './types'
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
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showVaultMenu, setShowVaultMenu] = useState(false)
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; name: string }>>([])
  const { toasts, dismiss: dismissToast } = useToasts()
  const [nativePreview, setNativePreview] = useState<{path: string, content: string} | null>(null)
  const [isNativePreview, setIsNativePreview] = useState(false)

  // Hash-based routing for import window
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  if (hash === '#/import') {
    return <ImportApp />
  }

  // New vault
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleNewVault = useCallback(async () => {
    const path = await window.api.openVault()
    if (path) {
      setVaultPath(path)
      const fileList = await window.api.listFiles()
      setFiles(fileList)
      showToast('success', '知识库已创建并打开')
    }
  }, [])

  // AI Chat (RAG-enhanced: file-context when selected, vault-wide when not)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg = { role: 'user' as const, content: text }
    setMessages(prev => [...prev, userMsg])
    setChatLoading(true)

    try {
      if (selectedFile && content) {
        // File-focused Q&A — not streamed (simpler, single file)
        const historyContext = messages.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')
        const response = await window.api.aiReason(
          `对话历史:\n${historyContext}\n\n当前问题: ${text}`,
          [content]
        )
        setMessages(prev => [...prev, { role: 'assistant', content: response }])
      } else {
        // Vault-wide RAG — stream the answer
        const placeholderId = `stream-${Date.now()}`
        const placeholder = { id: placeholderId, role: 'assistant' as const, content: '正在思考...', pagesUsed: [] as Array<{file: string; title: string}>, sourceMode: 'knowledge_base' as const }
        setMessages(prev => [...prev, placeholder])

                const history = messages.slice(-20).map((m: any) => ({ role: m.role, content: m.content }))

        // Set up stream listeners before kicking off the request
        let unsubChunk: (() => void) | undefined
        let unsubDone: (() => void) | undefined
        let unsubError: (() => void) | undefined
        let settled = false

        const cleanup = () => {
          unsubChunk?.()
          unsubDone?.()
          unsubError?.()
          setChatLoading(false)
        }

        unsubChunk = api.onChatStreamChunk?.(({ partial }: any) => {
          setMessages(prev => prev.map((m: any) =>
            m.id === placeholderId ? { ...m, content: partial } : m
          ))
        })

        unsubDone = api.onChatStreamDone?.(({ answer, sources }: any) => {
          settled = true
          const sourcePaths = sources?.map((s: any) => ({ file: s.file, title: s.title })) ?? []
          setMessages(prev => prev.map((m: any) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content: `${answer}\n\n---\n${sources?.map((s: any) => `📄 [[${s.title}]]`).join(' | ') ?? ''}`,
                  pagesUsed: sourcePaths,
                  sourceMode: 'knowledge_base',
                }
              : m
          ))
          cleanup()
        })

        unsubError = api.onChatStreamError?.(({ error }: any) => {
          settled = true
          setMessages(prev => prev.map((m: any) =>
            m.id === placeholderId
              ? { ...m, content: `抱歉，搜索时出现错误：${error}` }
              : m
          ))
          cleanup()
        })

        // Kick off streaming
        const result = await api.chatAskStream?.(text, history)
        // If result returns immediately (non-stream), finalize
        if (result && !result.streamed && !settled) {
          cleanup()
          setMessages(prev => prev.map((m: any) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content: `${result.answer}\n\n---\n${result.sources?.map((s: any) => `📄 [[${s.title}]]`).join(' | ') ?? ''}`,
                  sources: result.sources?.map((s: any) => s.title) ?? [],
                }
              : m
          ))
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      const fallback = msg.includes('key') || msg.includes('401') ? 'API Key 未配置或无效'
        : msg.includes('timeout') || msg.includes('ETIMEDOUT') ? '请求超时，请稍后重试'
        : msg.includes('network') || msg.includes('ECONNREFUSED') ? '网络连接失败'
        : '抱歉，处理请求时出错。'
      setMessages(prev => [...prev, { role: 'assistant', content: fallback }])
      setChatLoading(false)
    }
  }, [content, selectedFile, messages])

  // Open vault
  // Save AI message to vault
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleSaveAIMessage = useCallback(async (content: string) => {
    if (!vaultPath) return
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    try {
      await (window.api).createFolder?.('0-收集/AI对话')
      const title = content.split('\n')[0].slice(0, 40).replace(/[#*`\[\]]/g, '')
      const md = `---\ntitle: "${title || 'AI 对话'}"\ntype: note\nsource: ai-chat\ncreated: ${new Date().toISOString().slice(0, 10)}\ntags: [ai-chat]\n---\n\n${content}`
      const filePath = `0-收集/AI对话/ai-${timestamp}.md`
      await window.api.saveFile(filePath, md)
      showToast('success', 'AI 回复已保存到知识库')
    } catch {
      showToast('error', '保存失败')
    }
  }, [vaultPath])

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleOpenVault = useCallback(async () => {
    const path = await window.api.openVault()
    if (path) {
      setVaultPath(path)
      const fileList = await window.api.listFiles()
      setFiles(fileList)
      showToast('success', '知识库已打开')
    }
  }, [])

  // Select file
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleSelectFile = useCallback(async (filePath: string) => {
    if (selectedFile && isDirty) {
      await window.api.saveFile(selectedFile, content).catch?.(() => {})
    }

    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const isMarkdown = ['md', 'markdown', 'mdown', 'mkd'].includes(ext)

    if (!isMarkdown) {
      // Native preview for non-markdown files
      const preview = await (window.api).renderFile?.(filePath)
      setNativePreview(preview ?? { type: 'unsupported' })
      setIsNativePreview(true)
      setSelectedFile(filePath)
      setContent('')
      setIsDirty(false)
      setSearchQuery('')
      setShowSearchResults(false)
      return
    }

    // Regular markdown file
    let fileContent = ''
    try {
      fileContent = await window.api.readFile(filePath)
    } catch (err) {
      // Check code on error itself or nested cause (Node.js fs errors may lose code across IPC)
      const code = (err as any)?.code ?? (err as any)?.cause?.code
      const msg = (err as any)?.message ?? String(err)
      if (code === 'ENOENT' || msg.includes('ENOENT') || msg.includes('no such file')) {
        log.warn('[FileTree] file no longer exists, skipping:', filePath)
        return
      }
      throw err
    }
    setNativePreview(null)
    setIsNativePreview(false)
    setSelectedFile(filePath)
    setContent(fileContent)
    setIsDirty(false)
    setSearchQuery('')
    setShowSearchResults(false)
  }, [selectedFile, isDirty, content])

  // Search
  // eslint-disable-next-line react-hooks/rules-of-hooks
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
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleCloseSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }, [])

  // Save file
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleSave = useCallback(async () => {
    if (selectedFile) {
      await window.api.saveFile(selectedFile, content).catch?.(() => {})
      setIsDirty(false)
      showToast('success', '文件已保存')
    }
  }, [selectedFile, content])

  // Create new file
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleNewFile = useCallback(async (folderPath: string, fileName: string) => {
    // If folderPath is the vault itself, use empty string (root)
    const base = (folderPath === vaultPath || !folderPath) ? '' : folderPath
    const filePath = `${base}/${fileName}.md`
    await window.api.saveFile(filePath, `# ${fileName}\n\n`)
    const fileList = await window.api.listFiles()
    setFiles(fileList)
    setSelectedFile(filePath)
    setContent(`# ${fileName}\n\n`)
    setIsDirty(false)
  }, [])

  // Create folder
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleNewFolder = useCallback(async (parentPath: string, folderName: string) => {
    const base = (parentPath === vaultPath || !parentPath) ? '' : parentPath
    const folderPath = `${base}/${folderName}`
    await window.api.createFolder(folderPath)
    const fileList = await window.api.listFiles()
    setFiles(fileList)
  }, [])

  // Refresh file list
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleRefresh = useCallback(async () => {
    const fileList = await window.api.listFiles()
    setFiles(fileList)
  }, [])

  // Content change
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    setIsDirty(true)
  }, [])

  // Auto-save before close
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (selectedFile && isDirty) {
        void window.api.saveFile(selectedFile, content).catch?.(() => {})
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [selectedFile, isDirty, content])

  // Track recent files
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!selectedFile) return
    const name = selectedFile.split('/').pop() ?? selectedFile
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.path !== selectedFile)
      return [{ path: selectedFile, name }, ...filtered].slice(0, 8)
    })
  }, [selectedFile])

  // Auto-restore last vault on startup
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    ;(async () => {
      try {
        const lastPath = await (window.api).getLastVault?.()
        if (lastPath) {
          setVaultPath(lastPath)
          const fileList = await window.api.listFiles()
          setFiles(fileList)
        }
      } catch { /* first launch, show welcome */ }
    })().catch(() => {})
  }, [])

  // Refresh file list after import
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!window.api) return
    return window.api.onImportCompleted?.(async () => {
      const fileList = await window.api.listFiles()
      setFiles(fileList)
      showToast('success', '文件导入成功')
    })
  }, [])

  // Cmd+P Quick Switch + Cmd+F search + Cmd+D dark mode
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        if (vaultPath) setShowQuickSwitch(v => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && vaultPath) {
        // Only focus sidebar search if editor is not focused
        if (!(document.activeElement?.closest('.cm-editor') || document.activeElement?.closest('.cm-content'))) {
          ;(document.querySelector('.search-input') as HTMLInputElement)?.focus()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        const html = document.documentElement
        const current = html.getAttribute('data-theme')
        const next = current === 'dark' ? '' : 'dark'
        if (next) html.setAttribute('data-theme', next)
        else html.removeAttribute('data-theme')
        localStorage.setItem('theme', next || 'light')
      }
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        setShowShortcuts(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [vaultPath])

  // Restore theme on mount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  // Global shortcut Cmd+Shift+F → Quick Switch
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    return (window.api).onQuickSwitch?.(() => {
      if (vaultPath) setShowQuickSwitch(true)
    })
  }, [vaultPath])

  // Global shortcut Cmd+Shift+I → Import panel
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    return (window.api).onGotoImport?.(() => {
      window.location.hash = '#/import'
    })
  }, [])

  // Display files (search results or all files)
  const displayFiles = showSearchResults ? searchResults : files

  return (
    <div className="app-container" style={{ background: '#f5f5f5' }}>
      {showQuickSwitch && (
        <QuickSwitch
          files={files}
          recentFiles={recentFiles}
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
      {showShortcuts && (
        <ShortcutGuide onClose={() => setShowShortcuts(false)} />
      )}

      {!vaultPath ? (
        <WelcomeScreen onOpenVault={() => void handleOpenVault()} onNewVault={() => void handleNewVault()} />
      ) : (
        <>
          <div className="sidebar">
            <div className="sidebar-header">
              <FolderOpen size={16} style={{ color: 'var(--color-text-tertiary)' }} />
              <span
                className="sidebar-title sidebar-title-btn"
                onClick={() => setShowVaultMenu(v => !v)}
                title="点击切换知识库"
              >
                {vaultPath?.split('/').pop()}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, opacity: 0.5 }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </div>

            {/* Vault switch menu */}
            {showVaultMenu && (
              <div className="vault-menu">
                <div className="vault-menu-header">知识库操作</div>
                <div className="vault-menu-item" onClick={() => { setShowVaultMenu(false); void handleNewVault().catch?.(() => {}) }}>
                  <FolderPlus size={13} />
                  新建知识库
                </div>
                <div className="vault-menu-item" onClick={() => { setShowVaultMenu(false); void handleOpenVault().catch?.(() => {}) }}>
                  <FolderOpen size={13} />
                  打开其他知识库
                </div>
                <div className="vault-menu-item danger" onClick={() => {
                  ;(async () => {
                    setShowVaultMenu(false)
                    setVaultPath(null)
                    setFiles([])
                    setSelectedFile(null)
                    setContent('')
                    await (window.api).clearLastVault?.()
                  })().catch(() => {})
                }}>
                  <span>✕</span>
                  关闭当前知识库
                </div>
              </div>
            )}
            <div className="search-container">
              <div className="search-wrapper">
                <Search className="search-icon" size={14} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="搜索文件..."
                  value={searchQuery}
                  onChange={e => { void handleSearch(e.target.value) }}
                />
              </div>
            </div>
            
            {showSearchResults ? (
              <SearchResults
                results={searchResults}
                query={searchQuery}
                onSelect={(path) => { void handleSelectFile(path) }}
                onClose={handleCloseSearch}
              />
            ) : (
              <>
                <Toolbar
                  onNewFile={(p, n) => { void handleNewFile(p, n) }}
                  onNewFolder={(p, n) => { void handleNewFolder(p, n) }}
                  onOpenGraph={() => setShowGraph(true)}
                  onOpenSettings={() => {}}
                  onRefresh={() => { void handleRefresh() }}
                  vaultPath={vaultPath}
                  files={files}
                />
                <div className="file-tree">
                  <FileTree
                    files={displayFiles}
                    selectedFile={selectedFile}
                    onSelect={(path) => { void handleSelectFile(path) }}
                    onNewFile={(folderPath) => {
                      const base = (folderPath === vaultPath || !folderPath) ? '' : folderPath
                      const name = `Untitled`
                      void handleNewFile(base, name).catch?.(() => {})
                    }}
                    onNewFolder={(parentPath) => {
                      const base = (parentPath === vaultPath || !parentPath) ? '' : parentPath
                      void handleNewFolder(base, 'Untitled').catch?.(() => {})
                    }}
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
                      <button className="btn" onClick={() => { void handleSave() }}>保存</button>
                    </div>
                  </div>
                  <Editor
                    value={content}
                    onChange={handleContentChange}
                    nativePreview={nativePreview}
                    isNativePreview={isNativePreview}
                    onReference={handleReference}
                  />
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
            onSend={text => { void handleSendMessage(text) }}
            loading={chatLoading}
            onLoadSession={(sessionId: string) => {
              void (async () => {
                                const msgs = await api.chatLoad?.(sessionId) ?? []
                setMessages(msgs.map((m: any) => ({
                  id: m.id ?? crypto.randomUUID(),
                  role: m.role,
                  content: m.content,
                })))
              })()
            }}
            onSaveToVault={(msgId: string) => {
              void (async () => {
                const msg = messages.find((m: any) => m.id === msgId || m.id === undefined)
                if (msg) await handleSaveAIMessage(msg.content)
              })()
            }}
            onNavigateToPage={(filePath: string) => {
              // Try exact path first, then search by filename
              const exact = files.find(f => f.path === filePath)
              if (exact) {
                void handleSelectFile(filePath).catch?.(() => {})
              } else {
                // Search by filename
                const name = filePath.split('/').pop() ?? filePath
                const found = files.find(f => f.name === name || f.path?.endsWith(name))
                if (found) void handleSelectFile(found.path).catch?.(() => {})
              }
            }}
            onInsertToDoc={!isNativePreview && selectedFile ? ((aiContent: string) => {
              const separator = '\n\n---\n\n'
              const newContent = content + (content ? separator : '') + aiContent
              setContent(newContent)
              setIsDirty(true)
              showToast('success', '已插入到文档')
            }) : undefined}
          />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </>
      )}
    </div>
  )
}

export default App
