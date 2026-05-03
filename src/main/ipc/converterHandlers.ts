import { ipcMain } from 'electron'
import { convertWithJS, getSupportedExtensions, canTranscribeAudio } from '../services/converters'

export function registerConverterHandlers(): void {
  ipcMain.handle('converter:convert', async (_, filePath: string) => {   
    return convertWithJS(filePath)
  })

  ipcMain.handle('converter:supported', () => {
    return getSupportedExtensions()
  })

  ipcMain.handle('converter:transcribe', (_, filePath: string) => {
    if (!canTranscribeAudio(filePath)) return { success: false, error: '不支持的音频格式' }
    return { success: false, error: 'Whisper 模型未配置' }
  })
}
