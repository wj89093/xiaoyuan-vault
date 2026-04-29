import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Editor } from './Editor'

// Mock CodeMirror
di.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: any) => (
    <textarea
      data-testid="codemirror"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}))

describe('Editor', () => {
  it('should render with value', () => {
    render(<Editor value="# Test" onChange={() => {}} />)
    expect(screen.getByTestId('codemirror')).toHaveValue('# Test')
  })

  it('should call onChange when content changes', () => {
    const onChange = vi.fn()
    render(<Editor value="" onChange={onChange} />)
    fireEvent.change(screen.getByTestId('codemirror'), { target: { value: 'new content' } })
    expect(onChange).toHaveBeenCalledWith('new content')
  })

  it('should show word count', () => {
    render(<Editor value="hello world" onChange={() => {}} />)
    expect(screen.getByText(/字/)).toBeInTheDocument()
  })

  it('should show reading time', () => {
    render(<Editor value="test content" onChange={() => {}} />)
    expect(screen.getByText(/分钟/)).toBeInTheDocument()
  })

  it('should toggle preview mode', () => {
    render(<Editor value="# Title" onChange={() => {}} />)
    const previewBtn = screen.getByTitle(/预览|编辑/)
    fireEvent.click(previewBtn)
    expect(screen.getByText('Title')).toBeInTheDocument()
  })
})
