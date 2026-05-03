 
import log from 'electron-log/main'
import { getMainWindowRef } from './mainWindowRef'
import { rebuildGraph } from './services/graph'

export function triggerGraphRebuild(): void {
  setTimeout(() => {
    const mainWindow = getMainWindowRef()
    rebuildGraph().then(r => {
      log.info(`[Graph] rebuild: ${r.nodes} nodes, ${r.edges} edges`)
      mainWindow?.webContents.send('graph:updated', r)
    }).catch((e: unknown) => log.error('[Graph] rebuild failed:', (e as Error).message))
  }, 5000)
}
