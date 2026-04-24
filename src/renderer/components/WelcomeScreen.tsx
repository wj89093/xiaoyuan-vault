import { Library } from 'lucide-react'

interface WelcomeScreenProps {
  onOpenVault: () => void
}

export function WelcomeScreen({ onOpenVault }: WelcomeScreenProps): JSX.Element {
  return (
    <div className="welcome-screen">
      <Library className="welcome-icon" size={64} strokeWidth={1.5} />
      <div className="welcome-title">晓园 Vault</div>
      <div className="welcome-desc">
        AI 增强的个人知识库。支持 Markdown 编辑、文件夹管理、
        AI 分类、标签、摘要和智能搜索。
      </div>
      <button className="btn btn-primary" onClick={onOpenVault}>
        打开知识库文件夹
      </button>
      <div className="loading" style={{ marginTop: 24 }}>
        选择一个文件夹作为你的知识库
      </div>
    </div>
  )
}
