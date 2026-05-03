// ============ Shared Types (main ↔ renderer) ============

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
export interface ImportFileResult {
  name: string
  path: string
  status: 'ok' | 'error'
  error?: string
  converted?: boolean
  mdPath?: string
}
