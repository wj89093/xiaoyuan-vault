import { ipcMain } from 'electron'
import { readAutoAISettings, writeAutoAISettings } from '../services/autoAIEngine'
import { startAutoAIEngine } from '../services/autoAIEngine'

export function registerAutoAIHandlers(): void {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access */
  ipcMain.handle('autoAI:get', async () => {
    return readAutoAISettings()
  })

  ipcMain.handle('autoAI:save', async (_, settings: any) => {
    await writeAutoAISettings(settings)  // eslint-disable-line @typescript-eslint/no-unsafe-argument
    if (settings.auto) startAutoAIEngine().catch(() => {})
    return true
  })
}
