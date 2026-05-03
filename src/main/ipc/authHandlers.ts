/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ipcMain, openExternal, BrowserWindow } from 'electron'
import Store from 'electron-store'
import log from 'electron-log/main'

const store = new Store<{ authToken?: string; authEmail?: string; authState?: string }>()

// ─── Auth Callback (called from URL scheme handler) ─────────────────────────
// Simple JWT format check (header.payload.signature)
function isValidJWTToken(token: string): boolean {
  return token.split('.').length === 3 && token.length > 20
}

export function handleAuthCallback(url: string): void {
  try {
    const parsed = new URL(url)
    const token = parsed.searchParams.get('token')
    const email = parsed.searchParams.get('email')
    if (token) {
      if (!isValidJWTToken(token)) {
        log.error('[Auth] Invalid token format received')
        return
      }
      store.set('authToken', token)
      if (email) store.set('authEmail', email)
      log.info('[Auth] Token saved from OAuth callback')
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('auth:tokenReceived', { token, email })
      })
    }
  } catch (err) {
    log.error('[Auth] Callback parse error:', err)
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────
export function registerAuthHandlers(): void {
  ipcMain.handle('auth:getToken', () => store.get('authToken') ?? null)
  ipcMain.handle('auth:getEmail', () => store.get('authEmail') ?? null)
  ipcMain.handle('auth:getState', () => store.get('authState') ?? null)
  ipcMain.handle('auth:saveState', (_, state: string) => { store.set('authState', state) })
  ipcMain.handle('auth:clear', () => {
    store.delete('authToken')
    store.delete('authEmail')
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('auth:cleared')
    })
  })
  ipcMain.handle('auth:openLogin', async (_, loginUrl: string) => {
    await openExternal(loginUrl)
  })
}