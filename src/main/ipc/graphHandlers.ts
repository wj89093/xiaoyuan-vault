import { ipcMain } from 'electron'
import { rebuildGraph, loadGraph } from '../services/graph'

export function registerGraphHandlers(): void {
  ipcMain.handle('graph:rebuild', async () => {
    return rebuildGraph()
  })

  ipcMain.handle('graph:load', async () => {
    return loadGraph()
  })
}