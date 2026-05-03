/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react'

export function useAIInsert(
  content: string,
  isNativePreview: boolean,
  selectedFile: string | null,
  setContent: (v: string) => void,
  setIsDirty: (v: boolean) => void,
  showToast: (type: string, msg: string) => void,
  files: Array<{ path?: string; name?: string }>,
  handleSelectFile: (path: string) => Promise<void>,
) {
  const handleNavigateToPage = useCallback((filePath: string) => {
    const exact = files.find(f => f.path === filePath)
    if (exact) {
      void handleSelectFile(filePath)
    } else {
      const name = filePath.split('/').pop() ?? filePath
      const found = files.find(f => f.name === name || f.path?.endsWith(name))
      if (found) void handleSelectFile(found.path!)
    }
  }, [files, handleSelectFile])

  const handleInsertToDoc = !isNativePreview && selectedFile
    ? (aiContent: string) => {
        const separator = '\n\n---\n\n'
        const newContent = content + (content ? separator : '') + aiContent
        setContent(newContent)
        setIsDirty(true)
        showToast('success', '已插入到文档')
      }
    : undefined

  return { handleNavigateToPage, handleInsertToDoc }
}
