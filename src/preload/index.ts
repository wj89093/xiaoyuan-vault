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

  onQuickSwitch: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on("shortcut:quick-switch", handler)
    return () => ipcRenderer.removeListener("shortcut:quick-switch", handler)
  },
  onGotoImport: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on("shortcut:goto-import", handler)
    return () => ipcRenderer.removeListener("shortcut:goto-import", handler)
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
  renderFile: (filePath: string): Promise<{ type: string; [key: string]: any }> =>
    ipcRenderer.invoke('file:render', filePath),
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
  moveFile: (filePath: string, newParentDir: string): Promise<boolean> =>
    ipcRenderer.invoke('file:move', filePath, newParentDir),
  getVaultPath: (): Promise<string | null> =>
    ipcRenderer.invoke('vault:path'),

  // Clipboard watch
  clipboardStart: (vaultPath: string): Promise<boolean> =>
    ipcRenderer.invoke('clipboard:start', vaultPath),
  clipboardStop: (): Promise<boolean> =>
    ipcRenderer.invoke('clipboard:stop'),
  clipboardSetVaultPath: (vaultPath: string): Promise<boolean> =>
    ipcRenderer.invoke('clipboard:setVaultPath', vaultPath),

  // AI operations
  aiClassify: (content: string, folders: string[]): Promise<string> =>
    ipcRenderer.invoke('ai:classify', content, folders),
  aiTags: (content: string): Promise<string[]> => ipcRenderer.invoke('ai:tags', content),
  aiSummary: (content: string): Promise<string> => ipcRenderer.invoke('ai:summary', content),
  aiReason: (question: string, context: string[]): Promise<string> =>
    ipcRenderer.invoke('ai:reason', question, context),
  aiWrite: (outline: string): Promise<string> => ipcRenderer.invoke('ai:write', outline),
  chatAsk: (question: string, history?: any[]): Promise<any> =>
    ipcRenderer.invoke('chat:ask', question, history || []),
  chatAskStream: (question: string, history?: any[]) =>
    ipcRenderer.invoke('chat:askStream', question, history || []),
  onChatStreamChunk: (callback: (data: { chunk: string; partial: string }) => void) => {
    const sub = (_: any, data: any) => callback(data)
    ipcRenderer.on('chat:streamChunk', sub)
    return () => ipcRenderer.removeListener('chat:streamChunk', sub)
  },
  onChatStreamDone: (callback: (data: { answer: string; sources: any[]; confidence: number }) => void) => {
    const sub = (_: any, data: any) => callback(data)
    ipcRenderer.on('chat:streamDone', sub)
    return () => ipcRenderer.removeListener('chat:streamDone', sub)
  },
  onChatStreamError: (callback: (data: { error: string }) => void) => {
    const sub = (_: any, data: any) => callback(data)
    ipcRenderer.on('chat:streamError', sub)
    return () => ipcRenderer.removeListener('chat:streamError', sub)
  },
  chatSessions: (): Promise<any[]> =>
    ipcRenderer.invoke('chat:sessions'),
  chatCreate: (firstQuestion: string): Promise<any> =>
    ipcRenderer.invoke('chat:create', firstQuestion),
  chatLoad: (sessionId: string): Promise<any[]> =>
    ipcRenderer.invoke('chat:load', sessionId),
  chatSave: (sessionId: string, messages: any[]): Promise<boolean> =>
    ipcRenderer.invoke('chat:save', sessionId, messages),
  chatDelete: (sessionId: string): Promise<boolean> =>
    ipcRenderer.invoke('chat:delete', sessionId),
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

  providerGet: (): Promise<string> =>
    ipcRenderer.invoke('provider:get'),
  providerSet: (provider: string): Promise<boolean> =>
    ipcRenderer.invoke('provider:set', provider),

  folderMapLoad: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke('folderMap:load'),
  folderMapSave: (map: Record<string, string>): Promise<boolean> =>
    ipcRenderer.invoke('folderMap:save', map),
  graphLoad: (): Promise<any> =>
    ipcRenderer.invoke('graph:load'),
  graphRebuild: (): Promise<{nodes: number; edges: number}> =>
    ipcRenderer.invoke('graph:rebuild'),

  runMaintenance: (): Promise<any> =>
    ipcRenderer.invoke('maintain:run'),

  // Bubble window controls
  bubbleExpand: (): void => { ipcRenderer.send('bubble:expand') },
  bubbleMove: (dx: number, dy: number): void => { ipcRenderer.send('bubble:move', dx, dy) },
  bubbleDrop: (data: any): void => { ipcRenderer.send('bubble:drop', data) },
  bubbleSave: (data: { files: string[]; text: string }): Promise<{ok: boolean; error?: string}> =>
    ipcRenderer.invoke('bubble:save', data),
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
