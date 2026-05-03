import { ipcMain } from 'electron'
import { queryVault } from '../services/query'

export function registerQueryHandlers(): void {
  ipcMain.handle('query:vault', async (_, question: string) => {
    return queryVault(question)
  })
}
