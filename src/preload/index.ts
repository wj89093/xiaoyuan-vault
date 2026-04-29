import { contextBridge, ipcRenderer } from 'electron'

export type FileInfo = {
  path: string
  name: string
  isDirectory: boolean
  modified: number
  children?: FileInfo[]
  title?: string
  tags?: string
}

// Expose API to renderer
const api = {
  onImportCompleted: (callback: () => void) => {
    ipcRenderer.on('import:completed', callback)
    return () => ipcRenderer.removeListener('import:completed', callback)
  },
  // URL operations
  fetchURL: (url: string): Promise<{ title: string; content: string; author?: string; date?: string; url: string; source: string }> =>
    ipcRenderer.invoke('url:fetch', url),
  saveURLToVault: (url: string, vaultPath: string): Promise<string> =>
    ipcRenderer.invoke('url:save', url, vaultPath),

  // Vault operations
  openVault: (): Promise<string | null> => ipcRenderer.invoke('vault:open'),
  createVault: (): Promise<string | null> => ipcRenderer.invoke('vault:create'),
  getLastVault: (): Promise<string | null> => ipcRenderer.invoke('vault:getLast'),
  clearLastVault: (): Promise<boolean> => ipcRenderer.invoke('vault:clear'),
  importFiles: (vaultPath: string, filePaths: string[]): Promise<any[]> =>
    ipcRenderer.invoke('file:import', vaultPath, filePaths),
  fetchUrl: (url: string): Promise<{ title: string; content: string }> =>
    ipcRenderer.invoke('import:fetchUrl', url),
  getAutoAISettings: (): Promise<any> => ipcRenderer.invoke('autoAI:get'),
  saveAutoAISettings: (settings: any): Promise<boolean> => ipcRenderer.invoke('autoAI:save', settings),
  convertFile: (filePath: string): Promise<{success: boolean; markdown?: string; error?: string}> =>
    ipcRenderer.invoke('converter:convert', filePath),
  getSupportedFormats: (): Promise<string[]> =>
    ipcRenderer.invoke('converter:supported'),
  transcribeAudio: (filePath: string): Promise<{success: boolean; text?: string; error?: string}> =>
    ipcRenderer.invoke('converter:transcribe', filePath),
  saveUrlContent: (vaultPath: string, title: string, content: string): Promise<string> =>
    ipcRenderer.invoke('import:saveUrl', vaultPath, title, content),

  // File operations
  listFiles: (): Promise<FileInfo[]> => ipcRenderer.invoke('file:list'),
  searchFiles: (query: string): Promise<FileInfo[]> => ipcRenderer.invoke('file:search', query),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('file:read', filePath),
  createFile: (filePath: string, title: string, type?: string): Promise<boolean> =>
    ipcRenderer.invoke('file:create', filePath, title, type),
  saveFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('file:save', filePath, content),
  createFolder: (folderPath: string): Promise<boolean> =>
    ipcRenderer.invoke('folder:create', folderPath),
  renameFile: (oldPath: string, newName: string): Promise<boolean> =>
    ipcRenderer.invoke('file:rename', oldPath, newName),
  deleteFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:delete', filePath),
  deleteFolder: (folderPath: string): Promise<boolean> =>
    ipcRenderer.invoke('folder:delete', folderPath),

  // AI operations
  aiClassify: (content: string, folders: string[]): Promise<string> =>
    ipcRenderer.invoke('ai:classify', content, folders),
  aiTags: (content: string): Promise<string[]> => ipcRenderer.invoke('ai:tags', content),
  aiSummary: (content: string): Promise<string> => ipcRenderer.invoke('ai:summary', content),
  aiReason: (question: string, context: string[]): Promise<string> =>
    ipcRenderer.invoke('ai:reason', question, context),
  aiWrite: (outline: string): Promise<string> => ipcRenderer.invoke('ai:write', outline),
  resolveContent: (content: string, title?: string): Promise<any> =>
    ipcRenderer.invoke('resolver:classify', content, title),
  enrichFile: (filePath: string): Promise<any> =>
    ipcRenderer.invoke('enrich:file', filePath),
  enrichInbox: (): Promise<any[]> =>
    ipcRenderer.invoke('enrich:inbox'),
  enrichConfirm: (filePath: string, type: string, folder?: string): Promise<any> =>
    ipcRenderer.invoke('enrich:confirm', filePath, type, folder),
  openImportWindow: (): Promise<boolean> =>
    ipcRenderer.invoke('import:open'),
  queryVault: (question: string): Promise<any> =>
    ipcRenderer.invoke('query:vault', question),
  runMaintenance: (): Promise<any> =>
    ipcRenderer.invoke('maintain:run')
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
