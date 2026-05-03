/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, react-hooks/exhaustive-deps */
import { useState, useCallback, useEffect } from 'react'
import type { FileInfo } from '../types'
import { showToast } from '../components/Toast'

export interface VaultState {
  vaultPath: string | null
  files: FileInfo[]
  selectedFile: string | null
  content: string
  isDirty: boolean
  searchQuery: string
  searchResults: FileInfo[]
  showSearchResults: boolean
  nativePreview: { path: string; content: string } | null
  isNativePreview: boolean
  recentFiles: Array<{ path: string; name: string }>
  // Setters
  setVaultPath: (v: string | null) => void
  setFiles: (f: FileInfo[]) => void
  setSelectedFile: (f: string | null) => void
  setContent: (c: string) => void
  setIsDirty: (d: boolean) => void
  setNativePreview: (p: { path: string; content: string } | null) => void
  setIsNativePreview: (v: boolean) => void
  setShowSearchResults: (v: boolean) => void
  // Actions
  handleNewVault: () => Promise<void>
  handleOpenVault: () => Promise<void>
  handleSelectFile: (filePath: string) => Promise<void>
  handleSave: () => Promise<void>
  handleNewFile: (folderPath: string, fileName: string) => Promise<void>
  handleNewFolder: (parentPath: string, folderName: string) => Promise<void>
  handleRefresh: () => Promise<void>
  handleSearch: (query: string) => Promise<void>
  handleCloseSearch: () => void
  handleContentChange: (value: string) => void
  handleSaveAIMessage: (content: string) => Promise<void>
}

export function useVaultState() {
  /* eslint-disable react-hooks/set-state-in-effect */
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileInfo[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [nativePreview, setNativePreview] = useState<{ path: string; content: string } | null>(null)
  const [isNativePreview, setIsNativePreview] = useState(false)
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; name: string }>>([])

  const handleNewVault = useCallback(async () => {
    const path = await api.openVault()
    if (path) {
      setVaultPath(path)
      const fileList = await api.listFiles()
      setFiles(fileList)
      showToast('success', '知识库已创建并打开')
    }
  }, [])

  const handleOpenVault = useCallback(async () => {
    const path = await api.openVault()
    if (path) {
      setVaultPath(path)
      const fileList = await api.listFiles()
      setFiles(fileList)
      showToast('success', '知识库已打开')
    }
  }, [])

  const handleSelectFile = useCallback(async (filePath: string) => {
    if (selectedFile && isDirty) {
      await api.saveFile(selectedFile, content).catch?.(() => {})
    }
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const isMarkdown = ['md', 'markdown', 'mdown', 'mkd'].includes(ext)
    if (!isMarkdown) {
      const preview = await api.renderFile?.(filePath)
      setNativePreview(preview ?? { type: 'unsupported' } as any)
      setIsNativePreview(true)
      setSelectedFile(filePath)
      setContent('')
      setIsDirty(false)
      setSearchQuery('')
      setShowSearchResults(false)
      return
    }
    let fileContent = ''
    try {
      fileContent = await api.readFile(filePath)
    } catch (err: any) {
      const code = err?.code ?? err?.cause?.code
      const msg = err?.message ?? String(err)
      if (code === 'ENOENT' || msg.includes('ENOENT') || msg.includes('no such file')) return
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

  const handleSave = useCallback(async () => {
    if (selectedFile) {
      await api.saveFile(selectedFile, content).catch?.(() => {})
      setIsDirty(false)
      showToast('success', '文件已保存')
    }
  }, [selectedFile, content])

  const handleNewFile = useCallback(async (folderPath: string, fileName: string) => {
    const base = (folderPath === vaultPath || !folderPath) ? '' : folderPath
    const filePath = `${base}/${fileName}.md`
    await api.saveFile(filePath, `# ${fileName}\n\n`)
    const fileList = await api.listFiles()
    setFiles(fileList)
    setSelectedFile(filePath)
    setContent(`# ${fileName}\n\n`)
    setIsDirty(false)
  }, [vaultPath])

  const handleNewFolder = useCallback(async (parentPath: string, folderName: string) => {
    const base = (parentPath === vaultPath || !parentPath) ? '' : parentPath
    const folderPath = `${base}/${folderName}`
    await api.createFolder(folderPath)
    const fileList = await api.listFiles()
    setFiles(fileList)
  }, [vaultPath])

  const handleRefresh = useCallback(async () => {
    const fileList = await api.listFiles()
    setFiles(fileList)
  }, [])

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      const results = await api.searchFiles(query)
      setSearchResults(results)
      setShowSearchResults(true)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }, [])

  const handleCloseSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }, [])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    setIsDirty(true)
  }, [])

  const handleSaveAIMessage = useCallback(async (content: string) => {
    if (!vaultPath) return
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    try {
      await api.createFolder?.('0-收集/AI对话')
      const title = content.split('\n')[0].slice(0, 40).replace(/[#*`\[\]]/g, '')
      const md = `---\ntitle: "${title || 'AI 对话'}"\ntype: note\nsource: ai-chat\ncreated: ${new Date().toISOString().slice(0, 10)}\ntags: [ai-chat]\n---\n\n${content}`
      const filePath = `0-收集/AI对话/ai-${timestamp}.md`
      await api.saveFile(filePath, md)
      showToast('success', 'AI 回复已保存到知识库')
    } catch {
      showToast('error', '保存失败')
    }
  }, [vaultPath])

  // Auto-save before close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (selectedFile && isDirty) {
        void api.saveFile(selectedFile, content).catch?.(() => {})
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [selectedFile, isDirty, content])

  // Track recent files
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!selectedFile) return
    const name = selectedFile.split('/').pop() ?? selectedFile
    setRecentFiles(prev => {
      const filtered = prev.filter(f => f.path !== selectedFile)
      return [{ path: selectedFile, name }, ...filtered].slice(0, 8)
    })
  }, [selectedFile])

  // Auto-restore last vault on startup
  useEffect(() => {
    ;(async () => {
      try {
        const lastPath = await api.getLastVault?.()
        if (lastPath) {
          setVaultPath(lastPath)
          const fileList = await api.listFiles()
          setFiles(fileList)
        }
      } catch { /* first launch, show welcome */ }
    })().catch(() => {})
  }, [])

  return {
    vaultPath, files, selectedFile, content, isDirty,
    searchQuery, searchResults, showSearchResults,
    nativePreview, isNativePreview, recentFiles,
    setVaultPath, setFiles, setSelectedFile, setContent, setIsDirty,
    setNativePreview, setIsNativePreview, setShowSearchResults,
    handleNewVault, handleOpenVault, handleSelectFile,
    handleSave, handleNewFile, handleNewFolder, handleRefresh,
    handleSearch, handleCloseSearch, handleContentChange,
    handleSaveAIMessage,
  }
}