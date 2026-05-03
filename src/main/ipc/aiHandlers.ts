/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { ipcMain } from 'electron'
import { callAI, callAIGateway } from '../services/aiService'

export function registerAIHandlers(): void {
  ipcMain.handle('ai:classify', async (_, content: string, folders: string[]) => {
    return callAI('classify', { content, folders })
  })

  ipcMain.handle('ai:tags', async (_, content: string) => {
    return callAI('tags', { content })
  })

  ipcMain.handle('ai:summary', async (_, content: string) => {
    return callAI('summary', { content })
  })

  ipcMain.handle('ai:reason', async (_, content: string) => {
    return callAI('reason', { content })
  })

  ipcMain.handle('ai:write', async (_, instruction: string, context: any) => {
    return callAIGateway(instruction, context)
  })
}