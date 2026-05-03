 
import type { BrowserWindow } from 'electron'

let _mainWindow: BrowserWindow | null = null

export function setMainWindowRef(win: BrowserWindow | null): void {
  _mainWindow = win
}

export function getMainWindowRef(): BrowserWindow | null {
  return _mainWindow
}
