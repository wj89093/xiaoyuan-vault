import { Bold, Italic, Heading1, Heading2, Heading3, Link, Code, Table, Eye, EyeOff, List, ListOrdered, Quote } from 'lucide-react'

interface EditorToolbarProps {
  view: any  // CodeMirror EditorView
  previewMode: boolean
  onTogglePreview: () => void
}

export function EditorToolbar({ view, previewMode, onTogglePreview }: EditorToolbarProps): JSX.Element {
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
    { icon: previewMode ? <EyeOff size={15} /> : <Eye size={15} />,
      label: previewMode ? '编辑' : '预览',
      action: onTogglePreview,
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
            className="editor-toolbar-btn"
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
