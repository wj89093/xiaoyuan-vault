import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AIChat } from './AIChat'

describe('AIChat', () => {
  const mockMessages = [
    { id: '1', role: 'user', content: '你好' },
    { id: '2', role: 'assistant', content: '你好！有什么可以帮你的？' }
  ]

  it('should render empty state', () => {
    render(<AIChat messages={[]} onSend={() => {}} loading={false} />)
    expect(screen.getByText('向我提问，搜遍全库')).toBeInTheDocument()
  })

  it('should render messages', () => {
    render(<AIChat messages={mockMessages} onSend={() => {}} loading={false} />)
    expect(screen.getByText('你好')).toBeInTheDocument()
    expect(screen.getByText('你好！有什么可以帮你的？')).toBeInTheDocument()
  })

  it('should call onSend when submitting', () => {
    const onSend = vi.fn()
    render(<AIChat messages={[]} onSend={onSend} loading={false} />)
    const input = screen.getByPlaceholderText('输入问题，按 Enter 发送...')
    fireEvent.change(input, { target: { value: '测试问题' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('测试问题')
  })

  it('should show loading state', () => {
    render(<AIChat messages={mockMessages} onSend={() => {}} loading={true} />)
    expect(screen.getByText('思考中...')).toBeInTheDocument()
  })

  it('should switch to session list view', () => {
    render(<AIChat messages={mockMessages} onSend={() => {}} loading={false} />)
    const historyBtn = screen.getByTitle('历史会话')
    fireEvent.click(historyBtn)
    expect(screen.getByText('历史会话')).toBeInTheDocument()
  })

  it('should call onSaveToVault', () => {
    const onSaveToVault = vi.fn()
    const messagesWithSource = [
      { id: '1', role: 'user', content: '问题' },
      { id: '2', role: 'assistant', content: '答案', sourceMode: 'knowledge_base' }
    ]
    render(<AIChat messages={messagesWithSource} onSend={() => {}} loading={false} onSaveToVault={onSaveToVault} />)
    const saveBtn = screen.getByText('保存到知识库')
    fireEvent.click(saveBtn)
    expect(onSaveToVault).toHaveBeenCalled()
  })
})
