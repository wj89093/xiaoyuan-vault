import type { ImportFileResult } from './chat'
// Type declarations for window.api (mirrors preload/index.ts API surface)
// This eliminates no-unsafe-* errors when calling window.api methods

export interface FileInfo {
  path: string
  name: string
  isDirectory: boolean
  modified: number
  children?: FileInfo[]
  title?: string
  tags?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pagesUsed?: Array<{ file: string; title: string }>
  sourceMode?: 'knowledge_base' | 'mixed' | 'ai_only'
  saved?: boolean
  timestamp?: number
}

export interface ChatSession {
  id: string
  title: string
  updatedAt: string
  createdAt?: number
}

export interface AskResult {
  answer: string
  sources: Array<{ file: string; title: string; snippet: string }>
  confidence: number
}

export interface AskStreamChunk {
  chunk: string
  partial: string
}

export interface URLFetchResult {
  title: string
  content: string
  author?: string
  date?: string
  url: string
  source: string
}

export interface ConvertResult {
  success: boolean
  markdown?: string
  error?: string
}

export interface TranscribeResult {
  success: boolean
  text?: string
  error?: string
}

export interface BubbleSaveResult {
  ok: boolean
  error?: string
}

export interface GraphLoadResult {
  nodes: number
  edges: number
  // Add more fields as needed
}

export interface AuthTokenReceived {
  token: string
  email: string
}

export interface StreamChunkData {
  chunk: string
  partial: string
}

export interface StreamErrorData {
  error: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface AutoAISettings {}

export interface EnrichResult {
  // Define based on actual enrich result shape
  [key: string]: unknown
}

export interface QueryResult {
  // Define based on actual query result shape
  [key: string]: unknown
}

// The full window.api type
export interface XyVaultAPI {
  // Lifecycle
  onImportCompleted(callback: () => void): () => void
  onQuickSwitch(callback: () => void): () => void
  onGotoImport(callback: () => void): () => void

  // URL operations
  fetchURL(url: string): Promise<URLFetchResult>
  saveURLToVault(url: string, vaultPath: string): Promise<string>

  // Vault operations
  openVault(): Promise<string | null>
  createVault(): Promise<string | null>
  getLastVault(): Promise<string | null>
  clearLastVault(): Promise<boolean>
  importFiles(vaultPath: string, filePaths: string[]): Promise<ImportFileResult[]>
  fetchUrl(url: string): Promise<{ title: string; content: string }>
  getAutoAISettings(): Promise<AutoAISettings>
  saveAutoAISettings(settings: AutoAISettings): Promise<boolean>
  convertFile(filePath: string): Promise<ConvertResult>
  getSupportedFormats(): Promise<string[]>
  transcribeAudio(filePath: string): Promise<TranscribeResult>
  saveUrlContent(vaultPath: string, title: string, content: string): Promise<string>

  // File operations
  listFiles(): Promise<FileInfo[]>
  searchFiles(query: string): Promise<FileInfo[]>
  readFile(filePath: string): Promise<string>
  renderFile(filePath: string): Promise<{ type: string; [key: string]: unknown }>
  createFile(filePath: string, title: string, type?: string): Promise<boolean>
  saveFile(filePath: string, content: string): Promise<boolean>
  createFolder(folderPath: string): Promise<boolean>
  renameFile(oldPath: string, newName: string): Promise<boolean>
  deleteFile(filePath: string): Promise<boolean>
  deleteFolder(folderPath: string): Promise<boolean>
  moveFile(filePath: string, newParentDir: string): Promise<boolean>
  getVaultPath(): Promise<string | null>

  // Clipboard watch
  clipboardStart(vaultPath: string): Promise<boolean>
  clipboardStop(): Promise<boolean>
  clipboardSetVaultPath(vaultPath: string): Promise<boolean>

  // AI operations
  aiClassify(content: string, folders: string[]): Promise<string>
  aiTags(content: string): Promise<string[]>
  aiSummary(content: string): Promise<string>
  aiReason(question: string, context: string[]): Promise<string>
  aiWrite(outline: string): Promise<string>
  chatAsk(question: string, history?: ChatMessage[]): Promise<AskResult>
  chatAskStream(question: string, history?: ChatMessage[]): Promise<AskResult>
  onChatStreamChunk(callback: (data: StreamChunkData) => void): () => void
  onChatStreamDone(callback: (data: AskResult) => void): () => void
  onChatStreamError(callback: (data: StreamErrorData) => void): () => void
  chatSessions(): Promise<ChatSession[]>
  chatCreate(firstQuestion: string): Promise<ChatSession>
  chatLoad(sessionId: string): Promise<ChatMessage[]>
  chatSave(sessionId: string, messages: ChatMessage[]): Promise<boolean>
  chatDelete(sessionId: string): Promise<boolean>
  resolveContent(content: string, title?: string): Promise<unknown>
  enrichFile(filePath: string): Promise<unknown>
  enrichInbox(): Promise<unknown[]>
  enrichConfirm(filePath: string, type: string, folder?: string): Promise<unknown>
  openImportWindow(): Promise<boolean>
  queryVault(question: string): Promise<unknown>

  // Auth
  authGetToken(): Promise<string | null>
  authGetEmail(): Promise<string | null>
  authClear(): Promise<boolean>
  authOpenLogin(): Promise<string>
  onAuthTokenReceived(callback: (data: AuthTokenReceived) => void): () => void

  // Provider
  providerGet(): Promise<string>
  providerSet(provider: string): Promise<boolean>

  // Folder map
  folderMapLoad(): Promise<Record<string, string>>
  folderMapSave(map: Record<string, string>): Promise<boolean>

  // Graph
  graphLoad(): Promise<unknown>
  graphRebuild(): Promise<GraphLoadResult>

  // Maintenance
  runMaintenance(): Promise<unknown>

  // Bubble window controls
  bubbleExpand(): void
  bubbleMove(dx: number, dy: number): void
  bubbleDrop(data: unknown): void
  bubbleSave(data: { files: string[]; text: string }): Promise<BubbleSaveResult>
}

declare global {
  interface Window {
    api: XyVaultAPI
  }
}