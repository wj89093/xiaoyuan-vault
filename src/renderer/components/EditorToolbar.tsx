import { Bold, Italic, Heading1, Heading2, Heading3, Link, Code, Table, Eye, EyeOff, List, ListOrdered, Quote, Columns, BookOpen, Undo2, Redo2, FileText } from 'lucide-react'
import React from 'react'

interface EditorToolbarProps {
  view: any
  previewMode: boolean
  onTogglePreview: () => void
  onToggleSplit: () => void
  splitView?: boolean
  readingModeActive?: boolean
  onReference?: (content: string, fileName: string) => void
}

export function EditorToolbar({ view, previewMode, onTogglePreview, onToggleSplit, splitView, readingModeActive, onReference }: EditorToolbarProps): JSX.Element {
  const insert = (template: string, cursorOffset?: number) => {
    if (!view) return
    const selection = view.state.selection.main
    const selectedText = view.state.sliceDoc(selection.from, selection.to)
    const text = template.replace('$TEXT', selectedText || '')
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: text },
      selection: cursorOffset != null
        ? { anchor: selection.from + cursorOffset, head: selection.from + cursorOffset }
        : undefined
    })
    view.focus()
  }

  const actions = [
    { icon: <Undo2 size={15} />, label: '撤销', action: () => {
      const state = view?.state
      if (state) {
        const tr = state.update({})
        view?.dispatch(tr)
      }
    }},
    { icon: <Redo2 size={15} />, label: '重做', action: () => {
      const state = view?.state
      if (state) {
        const tr = state.update({})
        view?.dispatch(tr)
      }
    }},
    { type: 'divider' as const },
    { icon: <Bold size={15} />, label: '粗体', action: () => insert('**$TEXT**', 2) },
    { icon: <Italic size={15} />, label: '斜体', action: () => insert('*$TEXT*', 1) },
    { type: 'divider' as const },
    { icon: <Heading1 size={15} />, label: 'H1', action: () => insert('# $TEXT\n') },
    { icon: <Heading2 size={15} />, label: 'H2', action: () => insert('## $TEXT\n') },
    { icon: <Heading3 size={15} />, label: 'H3', action: () => insert('### $TEXT\n') },
    { type: 'divider' as const },
    { icon: <Link size={15} />, label: '链接', action: () => insert('[$TEXT](url)') },
    { icon: <Code size={15} />, label: '代码', action: () => insert('`$TEXT`', 1) },
    { icon: <Table size={15} />, label: '表格',
      action: () => insert('| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| $TEXT | | |')
    },
    { type: 'divider' as const },
    { icon: <List size={15} />, label: '无序列表', action: () => insert('- $TEXT\n') },
    { icon: <ListOrdered size={15} />, label: '有序列表', action: () => insert('1. $TEXT\n') },
    { icon: <Quote size={15} />, label: '引用', action: () => insert('> $TEXT\n') },
    { type: 'divider' as const },
    { icon: <Columns size={15} />, label: splitView ? '关闭分屏' : '分屏', action: onToggleSplit, active: splitView },
    { type: 'divider' as const },
    { icon: <FileText size={15} />, label: '引用到AI', action: () => {
      if (!onReference || !view) return
      const doc = view.state.doc.toString()
      onReference(doc)
    }},
    { type: 'divider' as const },
    { icon: readingModeActive ? <EyeOff size={15} /> : <BookOpen size={15} />,
      label: readingModeActive ? '编辑模式' : '阅读模式',
      action: onTogglePreview,
      active: readingModeActive,
    },
  ]

  return (
    <div className="editor-toolbar">
      {actions.map((item, i) =>
        item.type === 'divider' ? (
          <span key={i} className="editor-toolbar-divider" />
        ) : (
          <button
            key={i}
            className={`editor-toolbar-btn${(item as any).active ? ' active' : ''}`}
            title={item.label}
            onClick={item.action}
          >
            {item.icon}
          </button>
        )
      )}
    </div>
  )
}