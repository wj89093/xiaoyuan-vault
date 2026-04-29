import { useState, useRef, useCallback } from 'react'
import React from 'react'
import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { EditorToolbar } from './EditorToolbar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { parseFrontmatter } from '../../main/services/frontmatter'
import { BookOpen, Link as LinkIcon, Hash, AlignLeft } from 'lucide-react'

interface EditorProps {
  value: string
  onChange: (value: string) => void
}

export function Editor({ value, onChange }: EditorProps): JSX.Element {
  const [previewMode, setPreviewMode] = useState(false)
  const [splitView, setSplitView] = useState(false)
  const editorViewRef = useRef<EditorView | null>(null)
  const lastCursorPos = useRef(0)

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

  return (
    <div className="editor-wrapper">
      <EditorToolbar
        view={editorViewRef.current}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode(p => !p)}
        onToggleSplit={() => setSplitView(s => !s)}
        splitView={splitView}
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
        <span className="fm-save-hint">自动保存</span>
      </div>

      {splitView ? (
        /* Split view: editor left, preview right */
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
      ) : previewMode ? (
        <div className="editor-preview">
          {value.trim() ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <div className="editor-preview-empty">点击编辑按钮开始写作</div>
          )}
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
      </div>
    </div>
  )
}