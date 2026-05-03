import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { basename } from 'path'
import log from 'electron-log/main'
import { transcribeAudio } from './whisper'

// Supported JS-native formats (no Python needed)
const JS_CONVERTERS: Record<string, (filePath: string) => Promise<string>> = {
  '.pdf': convertPdf,
  '.docx': convertDocx,
  '.doc': convertDocx,
  '.xlsx': convertXlsx,
  '.xls': convertXlsx,
  '.pptx': convertPptx,
  '.ppt': convertPptx,
  '.html': convertHtml,
  '.htm': convertHtml,
  '.csv': convertText,
  '.json': convertText,
  '.xml': convertText,
  '.zip': convertZip,
}

// Text formats (direct read)
const TEXT_FORMATS = new Set(['.md', '.txt', '.markdown', '.mdown', '.csv', '.json', '.xml'])

// Audio formats (whisper.cpp)
const AUDIO_FORMATS = new Set(['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.aiff', '.wma'])

// Image formats (tesseract.js OCR)
const IMAGE_FORMATS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'])

export function canConvertWithJS(filePath: string): boolean {
  const ext = (filePath.toLowerCase().slice(filePath.lastIndexOf('.')))
  return ext in JS_CONVERTERS || TEXT_FORMATS.has(ext) || IMAGE_FORMATS.has(ext) || AUDIO_FORMATS.has(ext)
}

export function needsMarkitdownConversion(filePath: string): boolean {
  // Now handled by JS converters
  return canConvertWithJS(filePath)
}

export function canTranscribeAudio(filePath: string): boolean {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  return AUDIO_FORMATS.has(ext)
}

export async function convertWithJS(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))

  // Audio: whisper.cpp
  if (AUDIO_FORMATS.has(ext)) {
    return await transcribeAudio(filePath)
  }

  // Text: direct read
  if (TEXT_FORMATS.has(ext)) {
    return await readFile(filePath, 'utf-8')
  }

  // JS converters
  if (ext in JS_CONVERTERS) {
    return await JS_CONVERTERS[ext](filePath)
  }

  // Image: tesseract.js OCR
  if (IMAGE_FORMATS.has(ext)) {
    return await convertImageOCR(filePath)
  }

  throw new Error(`Unsupported format: ${filePath}`)
}

// ─── Individual converters ────────────────────────────────────────────────

async function convertPdf(filePath: string): Promise<string> {
  log.info(`[exec] converting PDF: ${filePath}`)
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const execFileAsync = promisify(execFile)
  const { stdout } = await execFileAsync('pdftotext', [filePath, '-'])
  return `# ${basename(filePath).replace('.pdf', '')}\n\n${stdout}`
}

async function convertDocx(filePath: string): Promise<string> {
  log.info(`[JS] converting DOCX: ${filePath}`)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const mammoth = await import('mammoth')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const result = await mammoth.default.convertToMarkdown({ path: filePath })
  return result.value
}

async function convertXlsx(filePath: string): Promise<string> {
  log.info(`[JS] converting XLSX: ${filePath}`)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const XLSX = await import('xlsx')
  const workbook = XLSX.default.readFile(filePath)
  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    lines.push(`## ${sheetName}`)
    const sheet = workbook.Sheets[sheetName]
    XLSX.default.utils.decode_range(sheet['!ref'] as string ?? 'A1')
    const data = XLSX.default.utils.sheet_to_json(sheet, { header: 1, defval: '' })
    for (const row of data as string[][]) {
      const filtered = row.filter((c: string) => c !== '')
      if (filtered.length > 0) {
        lines.push(filtered.map((c: string) => `| ${String(c)} `).join('') + '|')
      }
    }
    lines.push('')
  }

  return `# ${basename(filePath).replace('.xlsx', '').replace('.xls', '')}\n\n${lines.join('\n')}`
}

async function convertPptx(filePath: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const AdmZip = await import('adm-zip')
  const zip = new AdmZip.default(filePath) as unknown as Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const slideEntries = zip.getEntries().filter(e => e.entryName.match(/ppt\/slides\/slide\d+\.xml$/))
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const lines: string[] = [`# ${basename(filePath).replace('.pptx', '').replace('.ppt', '')}`]

  for (const entry of (slideEntries as { entryName: string }[]).sort((a, b) => {
    const na = parseInt(a.entryName.match(/slide(\d+)/)?.[1] ?? '0')
    const nb = parseInt(b.entryName.match(/slide(\d+)/)?.[1] ?? '0')
    return na - nb
  })) {
    const xml = entry.getData().toString('utf-8')
    // Extract text from XML using regex (simple approach)
    const texts = [...xml.matchAll(/<a:t>([^<]+)<\/a:t>/g)].map(m => m[1]).filter(t => t.trim())
    if (texts.length > 0) {
      lines.push(`\n### Slide ${lines.filter(l => l.startsWith('### ')).length + 1}`)
      lines.push(texts.join('\n'))
    }
  }

  return lines.join('\n')
}

async function convertHtml(filePath: string): Promise<string> {
  log.info(`[JS] converting HTML: ${filePath}`)
  const cheerio = await import('cheerio')
  const html = await readFile(filePath, 'utf-8')
  const $ = cheerio.load(html)
  // Remove script/style tags
  $('script, style, nav, header, footer, aside').remove()
  const title = $('title, h1').first().text().trim() || basename(filePath)
  const body = $('body').text().trim()
  return `# ${title}\n\n${body}`
}

async function convertText(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf-8')
}

async function convertZip(filePath: string): Promise<string> {
  log.info(`[JS] extracting ZIP: ${filePath}`)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const AdmZip = await import('adm-zip')
  const zip = new AdmZip.default(filePath) as unknown as Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const entries = zip.getEntries().filter(e => !e.isDirectory)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const names = entries.map(e => `- ${e.entryName}`).join('\n')
  return `# ZIP Contents: ${basename(filePath)}\n\n${names}`
}

async function convertImageOCR(filePath: string): Promise<string> {
  log.info(`[JS] OCR image: ${filePath}`)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng+chi_sim')
  const { data: { text } } = await worker.recognize(filePath)
  await worker.terminate()
  return `# ${basename(filePath)}\n\n${text}`
}

export function getSupportedExtensions(): string[] {
  return [
    ...Object.keys(JS_CONVERTERS),
    ...Array.from(TEXT_FORMATS),
    ...Array.from(AUDIO_FORMATS),
    ...Array.from(IMAGE_FORMATS),
  ]
}
