/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, react-hooks/rules-of-hooks */
import { useState, useEffect, useCallback } from 'react'
import React from 'react'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { AIChat } from './components/AIChat'
import { WelcomeScreen } from './components/WelcomeScreen'
import { QuickSwitch } from './components/QuickSwitch'
import { KnowledgeGraph } from './components/KnowledgeGraph'
import { ToastContainer, useToasts, showToast } from './components/Toast'
import { ShortcutGuide } from './components/ShortcutGuide'
import { ImportApp } from './ImportApp'
import { useVaultState } from './hooks/useVaultState'
import { useChatSession } from './hooks/useChatSession'

function App(): JSX.Element {
  const hash = typeof window !== 'undefined' ? window.location.hash : ''
  if (hash === '#/import') {
    return <ImportApp />
  }

  const {
    vaultPath, files, selectedFile, content, isDirty,
    searchQuery, searchResults, showSearchResults,
    nativePreview, isNativePreview, recentFiles,
    setVaultPath, setFiles, setSelectedFile, setContent, setIsDirty,
    handleNewVault, handleOpenVault, handleSelectFile,
    handleSave, handleNewFile, handleNewFolder, handleRefresh,
    handleSearch, handleCloseSearch, handleContentChange,
    handleSaveAIMessage,
  } = useVaultState()

  const [showQuickSwitch, setShowQuickSwitch] = useState(false)
  const [showGraph, setShowGraph] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showVaultMenu, setShowVaultMenu] = useState(false)
  const { toasts, dismiss: dismissToast } = useToasts()

  // Chat state managed by useChatSession hook
  const {
    messages,
    chatLoading,
    handleSendMessage,
    handleLoadSession,
    handleSaveToVault,
  } = useChatSession(selectedFile, content)

  // Refresh file list after import
  useEffect(() => {
    if (!window.api) return
    return window.api.onImportCompleted?.(async () => {
      const fileList = await window.api.listFiles()
      setFiles(fileList)
      showToast('success', '文件导入成功')
    })
  }, [setFiles])

  // Cmd+P Quick Switch + Cmd+F search + Cmd+D dark mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        if (vaultPath) setShowQuickSwitch(v => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f' && vaultPath) {
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
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  }, [])

  // Global shortcut Cmd+Shift+F → Quick Switch
  useEffect(() => {
    return window.api.onQuickSwitch?.(() => {
      if (vaultPath) setShowQuickSwitch(true)
    })
  }, [vaultPath])

  // Global shortcut Cmd+Shift+I → Import panel
  useEffect(() => {
    return window.api.onGotoImport?.(() => {
      window.location.hash = '#/import'
    })
  }, [])

  // Display files (search results or all files)
  const displayFiles = showSearchResults ? searchResults : files

  // handleReference - not yet fully extracted, placeholder
  const handleReference = useCallback((_ref: any) => {}, [])

  return (
    <div className="app-container" style={{ background: '#f5f5f5' }}>
      {showQuickSwitch && (
        <QuickSwitch
          files={files}
          recentFiles={recentFiles}
          onSelect={(path: string) => { setSelectedFile(path); setShowQuickSwitch(false) }}
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
        <Sidebar
          vaultPath={vaultPath}
          files={files}
          displayFiles={displayFiles}
          selectedFile={selectedFile}
          showSearchResults={showSearchResults}
          searchQuery={searchQuery}
          searchResults={searchResults}
          showVaultMenu={showVaultMenu}
          onToggleVaultMenu={() => setShowVaultMenu(v => !v)}
          onNewVault={handleNewVault}
          onOpenVault={handleOpenVault}
          onCloseVault={async () => {
            setVaultPath(null)
            setFiles([])
            setSelectedFile(null)
            setContent('')
            await window.api.clearLastVault?.()
          }}
          onSearch={handleSearch}
          onCloseSearch={handleCloseSearch}
          onSelectFile={handleSelectFile}
          onNewFile={handleNewFile}
          onNewFolder={handleNewFolder}
          onRefresh={handleRefresh}
          onOpenGraph={() => setShowGraph(true)}
        />
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
            onLoadSession={handleLoadSession}
            onSaveToVault={(msgId: string) => {
              void handleSaveToVault(msgId, handleSaveAIMessage)
            }}
            onNavigateToPage={(filePath: string) => {
              const exact = files.find(f => f.path === filePath)
              if (exact) {
                void handleSelectFile(filePath).catch?.(() => {})
              } else {
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