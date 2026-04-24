import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorView } from '@codemirror/view'

interface EditorProps {
  value: string
  onChange: (value: string) => void
}

export function Editor({ value, onChange }: EditorProps): JSX.Element {
  return (
    <CodeMirror
      value={value}
      height="100%"
      extensions={[
        markdown(),
        EditorView.lineWrapping
      ]}
      onChange={onChange}
      theme="light"
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        autocompletion: true,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true
      }}
    />
  )
}
