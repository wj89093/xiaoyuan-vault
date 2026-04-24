import { contextBridge, ipcRenderer } from 'electron'

// Expose API to renderer
const api = {
  // Vault operations
  openVault: (): Promise<string | null> => ipcRenderer.invoke('vault:open'),

  // File operations
  listFiles: (): Promise<FileInfo[]> => ipcRenderer.invoke('file:list'),
  searchFiles: (query: string): Promise<FileInfo[]> => ipcRenderer.invoke('file:search', query),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:read', filePath),
  saveFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('file:save', filePath, content),
  createFolder: (folderPath: string): Promise<boolean> =>
    ipcRenderer.invoke('folder:create', folderPath),

  // AI operations
  aiClassify: (content: string, folders: string[]): Promise<string> =>
    ipcRenderer.invoke('ai:classify', content, folders),
  aiTags: (content: string): Promise<string[]> => ipcRenderer.invoke('ai:tags', content),
  aiSummary: (content: string): Promise<string> => ipcRenderer.invoke('ai:summary', content),
  aiReason: (question: string, context: string[]): Promise<string> =>
    ipcRenderer.invoke('ai:reason', question, context),
  aiWrite: (outline: string): Promise<string> => ipcRenderer.invoke('ai:write', outline)
}

export type FileInfo = {
  path: string
  name: string
  isDirectory: boolean
  modified: number
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
