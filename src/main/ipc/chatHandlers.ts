/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-misused-promises */
import { ipcMain } from 'electron'
import { askQuestion, askQuestionStream, buildAnswerPrompt, createSession, loadSessions, deleteSession, loadMessages, saveMessages } from '../services/chat'
import { streamQwenAI } from '../services/qwen'

export function registerChatHandlers(): void {
  // Ask question (non-streaming)
  ipcMain.handle('chat:ask', async (_, question: string, history: any[]) => {
    return askQuestion(question, history || [])
  })

  // Ask question with streaming
  ipcMain.handle('chat:askStream', async (event, question: string, history: any[]) => {
    const webContents = event.sender
    const abortCtrl = new AbortController()
    ;(webContents as any).chatAbortCtrl = abortCtrl

    const { results, confidence } = await askQuestionStream(question, history || [])

    ;(async () => {
      try {
        const { systemPrompt, userPrompt } = await buildAnswerPrompt(question, results, history || [])
        let fullAnswer = ''

        await streamQwenAI(systemPrompt, userPrompt, (chunk: string) => {
          fullAnswer += chunk
          webContents.send('chat:streamChunk', { chunk, partial: fullAnswer })
        }, abortCtrl.signal)

        const sources = results.slice(0, 3).map((r: any) => ({
          file: r.file,
          title: r.title,
          snippet: r.snippet,
        }))

        webContents.send('chat:streamDone', { answer: fullAnswer, sources, confidence })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          webContents.send('chat:streamError', { error: (err as Error).message })
        }
      }
    })().catch(() => {})

    return { streamed: true }
  })

  // Sessions list
  ipcMain.handle('chat:sessions', async () => loadSessions())

  // Create session
  ipcMain.handle('chat:create', async (_, firstQuestion: string) => createSession(firstQuestion))

  // Load messages
  ipcMain.handle('chat:load', async (_, sessionId: string) => loadMessages(sessionId))

  // Save messages
  ipcMain.handle('chat:save', async (_, sessionId: string, messages: unknown[]) => saveMessages(sessionId, messages))

  // Delete session
  ipcMain.handle('chat:delete', async (_, sessionId: string) => deleteSession(sessionId))
}