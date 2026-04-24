interface WelcomeScreenProps {
  onOpenVault: () => void
}

export function WelcomeScreen({ onOpenVault }: WelcomeScreenProps): JSX.Element {
  return (
    <div className="welcome-screen">
      <div style={{ fontSize: 64 }}>📚</div>
      <div className="welcome-title">晓园 Vault</div>
      <div className="welcome-desc">
        AI 增强的个人知识库。<br />
        支持 Markdown 编辑、文件夹管理、<br />
        AI 分类、标签、摘要和智能搜索。
      </div>
      <button className="toolbar-btn primary" onClick={onOpenVault}>
        打开知识库文件夹
      </button>
      <div style={{ fontSize: 12, color: '#999', marginTop: 24 }}>
        选择一个文件夹作为你的知识库
      </div>
    </div>
  )
}
