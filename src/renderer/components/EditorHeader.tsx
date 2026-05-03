/* eslint-disable @typescript-eslint/no-explicit-any */

interface EditorHeaderProps {
  selectedFile: string | null
  isDirty: boolean
  onSave: () => void
}

export function EditorHeader({ selectedFile, isDirty, onSave }: EditorHeaderProps): JSX.Element {
  return (
    <div className="editor-header">
      <span className="editor-title">{selectedFile?.split('/').pop()}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {isDirty && <span className="editor-status">未保存</span>}
        <button className="btn" onClick={onSave}>保存</button>
      </div>
    </div>
  )
}
