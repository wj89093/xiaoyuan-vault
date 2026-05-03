/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, react-hooks/rules-of-hooks */
import { useEffect, useCallback } from 'react'
import React from 'react'
import { Sidebar } from './components/Sidebar'
import { EditorHeader } from './components/EditorHeader'
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
import { useAIInsert } from './hooks/useAIInsert'
import { useUIState } from './hooks/useUIState'
import { useKeyboardShortcuts, useGlobalShortcuts } from './hooks/useKeyboardShortcuts'

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

  const { toasts, dismiss: dismissToast } = useToasts()

  // UI state (quick switch, graph, shortcuts, vault menu)
  const {
    showQuickSwitch, setShowQuickSwitch,
    showGraph, setShowGraph,
    showShortcuts, setShowShortcuts,
    showVaultMenu, setShowVaultMenu,
  } = useUIState()

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

  // Keyboard shortcuts (Cmd+P/F/D, ?)
  useKeyboardShortcuts(vaultPath, setShowQuickSwitch, setShowShortcuts, showQuickSwitch, showShortcuts)

  // Global shortcuts (Cmd+Shift+F → Quick Switch, Cmd+Shift+I → Import)
  useGlobalShortcuts(vaultPath, setShowQuickSwitch)

  // Display files (search results or all files)
  const displayFiles = showSearchResults ? searchResults : files

  // handleReference - not yet fully extracted, placeholder
  const handleReference = useCallback((_ref: any) => {}, [])

  // AI insert/navigate hooks
  const { handleNavigateToPage, handleInsertToDoc } = useAIInsert(
    content, isNativePreview, selectedFile,
    setContent, setIsDirty, showToast,
    files, handleSelectFile,
  )

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
                  <EditorHeader
                    selectedFile={selectedFile}
                    isDirty={isDirty}
                    onSave={() => { void handleSave() }}
                  />
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
            onNavigateToPage={handleNavigateToPage}
            onInsertToDoc={handleInsertToDoc}
          />
          <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </>
      )}
    </div>
  )
}

export default App