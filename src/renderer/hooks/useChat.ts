/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, react-hooks/exhaustive-deps */
import { useCallback } from 'react'

export interface ChatMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  pagesUsed?: Array<{ file: string; title: string }>
  sourceMode?: 'knowledge_base' | 'file'
}

export function useChat(
  selectedFile: string | null,
  content: string,
  messages: ChatMessage[],
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  setChatLoading: (v: boolean) => void
) {
  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg = { role: 'user' as const, content: text }
    setMessages(prev => [...prev, userMsg])
    setChatLoading(true)

    try {
      if (selectedFile && content) {
        const historyContext = messages.slice(-4).map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n')
        const response = await api.aiReason(
          `对话历史:\n${historyContext}\n\n当前问题: ${text}`,
          [content]
        )
        setMessages(prev => [...prev, { role: 'assistant', content: response }])
      } else {
        const placeholderId = `stream-${Date.now()}`
        const placeholder = { id: placeholderId, role: 'assistant' as const, content: '正在思考...', pagesUsed: [] as Array<{ file: string; title: string }>, sourceMode: 'knowledge_base' as const }
        setMessages(prev => [...prev, placeholder])

        const history = messages.slice(-20).map((m: any) => ({ role: m.role, content: m.content }))

        let unsubChunk: (() => void) | undefined  // eslint-disable-line prefer-const
        let unsubDone: (() => void) | undefined  // eslint-disable-line prefer-const
        let unsubError: (() => void) | undefined  // eslint-disable-line prefer-const
        let settled = false

        const cleanup = () => {
          unsubChunk?.()
          unsubDone?.()
          unsubError?.()
          setChatLoading(false)
        }

        unsubChunk = api.onChatStreamChunk?.(({ partial }: any) => {
          setMessages(prev => prev.map((m: any) =>
            m.id === placeholderId ? { ...m, content: partial } : m
          ))
        })

        unsubDone = api.onChatStreamDone?.(({ answer, sources }: any) => {
          settled = true
          const sourcePaths = sources?.map((s: any) => ({ file: s.file, title: s.title })) ?? []
          setMessages(prev => prev.map((m: any) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content: `${answer}\n\n---\n${sources?.map((s: any) => `📄 [[${s.title}]]`).join(' | ') ?? ''}`,
                  pagesUsed: sourcePaths,
                  sourceMode: 'knowledge_base',
                }
              : m
          ))
          cleanup()
        })

        unsubError = api.onChatStreamError?.(({ error }: any) => {
          settled = true
          setMessages(prev => prev.map((m: any) =>
            m.id === placeholderId
              ? { ...m, content: `抱歉，搜索时出现错误：${error}` }
              : m
          ))
          cleanup()
        })

        const result = await api.chatAskStream?.(text, history)
        if (result && !result.streamed && !settled) {
          cleanup()
          setMessages(prev => prev.map((m: any) =>
            m.id === placeholderId
              ? {
                  ...m,
                  content: `${result.answer}\n\n---\n${result.sources?.map((s: any) => `📄 [[${s.title}]]`).join(' | ') ?? ''}`,
                  sources: result.sources?.map((s: any) => s.title) ?? [],
                }
              : m
          ))
        }
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err)
      const fallback = msg.includes('key') || msg.includes('401') ? 'API Key 未配置或无效'
        : msg.includes('timeout') || msg.includes('ETIMEDOUT') ? '请求超时，请稍后重试'
        : msg.includes('network') || msg.includes('ECONNREFUSED') ? '网络连接失败'
        : '抱歉，处理请求时出错。'
      setMessages(prev => [...prev, { role: 'assistant', content: fallback }])
      setChatLoading(false)
    }
  }, [content, selectedFile, messages, setChatLoading])

  return { handleSendMessage }
}