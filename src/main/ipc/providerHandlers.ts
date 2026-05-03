/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any */
import { ipcMain } from 'electron'
import { readAutoAISettings, writeAutoAISettings } from '../services/autoAIEngine'

export function registerProviderHandlers(): void {
  ipcMain.handle('provider:get', async () => {   
    return readAutoAISettings().then(s => s?.provider ?? 'qwen').catch(() => 'qwen')
  })

  ipcMain.handle('provider:set', async (_, provider: string) => {
    const s = await readAutoAISettings()
    await writeAutoAISettings({ ...s, provider })
    return true
  })
}
