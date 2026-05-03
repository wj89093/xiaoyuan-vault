import { ipcMain } from 'electron'
import { enrichFile, enrichFileWithConfirmation, enrichInbox } from '../services/enrich'

export function registerEnrichHandlers(): void {
  ipcMain.handle('enrich:file', async (_, filePath: string) => {
    return enrichFile(filePath)
  })

  ipcMain.handle('enrich:confirm', async (_, filePath: string, type: string, folder?: string) => {
    return enrichFileWithConfirmation(filePath, type, folder)
  })

  ipcMain.handle('enrich:inbox', async () => {
    return enrichInbox()
  })
}