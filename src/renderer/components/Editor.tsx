
import { useState, useRef, useCallback, useEffect } from 'react'
import React from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import DOMPurify from 'dompurify'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { EditorToolbar } from './EditorToolbar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseFrontmatter } from '../../shared/frontmatter'

import { BookOpen, Link as LinkIcon, Hash, AlignLeft, Pencil, FileText } from 'lucide-react'
/* eslint-disable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/refs, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-invalid-this, @typescript-eslint/unbound-method, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unused-expressions, prefer-const, prefer-rest-params, @typescript-eslint/no-misused-promises */

interface EditorProps {
  value: string
  onChange: (value: string) => void
  nativePreview?: {
    type: 'pdf' | 'html' | 'sheets' | 'image' | 'video' | 'audio' | 'unsupported'
    text?: string
    content?: string
    dataUrl?: string
    sheets?: Record<string, string>
    sheetNames?: string[]
  }
  isNativePreview?: boolean
  onReference?: (content: string) => void
}

type Mode = 'source' | 'reading'

// PDF renderer using pdfjs-dist
function PDFPreview({ dataUrl }: { dataUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    ;(async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        // Set worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/pdf.worker.min.mjs'

        const loadingTask = pdfjsLib.getDocument(dataUrl)
        const pdf = await loadingTask.promise
        if (cancelled) return
        pdfDocRef.current = pdf
        setTotalPages(pdf.numPages)
        await renderPage(pdf, page)
        setLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError((err as any)?.message ?? 'PDF 加载失败')
          setLoading(false)
        }
      }
    })().catch?.(() => {})

    return () => { cancelled = true }
  }, [dataUrl])

  useEffect(() => {
    if (!pdfDocRef.current) return
    void renderPage(pdfDocRef.current, page).catch?.(() => {})
  }, [page])

  const renderPage = async (pdf: PDFDocumentProxy, pageNum: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const page = await pdf.getPage(pageNum)
    const scale = 1.5
    const viewport = page.getViewport({ scale })
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  }

  return (
    <div className="pdf-preview" ref={containerRef}>
      <div className="pdf-toolbar">
        <button className="pdf-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
        <span className="pdf-page-info">{totalPages > 0 ? `${page} / ${totalPages}` : '加载中...'}</span>
        <button className="pdf-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
      </div>
      <div className="pdf-canvas-container">
        {loading && <div className="pdf-loading">正在加载 PDF...</div>}
        {error && <div className="pdf-error">{error}</div>}
        <canvas ref={canvasRef} style={{ display: loading ? 'none' : 'block', maxWidth: '100%' }} />
      </div>
    </div>
  )
}

export function Editor({ value, onChange, nativePreview, isNativePreview = false, onReference }: EditorProps): JSX.Element {
  const [mode, setMode] = useState<Mode>('reading')
  const [splitView, setSplitView] = useState(false)
  const editorViewRef = useRef<EditorView | null>(null)
  const [activeSheet, setActiveSheet] = useState(0)

  const handleCreate = useCallback((view: EditorView) => {
    editorViewRef.current = view
  }, [])

  const wordCount = value.replace(/\s/g, '').length
  const readMinutes = Math.max(1, Math.ceil(value.split(/\s+/).filter(Boolean).length / 300))
  const lines = value.split('\n').length
  const headings = (value.match(/^#{1,6}\s.+/gm) ?? []).length
  const wikiLinks = (value.match(/\[\[([^\]]+)\]\]/g) ?? []).length
  const externalLinks = (value.match(/https?:\/\/[^\s]+/g) ?? []).length

  const { frontmatter } = parseFrontmatter(value)
  const type = frontmatter.type ?? 'collection'
  const status = frontmatter.status ?? 'active'

  // Cmd+E toggle Reading ↔ Source mode + Cmd+B/I/K formatting shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!editorViewRef.current) return
      const view = editorViewRef.current
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        if (isNativePreview) return
        if (mode === 'reading') setMode('source')
        else if (mode === 'source') setMode('reading')
        return
      }
      // Cmd+B: bold
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        const selection = view.state.selection.main
        const selectedText = view.state.sliceDoc(selection.from, selection.to)
        const bold = `**${selectedText}**`
        view.dispatch({ changes: { from: selection.from, to: selection.to, insert: bold } })
        view.focus()
        return
      }
      // Cmd+I: italic
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault()
        const selection = view.state.selection.main
        const selectedText = view.state.sliceDoc(selection.from, selection.to)
        const italic = `*${selectedText}*`
        view.dispatch({ changes: { from: selection.from, to: selection.to, insert: italic } })
        view.focus()
        return
      }
      // Cmd+K: link
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const selection = view.state.selection.main
        const selectedText = view.state.sliceDoc(selection.from, selection.to)
        const link = `[${selectedText}](url)`
        view.dispatch({ changes: { from: selection.from, to: selection.to, insert: link } })
        view.focus()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, isNativePreview])

  // Native file preview
  if (isNativePreview && nativePreview) {
    return (
      <div className="editor-wrapper">
        <div className="editor-frontmatter-bar">
          <FileText size={12} />
          <span className="fm-stat" style={{ marginLeft: 4 }}>
            {nativePreview.type === 'pdf' ? 'PDF 文档' :
             nativePreview.type === 'html' ? 'Word 文档' :
             nativePreview.type === 'sheets' ? '表格文档' :
             nativePreview.type === 'image' ? '图片' :
             nativePreview.type === 'video' ? '视频' :
             nativePreview.type === 'audio' ? '音频' : '不支持的格式'}
          </span>
          {nativePreview.type === 'sheets' && nativePreview.sheetNames && (
            <div className="sheet-tabs">
              {nativePreview.sheetNames.map((name: string, i: number) => (
                <button
                  key={name}
                  className={`sheet-tab ${i === activeSheet ? 'active' : ''}`}
                  onClick={() => setActiveSheet(i)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="native-preview">
          {nativePreview.type === 'image' && nativePreview.dataUrl && (
            <div className="native-preview-image">
              <img src={nativePreview.dataUrl} alt="Preview" />
            </div>
          )}

          {nativePreview.type === 'html' && nativePreview.content && (
            <div className="native-preview-html" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(nativePreview.content, { USE_PROFILES: { html: true }, ALLOWED_TAGS: ['p','br','h1','h2','h3','h4','h5','h6','ul','ol','li','table','thead','tbody','tr','th','td','blockquote','pre','code','em','strong','a','img','div','span','hr','br'], ALLOWED_ATTR: ['href','src','alt','class','style'] }) }} />
          )}

          {nativePreview.type === 'sheets' && nativePreview.sheets && nativePreview.sheetNames && (
            <div className="native-preview-sheets">
              <div
                className="sheet-content"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(nativePreview.sheets[nativePreview.sheetNames[activeSheet]] ?? '') }}
              />
            </div>
          )}

          {nativePreview.type === 'pdf' && nativePreview.dataUrl && (
            <PDFPreview dataUrl={nativePreview.dataUrl} />
          )}

          {nativePreview.type === 'video' && nativePreview.dataUrl && (
            <div className="native-preview-media">
              <video controls src={nativePreview.dataUrl} style={{ maxWidth: '100%', borderRadius: 8 }} />
            </div>
          )}

          {nativePreview.type === 'audio' && nativePreview.dataUrl && (
            <div className="native-preview-media">
              <div className="audio-player">
                <audio controls src={nativePreview.dataUrl} style={{ width: '100%' }} />
              </div>
            </div>
          )}

          {nativePreview.type === 'unsupported' && (
            <div className="native-preview-unsupported">
              <FileText size={48} strokeWidth={1} />
              <p>此文件格式暂不支持预览</p>
              <p className="ai-chat-empty-hint">文件已保存在知识库，可右键用其他应用打开</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="editor-wrapper">
      <EditorToolbar
        view={editorViewRef.current}
        previewMode={false}
        onTogglePreview={() => setMode(m => m === 'reading' ? 'source' : 'reading')}
        onToggleSplit={() => setSplitView(s => !s)}
        splitView={splitView}
        readingModeActive={mode === 'reading'}
        onReference={onReference}
      />

      {/* Frontmatter status bar */}
      <div className="editor-frontmatter-bar">
        <span className={`fm-type-badge type-${type}`}>{type}</span>
        <span className={`fm-status-badge status-${status}`}>{status}</span>
        <span className="fm-divider" />
        <span className="fm-stat"><AlignLeft size={11} />{lines} 行</span>
        <span className="fm-stat"><Hash size={11} />{headings} 级标题</span>
        <span className="fm-stat"><BookOpen size={11} />{wikiLinks} 双链</span>
        <span className="fm-stat"><LinkIcon size={11} />{externalLinks} 外链</span>
        <span className="fm-divider" />
        <span className="fm-mode-hint">
          {mode === 'reading' ? '阅读模式' : splitView ? '分屏模式' : '编辑模式'}
        </span>
      </div>

      {mode === 'reading' ? (
        <div
          className="editor-reading"
          onClick={() => setMode('source')}
          title="点击进入编辑模式 (Cmd+E)"
        >
          {value.trim() ? (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {value}
              </ReactMarkdown>
              <div className="editor-reading-hint">
                <Pencil size={12} />
                点击或按 Cmd+E 进入编辑
              </div>
            </>
          ) : (
            <div className="editor-preview-empty">空文档 · 点击或 Cmd+E 编辑</div>
          )}
        </div>
      ) : splitView ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <CodeMirror
              value={value}
              height="100%"
              extensions={[
                markdown(),
                EditorView.lineWrapping,
                syntaxHighlighting(defaultHighlightStyle),
              ]}
              onChange={onChange}
              onCreateEditor={handleCreate}
              theme="light"
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                autocompletion: true,
                bracketMatching: true,
                closeBrackets: true,
                indentOnInput: true,
              }}
            />
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid var(--color-border)', overflow: 'hidden' }}>
            <div className="editor-preview" style={{ height: '100%' }}>
              {value.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
              ) : (
                <div className="editor-preview-empty">预览区域</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <CodeMirror
          value={value}
          height="100%"
          extensions={[
            markdown(),
            EditorView.lineWrapping,
            syntaxHighlighting(defaultHighlightStyle),
          ]}
          onChange={onChange}
          onCreateEditor={handleCreate}
          theme="light"
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            indentOnInput: true,
          }}
        />
      )}
      <div className="editor-footer">
        <span>{wordCount} 字</span>
        <span>约 {readMinutes} 分钟</span>
        {mode === 'reading' && <span style={{ color: 'var(--color-accent)' }}>阅读模式</span>}
      </div>
    </div>
  )
}
