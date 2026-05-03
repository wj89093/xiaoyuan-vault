/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { ipcMain } from 'electron'
import { readAutoAISettings, writeAutoAISettings } from '../services/autoAIEngine'
import { startAutoAIEngine } from '../services/autoAIEngine'

export function registerAutoAIHandlers(): void {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
  ipcMain.handle('autoAI:get', async () => {
    return readAutoAISettings()
  })

  ipcMain.handle('autoAI:save', async (_, settings: any) => {
    await writeAutoAISettings(settings)  // eslint-disable-line @typescript-eslint/no-unsafe-argument
    if (settings.auto) startAutoAIEngine().catch(() => {})
    return true
  })
}
