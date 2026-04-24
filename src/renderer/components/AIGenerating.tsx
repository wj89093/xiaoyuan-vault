import { Loader2 } from 'lucide-react'

interface AIGeneratingProps {
  message?: string
}

export function AIGenerating({ message = 'AI 思考中...' }: AIGeneratingProps): JSX.Element {
  return (
    <div className="ai-generating">
      <Loader2 size={16} className="ai-generating-spinner" />
      <span>{message}</span>
    </div>
  )
}
