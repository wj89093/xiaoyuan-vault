import { ipcMain } from 'electron'
import log from 'electron-log/main'

export function registerMaintainHandlers(): void {
  ipcMain.handle('maintain:run', async () => {
    return runMaintenance()
  })
}