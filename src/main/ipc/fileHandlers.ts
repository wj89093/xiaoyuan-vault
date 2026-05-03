 
import { ipcMain } from 'electron'
import { mkdir, readFile, writeFile, copyFile, rename } from 'fs/promises'
import { basename, join } from 'path'
import log from 'electron-log/main'
import { renameFile, moveFile, deleteFile, deleteFolder, createFolder, saveFile, getFileContent, listVaultFiles, searchFiles } from '../services/database'
import { enrichFile } from '../services/enrich'
import { generateFileTemplate } from '../services/frontmatter'
import { convertWithJS, canConvertWithJS } from '../services/converters'

export function registerFileHandlers(): void {
  // File rename
  ipcMain.handle('file:rename', (_, oldPath: string, newName: string) => {
    return renameFile(oldPath, newName)
  })

  // File move to another folder (newParentDir is relative to vault root, no leading slash)
  ipcMain.handle('file:move', (_, filePath: string, newParentDir: string) => {
    return moveFile(filePath, newParentDir)
  })

  // File delete
  ipcMain.handle('file:delete', (_, filePath: string) => {
    return deleteFile(filePath)
  })

  // Folder delete
  ipcMain.handle('folder:delete', (_, folderPath: string) => {
    return deleteFolder(folderPath)
  })

  // Folder create
  ipcMain.handle('folder:create', (_, folderPath: string) => {
    return createFolder(folderPath)
  })

  // File list
  ipcMain.handle('file:list', () => {
    return listVaultFiles()
  })

  // File search
  ipcMain.handle('file:search', (_, query: string) => {
    return searchFiles(query)
  })

  // File read
  ipcMain.handle('file:read', (_, filePath: string) => {
    return getFileContent(filePath)
  })

  // File render (supports pdf/docx/xlsx/images/video/audio)
  ipcMain.handle('file:render', async (_, filePath: string) => {
    const ext = await import('path')
    const suffix = ext.extname(filePath).toLowerCase()

    if (suffix === '.pdf') {
      const data = await readFile(filePath)
      return { type: 'pdf', dataUrl: `data:application/pdf;base64,${Buffer.from(data).toString('base64')}` }
    }

    if (['.docx', '.doc'].includes(suffix)) {
      const mammoth = await import('mammoth')
      const result = await mammoth.convertToHtml({ path: filePath })
      return { type: 'html', content: result.value }
    }

    if (['.xlsx', '.xls', '.csv'].includes(suffix)) {
      const XLSX = await import('xlsx')
      const workbook = XLSX.readFile(filePath)
      const sheets: Record<string, string> = {}
      for (const name of workbook.SheetNames) {
        const html = XLSX.utils.sheet_to_html(workbook.Sheets[name])
        sheets[name] = html
      }
      return { type: 'sheets', sheets, sheetNames: workbook.SheetNames }
    }

    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(suffix)) {
      const data = await readFile(filePath)
      const b64 = Buffer.from(data).toString('base64')
      const mime = suffix === '.svg' ? 'image/svg+xml' : `image/${suffix.slice(1)}`
      return { type: 'image', dataUrl: `data:${mime};base64,${b64}` }
    }

    if (['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(suffix)) {
      const data = await readFile(filePath)
      const b64 = Buffer.from(data).toString('base64')
      const mime = suffix === '.mov' ? 'video/quicktime' : `video/${suffix.slice(1)}`
      return { type: 'video', dataUrl: `data:${mime};base64,${b64}` }
    }

    if (['.mp3', '.wav', '.ogg', '.aac', '.m4a', '.flac'].includes(suffix)) {
      const data = await readFile(filePath)
      const b64 = Buffer.from(data).toString('base64')
      const mime = suffix === '.m4a' ? 'audio/x-m4a' : `audio/${suffix.slice(1)}`
      return { type: 'audio', dataUrl: `data:${mime};base64,${b64}` }
    }

    return { type: 'unsupported' }
  })

  // File create
  ipcMain.handle('file:create', (_, filePath: string, title: string, type?: string) => {
    const content = generateFileTemplate(title, type)
    return saveFile(filePath, content)
  })

  // File save
  ipcMain.handle('file:save', async (_, filePath: string, content: string) => {
    const result = await saveFile(filePath, content)
    if (!filePath.includes('/.raw/') && !filePath.includes('\\.raw\\')) {
      enrichFile(filePath).catch((err: unknown) => log.warn('[AutoEnrich] failed:', String(err)))
    }
    return result
  })

  // File import
  ipcMain.handle('file:import', async (_, vaultPath: string, filePaths: string[]) => {
    const rawDir = join(vaultPath, 'raw files')
    const mdDir = join(vaultPath, '0-收集')
    await mkdir(rawDir, { recursive: true })
    await mkdir(mdDir, { recursive: true })
    const results: Array<{ name: string; path: string; status: string; error?: string; converted?: boolean; mdPath?: string }> = []
    for (const filePath of filePaths) {
      try {
        const name = basename(filePath)
        const dest = join(rawDir, name)
        try {
          await rename(filePath, dest)
          log.info(`[Import] moved: ${filePath} → ${dest}`)
        } catch (renErr: unknown) {
          if ((renErr as { code?: string }).code === 'EXDEV' || (renErr as { code?: string }).code === 'EPERM') {
            await copyFile(filePath, dest)
            const { unlink } = await import('fs/promises')
            await unlink(filePath)
            log.warn(`[Import] cross-device, copied then deleted: ${filePath}`)
          } else {
            throw renErr
          }
        }

        if (canConvertWithJS(filePath)) {
          try {
            const markdown = await convertWithJS(filePath)
            const mdName = name.replace(/\.[^.]+$/, '.md')
            const mdDest = join(mdDir, mdName)
            await writeFile(mdDest, markdown, 'utf-8')
            results.push({ name, path: dest, status: 'ok', converted: true, mdPath: mdDest })
            log.info(`[Import] JS converted: ${name} → ${mdName}`)
            enrichFile(mdDest).catch((e: unknown) => log.warn(`[Import] enrich failed for ${mdName}:`, (e as Error).message))
          } catch (convErr: unknown) {
            log.warn(`[Import] JS conversion failed for ${name}, keeping raw only:`, (convErr as Error).message)
            results.push({ name, path: dest, status: 'ok', converted: false })
          }
        } else {
          results.push({ name, path: dest, status: 'ok', converted: false })
        }
      } catch (err) {
        log.error('Import error:', err)
        results.push({ name: basename(filePath), path: '', status: 'error', error: String(err) })
      }
    }
    return results
  })
}

ipcMain.handle('file:revealInFinder', async (_, filePath: string) => {
  const { shell } = await import('electron')
  shell.showItemInFolder(filePath)
})
