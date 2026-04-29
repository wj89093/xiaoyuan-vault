import { useState, useRef, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { EditorToolbar } from './EditorToolbar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface EditorProps {
  value: string
  onChange: (value: string) => void
}

export function Editor({ value, onChange }: EditorProps): JSX.Element {
  const [previewMode, setPreviewMode] = useState(false)
  const editorViewRef = useRef<EditorView | null>(null)

  const handleCreate = useCallback((view: EditorView) => {
    editorViewRef.current = view
  }, [])

  const wordCount = value.replace(/\s/g, '').length
  const readMinutes = Math.max(1, Math.ceil(value.split(/\s+/).filter(Boolean).length / 300))

  return (
    <div className="editor-wrapper">
      <EditorToolbar
        view={editorViewRef.current}
        previewMode={previewMode}
        onTogglePreview={() => setPreviewMode(p => !p)}
      />
      {previewMode ? (
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
