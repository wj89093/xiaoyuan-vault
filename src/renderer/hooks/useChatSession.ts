/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { useState, useCallback } from 'react'
import { useChat, type ChatMessage } from './useChat'

export { type ChatMessage } from './useChat'

export function useChatSession(selectedFile: string | null, content: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  const { handleSendMessage } = useChat(selectedFile, content, messages, setMessages, setChatLoading)

  const handleLoadSession = useCallback(async (sessionId: string) => {
    const msgs = await window.api.chatLoad?.(sessionId) ?? []
    setMessages(msgs.map((m: any) => ({
      id: m.id ?? crypto.randomUUID(),
      role: m.role,
      content: m.content,
    })))
  }, [])

  const handleSaveToVault = useCallback(async (msgId: string, handleSaveAIMessage: (content: string) => Promise<void>) => {
    const msg = messages.find((m: any) => m.id === msgId || m.id === undefined)
    if (msg) await handleSaveAIMessage(msg.content)
  }, [messages])

  return {
    messages,
    chatLoading,
    setMessages,
    handleSendMessage,
    handleLoadSession,
    handleSaveToVault,
  }
}
