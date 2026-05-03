import { ipcMain } from 'electron'
import { fetchURL, saveURLToVault } from '../services/urlFetch'
import { enrichFile } from '../services/enrich'
import log from 'electron-log/main'

export function registerURLHandlers(): void {
  ipcMain.handle('url:fetch', async (_, url: string) => {
    try {
      const result = await fetchURL(url)
      return result
    } catch (error) {
      log.error('URL fetch error:', error)
      throw error
    }
  })

  ipcMain.handle('url:save', async (_, url: string, vaultPath: string) => {
    try {
      const result = await fetchURL(url)
      const filePath = await saveURLToVault(url, vaultPath, result)
      try {
        await enrichFile(filePath)
      } catch (e) {
        log.warn('Auto-enrich failed for URL import:', e)
      }
      return filePath
    } catch (error) {
      log.error('URL save error:', error)
      throw error
    }
  })
}