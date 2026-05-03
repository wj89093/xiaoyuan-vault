import { ipcMain } from 'electron'
import { resolveContentType } from '../services/resolver'

export function registerResolverHandlers(): void {
  ipcMain.handle('resolver:classify', async (_, content: string, title?: string) => {
    return resolveContentType(content, title)
  })
}
