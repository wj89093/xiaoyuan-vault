import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { FileInfo } from '../types'
import { showToast } from '../components/Toast'

interface VaultContextType {
  vaultPath: string | null
  files: FileInfo[]
  selectedFile: string | null
  content: string
  isDirty: boolean
  setVaultPath: (path: string | null) => void
  setFiles: (files: FileInfo[]) => void
  setSelectedFile: (path: string | null) => void
  setContent: (content: string) => void
  setIsDirty: (dirty: boolean) => void
  // Actions
  handleNewVault: () => Promise<void>
  handleOpenVault: () => Promise<void>
  handleSelectFile: (filePath: string) => Promise<void>
  handleNewFile: (folderPath: string, fileName: string) => Promise<void>
  handleNewFolder: (parentPath: string, folderName: string) => Promise<void>
  handleRefresh: () => Promise<void>
  handleSave: () => Promise<void>
  handleContentChange: (value: string) => void
  handleSearch: (query: string) => Promise<void>
  handleCloseSearch: () => void
  // State refs for callbacks
  getSelectedFile: () => string | null
  getContent: () => string
  getIsDirty: () => boolean
}

const VaultContext = createContext<VaultContextType | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [content, setContent] = useState<string>('')
  const [isDirty, setIsDirty] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileInfo[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)

  const getSelectedFile = useCallback(() => selectedFile, [selectedFile])
  const getContent = useCallback(() => content, [content])
  const getIsDirty = useCallback(() => isDirty, [isDirty])

  const handleNewVault = useCallback(async () => {
    const path = await window.api.openVault()
    if (path) {
      setVaultPath(path)
      const fileList = await window.api.listFiles()
      setFiles(fileList)
      showToast('success', '知识库已创建并打开')
    }
  }, [])

  const handleOpenVault = useCallback(async () => {
    const path = await window.api.openVault()
    if (path) {
      setVaultPath(path)
      const fileList = await window.api.listFiles()
      setFiles(fileList)
      showToast('success', '知识库已打开')
    }
  }, [])

  const handleSelectFile = useCallback(async (filePath: string) => {
    if (selectedFile && isDirty) {
      await window.api.saveFile(selectedFile, content).catch?.(() => {})
    }
    const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
    const isMarkdown = ['md', 'markdown', 'mdown', 'mkd'].includes(ext)
    if (!isMarkdown) {
      const preview = await window.api.renderFile?.(filePath)
      // setNativePreview/preview mode would be handled in the component
      setSelectedFile(filePath)
      setContent('')
      setIsDirty(false)
      setSearchQuery('')
      setShowSearchResults(false)
      return
    }
    let fileContent = ''
    try {
      fileContent = await window.api.readFile(filePath)
    } catch (err: any) {
      const code = err?.code ?? err?.cause?.code
      const msg = err?.message ?? String(err)
      if (code === 'ENOENT' || msg.includes('ENOENT') || msg.includes('no such file')) {
        return
      }
      throw err
    }
    setSelectedFile(filePath)
    setContent(fileContent)
    setIsDirty(false)
    setSearchQuery('')
    setShowSearchResults(false)
  }, [selectedFile, isDirty, content])

  const handleSave = useCallback(async () => {
    if (selectedFile) {
      await window.api.saveFile(selectedFile, content).catch?.(() => {})
      setIsDirty(false)
      showToast('success', '文件已保存')
    }
  }, [selectedFile, content])

  const handleNewFile = useCallback(async (folderPath: string, fileName: string) => {
    const base = (folderPath === vaultPath || !folderPath) ? '' : folderPath
    const filePath = `${base}/${fileName}.md`
    await window.api.saveFile(filePath, `# ${fileName}\n\n`)
    const fileList = await window.api.listFiles()
    setFiles(fileList)
    setSelectedFile(filePath)
    setContent(`# ${fileName}\n\n`)
    setIsDirty(false)
  }, [vaultPath])

  const handleNewFolder = useCallback(async (parentPath: string, folderName: string) => {
    const base = (parentPath === vaultPath || !parentPath) ? '' : parentPath
    const folderPath = `${base}/${folderName}`
    await window.api.createFolder(folderPath)
    const fileList = await window.api.listFiles()
    setFiles(fileList)
  }, [vaultPath])

  const handleRefresh = useCallback(async () => {
    const fileList = await window.api.listFiles()
    setFiles(fileList)
  }, [])

  const handleContentChange = useCallback((value: string) => {
    setContent(value)
    setIsDirty(true)
  }, [])

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

  const handleCloseSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setShowSearchResults(false)
  }, [])

  return (
    <VaultContext.Provider value={{
      vaultPath, files, selectedFile, content, isDirty,
      setVaultPath, setFiles, setSelectedFile, setContent, setIsDirty,
      handleNewVault, handleOpenVault, handleSelectFile,
      handleNewFile, handleNewFolder, handleRefresh,
      handleSave, handleContentChange, handleSearch, handleCloseSearch,
      getSelectedFile, getContent, getIsDirty,
    }}>
      {children}
    </VaultContext.Provider>
  )
}

export function useVault() {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within VaultProvider')
  return ctx
}