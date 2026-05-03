/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
import { ipcMain } from 'electron'
import log from 'electron-log/main'

export function registerMaintainHandlers(): void {
  ipcMain.handle('maintain:run', async () => {
    return runMaintenance()
  })
}