import { execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import log from 'electron-log/main'

const execFileAsync = promisify(execFile)

// In development: use Homebrew paths
// In production (packaged): use app bundle extraResources
function getWhisperBinaryPath(): string {
  if (app.isPackaged) {
    // Packaged: extraResources/whisper/bin/whisper-cli
    return join(process.resourcesPath!, 'whisper', 'bin', 'whisper-cli')
  }
  return '/opt/homebrew/bin/whisper-cli'
}

function getWhisperModelPath(): string {
  if (app.isPackaged) {
    // Packaged: extraResources/whisper/models/ggml-base.bin
    return join(process.resourcesPath!, 'whisper', 'models', 'ggml-base.bin')
  }
  return '/Users/xindaolangu/Library/ApplicationSupport/whisper-cpp/models/ggml-base.bin'
}

const WHISPER_CLI = '' // resolved at runtime
const WHISPER_MODEL = '' // resolved at runtime

// Audio formats that need ffmpeg conversion before whisper
const AUDIO_NEED_CONVERT = new Set(['.m4a', '.aac', '.ogg', '.flac', '.wma', '.aiff'])

export function canTranscribeAudio(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  return new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.aiff', '.wma']).has(ext)
}

export function needsFFmpegConvert(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  return AUDIO_NEED_CONVERT.has(ext)
}

export async function transcribeAudio(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`Audio file not found: ${filePath}`)
  }

  const whisperCli = getWhisperBinaryPath()
  const whisperModel = getWhisperModelPath()

  if (!existsSync(whisperCli)) {
    throw new Error(`whisper-cli not found at ${whisperCli}. Please install: brew install whisper-cpp`)
  }

  if (!existsSync(whisperModel)) {
    throw new Error(`whisper model not found at ${whisperModel}. Please download ggml-base.bin`)
  }

  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  const needsConvert = AUDIO_NEED_CONVERT.has(ext)
  const inputFile = needsConvert ? await convertAudioToWav(filePath) : filePath

  log.info(`[Whisper] transcribing: ${filePath}`)

  try {
    const outputFile = `/tmp/whisper_${Date.now()}.txt`
    await execFileAsync('ffmpeg', [
      '-i', inputFile,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      '/tmp/whisper_input.wav',
      '-y'
    ], { timeout: 60_000 })

    await execFileAsync(whisperCli, [
      '-m', whisperModel,
      '-f', '/tmp/whisper_input.wav',
      '--language', 'zh',
      '-otxt',
      '-of', outputFile.replace('.txt', ''),
    ], { timeout: 300_000 })

    const { readFile } = await import('fs/promises')
    let text = ''
    try {
      text = await readFile(outputFile, 'utf-8')
    } catch {
      text = await readFile('/tmp/whisper.txt', 'utf-8')
    }

    log.info(`[Whisper] done: ${filePath} → ${text.length} chars`)
    return text.trim()
  } catch (err: any) {
    log.error(`[Whisper] failed: ${filePath}`, err.message)
    throw err
  }
}

async function convertAudioToWav(filePath: string): Promise<string> {
  const output = `/tmp/whisper_audio_${Date.now()}.wav`
  await execFileAsync('ffmpeg', [
    '-i', filePath,
    '-ar', '16000',
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    output,
    '-y'
  ], { timeout: 60_000 })
  return output
}

export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ])
    let stdout = ''
    proc.stdout.on('data', d => stdout += d)
    proc.on('close', code => {
      if (code === 0) resolve(parseFloat(stdout.trim()))
      else reject(new Error(`ffprobe failed: ${code}`))
    })
  })
}
