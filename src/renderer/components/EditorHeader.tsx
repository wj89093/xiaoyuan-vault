/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link2 } from 'lucide-react'

interface EditorHeaderProps {
  selectedFile: string | null
  isDirty: boolean
  onSave: () => void
  showBacklinks: boolean
  onToggleBacklinks: () => void
}

export function EditorHeader({ selectedFile, isDirty, onSave, showBacklinks, onToggleBacklinks }: EditorHeaderProps): JSX.Element {
  return (
    <div className="editor-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="editor-title">{selectedFile?.split('/').pop()}</span>
        {isDirty && <span className="editor-status">未保存</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {selectedFile && (
          <button
            className={`btn ${showBacklinks ? 'btn-active' : ''}`}
            onClick={onToggleBacklinks}
            title="反向链接"
          >
            <Link2 size={14} />
            <span>链入</span>
          </button>
        )}
        <button className="btn" onClick={onSave}>保存</button>
      </div>
    </div>
  )
}
