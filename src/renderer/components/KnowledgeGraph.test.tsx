import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { KnowledgeGraph } from './KnowledgeGraph'

// Mock D3 with a more complete mock that supports chaining
vi.mock('d3', () => ({
  select: () => createMockSelection(),
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

function createMockSelection() {
  const mockSel = {
    selectAll: () => ({ remove: vi.fn() }),
    attr: () => mockSel,
    style: () => mockSel,
    append: () => mockSel,
    call: vi.fn(),
    select: () => mockSel,
    data: () => ({ enter: () => ({ append: () => mockSel }) })
  }
  return mockSel
}

describe('KnowledgeGraph', () => {
  const mockFiles = [
    { path: '1-人物/张三.md', name: '张三.md', isDirectory: false, tags: '投资人' },
    { path: '2-公司/公司A.md', name: '公司A.md', isDirectory: false, tags: '合成生物学' },
    { path: '3-项目/项目X.md', name: '项目X.md', isDirectory: false, tags: '' }
  ]

  it('should render empty state', () => {
    render(<KnowledgeGraph files={[]} selectedFile={null} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('没有可显示的文件')).toBeInTheDocument()
  })
})
