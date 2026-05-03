/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/explicit-function-return-type */
import { ipcMain } from 'electron'
import log from 'electron-log/main'
import { runMaintenance } from '../services/maintain'
import { generateBriefing } from '../services/briefing'

// briefing IPC
ipcMain.handle('briefing:generate', async () => {
  return generateBriefing()
})

export function registerMaintainHandlers(): void {
  ipcMain.handle('maintain:run', async () => {
    return runMaintenance()
  })
}