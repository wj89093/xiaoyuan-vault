import { ipcMain } from 'electron'
import { loadFolderMap, saveFolderMap } from '../services/enrich'

export function registerFolderMapHandlers(): void {
  ipcMain.handle('folderMap:load', async () => {
    return loadFolderMap()
  })

  ipcMain.handle('folderMap:save', async (_, map: Record<string, string>) => {
    await saveFolderMap(map)
    return true
  })
}
