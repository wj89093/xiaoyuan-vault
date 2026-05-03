import { ipcMain } from 'electron'
import { setVaultPath, showBubble, hideBubble } from '../services/clipboard'
import { triggerGraphRebuild } from '../graphUtils'

export function registerClipboardHandlers(): void {
  ipcMain.handle('clipboard:start', (_, vaultPath: string) => {
    setVaultPath(vaultPath)
    showBubble(); triggerGraphRebuild()
    return true
  })

  ipcMain.handle('clipboard:stop', () => {
    hideBubble()
    return true
  })

  ipcMain.handle('clipboard:setVaultPath', (_, vaultPath: string) => {
    setVaultPath(vaultPath)
    return true
  })
}