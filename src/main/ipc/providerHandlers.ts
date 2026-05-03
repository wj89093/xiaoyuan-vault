import { ipcMain } from 'electron'
import { readAutoAISettings, writeAutoAISettings } from '../services/autoAIEngine'

export function registerProviderHandlers(): void {
  ipcMain.handle('provider:get', async () => {  // eslint-disable-line @typescript-eslint/require-await
    return readAutoAISettings().then(s => s?.provider ?? 'qwen').catch(() => 'qwen')
  })

  ipcMain.handle('provider:set', async (_, provider: string) => {
    const s = await readAutoAISettings()
    await writeAutoAISettings({ ...s, provider })
    return true
  })
}
