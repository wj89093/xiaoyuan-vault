import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchResults } from './SearchResults'

describe('SearchResults', () => {
  const mockResults = [
    { path: '1-人物/张三.md', name: '张三.md', isDirectory: false, modified: Date.now() },
    { path: '2-公司/公司A.md', name: '公司A.md', isDirectory: false, modified: Date.now() }
  ]

  it('should render results count', () => {
    render(<SearchResults results={mockResults} query="测试" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('2 个结果')).toBeInTheDocument()
  })

  it('should render empty state', () => {
    render(<SearchResults results={[]} query="不存在" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/未找到/)).toBeInTheDocument()
  })

  it('should call onSelect when clicking result', () => {
    const onSelect = vi.fn()
    render(<SearchResults results={mockResults} query="测试" onSelect={onSelect} onClose={() => {}} />)
    fireEvent.click(screen.getByText('张三.md'))
    expect(onSelect).toHaveBeenCalledWith('1-人物/张三.md')
  })

  it('should call onClose when clicking close', () => {
    const onClose = vi.fn()
    render(<SearchResults results={mockResults} query="测试" onSelect={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByTitle('关闭'))
    expect(onClose).toHaveBeenCalled()
  })

  it('should show file path', () => {
    render(<SearchResults results={mockResults} query="测试" onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('1-人物/张三.md')).toBeInTheDocument()
  })
})
