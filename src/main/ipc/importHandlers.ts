import { ipcMain } from 'electron'
import { fetchURL, saveURLToVault } from '../services/urlFetch'
import { openImportWindow } from '../importWindow'
import log from 'electron-log/main'

export function registerImportHandlers(): void {
  ipcMain.handle('import:fetchUrl', async (_, url: string) => {
    try {
      const result = await fetchURL(url)
      return { title: result.title, content: result.content }
    } catch (err) {
      log.error('fetchUrl error:', err)
      throw new Error(String(err))
    }
  })

  ipcMain.handle('import:saveUrl', async (_, url: string, vaultPath: string) => {
    try {
      const result = await fetchURL(url)
      const filePath = await saveURLToVault(url, vaultPath, result)
      return filePath
    } catch (err) {
      log.error('saveUrl error:', err)
      throw err
    }
  })

  ipcMain.handle('import:open', async (event) => {
    const webContents = event.sender
    const mainWindow = webContents.hostWebContents ?? webContents
    openImportWindow(mainWindow as any)
  })
}