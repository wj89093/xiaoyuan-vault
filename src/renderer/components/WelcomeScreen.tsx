import { Library, FolderPlus, FolderOpen } from 'lucide-react'

interface WelcomeScreenProps {
  onOpenVault: () => void
  onNewVault: () => void
}

export function WelcomeScreen({ onOpenVault, onNewVault }: WelcomeScreenProps): JSX.Element {
  return (
    <div className="welcome-screen">
      <Library className="welcome-icon" size={64} strokeWidth={1.5} />
      <div className="welcome-title">晓园 Vault</div>
      <div className="welcome-desc">
        AI 增强的个人知识库。支持 Markdown 编辑、文件夹管理、
        AI 分类、标签、摘要和智能搜索。
      </div>
      <div className="welcome-actions">
        <button className="btn btn-primary" onClick={onNewVault}>
          <FolderPlus size={16} />
          新建知识库
        </button>
        <button className="btn btn-secondary" onClick={onOpenVault}>
          <FolderOpen size={16} />
          打开知识库文件夹
        </button>
      </div>
      <div className="loading" style={{ marginTop: 24 }}>
        选择一个文件夹作为你的知识库
      </div>
    </div>
  )
}
