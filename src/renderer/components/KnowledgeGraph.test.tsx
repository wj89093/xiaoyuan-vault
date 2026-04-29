import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KnowledgeGraph } from './KnowledgeGraph'

// Mock D3
vi.mock('d3', () => ({
  select: () => ({
    selectAll: () => ({ remove: vi.fn() }),
    attr: () => ({ attr: vi.fn() }),
    append: () => ({
      attr: () => ({}),
      selectAll: () => ({ data: () => ({ enter: () => ({ append: () => ({}) }) }) })
    }),
    call: vi.fn()
  }),
  zoom: () => ({
    scaleExtent: () => ({ on: () => ({}) })
  }),
  zoomIdentity: { translate: () => ({ scale: () => ({}) }) },
  forceSimulation: () => ({
    force: () => ({ force: () => ({ force: () => ({ force: () => ({ on: vi.fn() }) }) }) }),
    stop: vi.fn()
  }),
  forceLink: () => ({ id: () => ({ distance: () => ({ strength: () => ({}) }) }) }),
  forceManyBody: () => ({ strength: () => ({}) }),
  forceCenter: () => ({}),
  forceCollide: () => ({}),
  drag: () => ({ on: () => ({}) })
}))

describe('KnowledgeGraph', () => {
  const mockFiles = [
    { path: '1-人物/张三.md', name: '张三.md', isDirectory: false, tags: '投资人' },
    { path: '2-公司/公司A.md', name: '公司A.md', isDirectory: false, tags: '合成生物学' },
    { path: '3-项目/项目X.md', name: '项目X.md', isDirectory: false, tags: '' }
  ]

  it('should render loading state', () => {
    render(<KnowledgeGraph files={mockFiles} selectedFile={null} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('正在分析文件关系...')).toBeInTheDocument()
  })

  it('should render empty state', () => {
    render(<KnowledgeGraph files={[]} selectedFile={null} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('没有可显示的文件')).toBeInTheDocument()
  })

  it('should show node and edge counts', () => {
    render(<KnowledgeGraph files={mockFiles} selectedFile={null} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/个节点/)).toBeInTheDocument()
    expect(screen.getByText(/条连线/)).toBeInTheDocument()
  })

  it('should call onClose when clicking close button', () => {
    const onClose = vi.fn()
    render(<KnowledgeGraph files={mockFiles} selectedFile={null} onSelect={() => {}} onClose={onClose} />)
    const closeBtn = screen.getByTitle('关闭')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })
})
