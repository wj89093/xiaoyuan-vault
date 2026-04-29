import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User, Trash2, Plus, BookOpen, ExternalLink, ChevronLeft, Loader, MessageCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pagesUsed?: string[]  // 引用的页面 ID
  sourceMode?: 'knowledge_base' | 'mixed' | 'ai_only'
  saved?: boolean
}

export interface ChatSession {
  id: string
  title: string
  updatedAt: string
  messages: ChatMessage[]
}

interface AIChatProps {
  messages: ChatMessage[]
  onSend: (text: string) => void
  loading: boolean
  onSaveToVault?: (msgId: string) => Promise<void>
  onNavigateToPage?: (pageId: string) => void
}

export function AIChat({ messages, onSend, loading, onSaveToVault, onNavigateToPage }: AIChatProps): JSX.Element {
  const [input, setInput] = useState('')
  const [view, setView] = useState<'list' | 'chat'>('chat')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('default')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    if (!input.trim() || loading) return
    onSend(input.trim())
    setInput('')
  }

  const handleSave = async (msgId: string) => {
    if (!onSaveToVault || savedIds.has(msgId) || savingId === msgId) return
    setSavingId(msgId)
    try {
      await onSaveToVault(msgId)
      setSavedIds(prev => new Set(prev).add(msgId))
    } catch (e) {
      console.error('Save failed:', e)
    } finally {
      setSavingId(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Session management (mock for now)
  const startNewSession = () => {
    const newId = crypto.randomUUID()
    setActiveSessionId(newId)
    setView('chat')
  }

  return (
    <div className="ai-chat">
      <div className="ai-chat-header">
        {view === 'chat' ? (
          <>
            <div className="ai-chat-title">
              <Bot size={14} />
              <span>AI 对话</span>
            </div>
            <div className="ai-chat-actions">
              <button className="ai-chat-action-btn" onClick={startNewSession} title="新会话">
                <Plus size={13} />
              </button>
              {messages.length > 0 && (
                <button className="ai-chat-action-btn" onClick={() => setView('list')} title="历史会话">
                  <ChevronLeft size={13} />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <button className="ai-chat-back" onClick={() => setView('chat')}>
              <ChevronLeft size={14} />
              <span>返回对话</span>
            </button>
            <span className="ai-chat-subtitle">历史会话</span>
          </>
        )}
      </div>

      {view === 'list' ? (
        <div className="ai-chat-sessions">
          {sessions.length === 0 ? (
            <div className="ai-chat-empty">
              <MessageCircle size={32} />
              <p>暂无历史会话</p>
              <button className="btn btn-primary" onClick={startNewSession}>
                <Plus size={14} />
                开始新对话
              </button>
            </div>
          ) : (
            sessions.map(s => (
              <div key={s.id} className="ai-chat-session-item" onClick={() => { setActiveSessionId(s.id); setView('chat'); }}>
                <span className="ai-chat-session-title">{s.title || '未命名会话'}</span>
                <span className="ai-chat-session-date">{s.updatedAt?.slice(0, 10)}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="ai-chat-messages">
            {messages.length === 0 && (
              <div className="ai-chat-empty">
                <Bot size={32} />
                <p>向我提问，搜遍全库</p>
                <p className="ai-chat-empty-hint">AI 会根据知识库内容回答你的问题</p>
                <div className="ai-chat-examples">
                  <span className="ai-chat-example-label">试试这样问：</span>
                  <button className="ai-chat-example" onClick={() => onSend('总结一下最近收集的资料')}>
                    总结一下最近收集的资料
                  </button>
                  <button className="ai-chat-example" onClick={() => onSend('查找关于"合成生物学"的相关内容')}>
                    查找关于"合成生物学"的相关内容
                  </button>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`ai-chat-message ${msg.role}`}>
                <div className="ai-chat-avatar">
                  {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                </div>
                <div className="ai-chat-bubble">
                  {msg.role === 'assistant' && msg.sourceMode && (
                    <div className={`ai-chat-source-badge ${msg.sourceMode}`}>
                      {msg.sourceMode === 'knowledge_base' ? '基于知识库' :
                       msg.sourceMode === 'mixed' ? '混合来源' : 'AI 生成'}
                    </div>
                  )}
                  <div className="ai-chat-markdown">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => {
                          const isExternal = href?.startsWith('http')
                          return (
                            <a
                              href={href}
                              target={isExternal ? '_blank' : undefined}
                              rel={isExternal ? 'noopener noreferrer' : undefined}
                              onClick={(e) => {
                                if (!isExternal && href && onNavigateToPage) {
                                  e.preventDefault()
                                  onNavigateToPage(href.replace(/^\/?/, ''))
                                }
                              }}
                              className="ai-chat-link"
                            >
                              {children}
                              {isExternal && <ExternalLink size={10} />}
                            </a>
                          )
                        }
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Referenced pages */}
                  {msg.pagesUsed && msg.pagesUsed.length > 0 && (
                    <div className="ai-chat-refs">
                      <span className="ai-chat-refs-label">引用来源：</span>
                      {msg.pagesUsed.map((pageId, i) => (
                        <button
                          key={i}
                          className="ai-chat-ref"
                          onClick={() => onNavigateToPage?.(pageId)}
                        >
                          <BookOpen size={10} />
                          {pageId}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Save to vault button */}
                  {msg.role === 'assistant' && msg.sourceMode && msg.sourceMode !== 'ai_only' && onSaveToVault && (
                    <button
                      className="ai-chat-save"
                      onClick={() => handleSave(msg.id)}
                      disabled={savingId === msg.id || savedIds.has(msg.id)}
                    >
                      {savingId === msg.id ? (
                        <><Loader size={10} className="spin" /> 保存中...</>
                      ) : savedIds.has(msg.id) ? (
                        <><BookOpen size={10} /> 已保存到知识库</>
                      ) : (
                        <><BookOpen size={10} /> 保存到知识库</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-chat-message assistant">
                <div className="ai-chat-avatar"><Bot size={13} /></div>
                <div className="ai-chat-bubble">
                  <div className="ai-chat-thinking">
                    <Loader size={12} className="spin" />
                    思考中...
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="ai-chat-input-area">
            <textarea
              ref={inputRef}
              className="ai-chat-input"
              placeholder="输入问题，按 Enter 发送..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <button
              className="ai-chat-send"
              onClick={send}
              disabled={!input.trim() || loading}
            >
              <Send size={15} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
