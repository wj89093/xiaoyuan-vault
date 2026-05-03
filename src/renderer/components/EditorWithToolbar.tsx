import { useState, useRef, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView, keymap, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'
/* eslint-disable react-hooks/rules-of-hooks, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, react-hooks/immutability, react-hooks/refs, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-invalid-this, @typescript-eslint/unbound-method, @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unused-expressions, prefer-const, prefer-rest-params, @typescript-eslint/no-misused-promises */


function insertMarkdown(view: EditorView, before: string, after = '') {
  const { state } = view
  const r = state.selection.main
  if (r.empty) {
    view.dispatch({ changes: { from: r.from, insert: before + after }, selection: { anchor: r.from + before.length } })
  } else {
    const sel = state.sliceDoc(r.from, r.to)
    view.dispatch({ changes: { from: r.from, to: r.to, insert: before + sel + after }, selection: { anchor: r.from + before.length, head: r.from + before.length + sel.length } })
  }
  view.focus()
}

function toggleLinePrefix(view: EditorView, prefix: string) {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const text = state.sliceDoc(line.from, line.to)
  if (text.startsWith(prefix)) {
    view.dispatch({ changes: { from: line.from, to: line.from + prefix.length, insert: '' } })
  } else {
    view.dispatch({ changes: { from: line.from, insert: prefix } })
  }
  view.focus()
}

const mdKeymap = keymap.of([
  { key: 'Mod-b', run: (v) => { insertMarkdown(v, '**'); return true } },
  { key: 'Mod-i', run: (v) => { insertMarkdown(v, '_'); return true } },
  { key: 'Mod-`', run: (v) => { insertMarkdown(v, '`'); return true } },
  { key: 'Mod-Shift-h', run: (v) => { toggleLinePrefix(v, '# '); return true } },
  { key: 'Mod-Shift-l', run: (v) => { toggleLinePrefix(v, '- '); return true } },
  { key: 'Mod-Shift-q', run: (v) => { toggleLinePrefix(v, '> '); return true } },
])

export function EditorWithToolbar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const viewRef = useRef<EditorView | null>(null)
  const [wordCount, setWordCount] = useState(0)

  const handleCreateEditor = useCallback((view: EditorView) => {
    viewRef.current = view
  }, [])

  const handleChange = useCallback((val: string) => {
    onChange(val)
    const cjk = (val.match(/[\u4e00-\u9fff\u3400-\u4dbf]/gu) ?? []).length
    const en = val.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/gu, ' ').trim().split(/\s+/).filter(Boolean).length
    setWordCount(cjk + en)
  }, [onChange])

  const insert = useCallback((before: string, after = '') => {
    insertMarkdown(viewRef.current!, before, after)
  }, [])

  const toggle = useCallback((prefix: string) => {
    toggleLinePrefix(viewRef.current!, prefix)
  }, [])

  const buttons = [
    { label: 'B', title: '加粗 (Ctrl+B)', onMouseDown: () => insert('**') },
    { label: 'I', title: '斜体 (Ctrl+I)', onMouseDown: () => insert('_') },
    { label: 'S', title: '删除线', onMouseDown: () => insert('~~') },
    { sep: true },
    { label: 'H1', title: '一级标题', onMouseDown: () => toggle('# ') },
    { label: 'H2', title: '二级标题', onMouseDown: () => toggle('## ') },
    { label: 'H3', title: '三级标题', onMouseDown: () => toggle('### ') },
    { sep: true },
    { label: '🔗', title: '链接', onMouseDown: () => insert('[', '](url)') },
    { label: '`', title: '行内代码', onMouseDown: () => insert('`') },
    { label: '```', title: '代码块', onMouseDown: () => insert('```\n', '\n```') },
    { sep: true },
    { label: '•', title: '无序列表', onMouseDown: () => toggle('- ') },
    { label: '1.', title: '有序列表', onMouseDown: () => toggle('1. ') },
    { label: '❝', title: '引用', onMouseDown: () => toggle('> ') },
    { label: '☐', title: '任务列表', onMouseDown: () => toggle('- [ ] ') },
    { label: '—', title: '分隔线', onMouseDown: () => insert('\n---\n') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="cm-toolbar">
        {buttons.map((btn, i) =>
          'sep' in btn ? (
            <span key={`s-${i}`} className="cm-toolbar-sep" />
          ) : (
            <button key={btn.label} className="cm-toolbar-btn" title={btn.title} onMouseDown={btn.onMouseDown}>
              {btn.label}
            </button>
          )
        )}
        <span className="cm-toolbar-count">{wordCount} 字</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CodeMirror
          onCreateEditor={handleCreateEditor}
          value={value}
          height="100%"
          extensions={[
            markdown(),
            history(),
            highlightActiveLine(),
            highlightSelectionMatches(),
            closeBrackets(),
            mdKeymap,
            keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...lintKeymap]),
            EditorView.lineWrapping,
          ]}
          onChange={handleChange}
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
    </div>
  )
}
