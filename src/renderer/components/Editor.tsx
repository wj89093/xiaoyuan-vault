import { useState, useRef, useCallback, useEffect } from 'react'
import React from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { EditorToolbar } from './EditorToolbar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseFrontmatter } from '../../main/services/frontmatter'
import { BookOpen, Link as LinkIcon, Hash, AlignLeft, Pencil } from 'lucide-react'

interface EditorProps {
  value: string
  onChange: (value: string) => void
}

type Mode = 'source' | 'reading'

export function Editor({ value, onChange }: EditorProps): JSX.Element {
  const [mode, setMode] = useState<Mode>('source')
  const [splitView, setSplitView] = useState(false)
  const editorViewRef = useRef<EditorView | null>(null)

  const handleCreate = useCallback((view: EditorView) => {
    editorViewRef.current = view
  }, [])

  const wordCount = value.replace(/\s/g, '').length
  const readMinutes = Math.max(1, Math.ceil(value.split(/\s+/).filter(Boolean).length / 300))
  const lines = value.split('\n').length
  const headings = (value.match(/^#{1,6}\s.+/gm) || []).length
  const wikiLinks = (value.match(/\[\[([^\]]+)\]\]/g) || []).length
  const externalLinks = (value.match(/https?:\/\/[^\s]+/g) || []).length

  const { frontmatter } = parseFrontmatter(value)
  const type = frontmatter.type || 'collection'
  const status = frontmatter.status || 'active'

  // Cmd+E toggle Reading ↔ Source mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        if (mode === 'reading') setMode('source')
        else if (mode === 'source') setMode('reading')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode])

  return (
    <div className="editor-wrapper">
      <EditorToolbar
        view={editorViewRef.current}
        previewMode={false}
        onTogglePreview={() => setMode(m => m === 'reading' ? 'source' : 'reading')}
        onToggleSplit={() => setSplitView(s => !s)}
        splitView={splitView}
        readingModeActive={mode === 'reading'}
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
        /* Obsidian Reading Mode — full rendered, click anywhere to edit */
        <div
          className="editor-reading"
          onClick={() => setMode('source')}
          title="点击进入编辑模式 (Cmd+E)"
        >
          {value.trim() ? (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Wiki links [[...]] as styled inline
                  p: ({ children, ...p }) => {
                    // Walk children to find [[...]] patterns
                    return <p {...p}>{children}</p>
                  },
                  // External links open in browser
                  a: ({ href, children }) => {
                    const isExternal = href?.startsWith('http')
                    return (
                      <a
                        href={href}
                        target={isExternal ? '_blank' : undefined}
                        rel={isExternal ? 'noopener noreferrer' : undefined}
                        onClick={isExternal ? undefined : e => e.stopPropagation()}
                      >
                        {children}
                      </a>
                    )
                  }
                }}
              >
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