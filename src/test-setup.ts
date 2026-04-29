import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock electron APIs
Object.defineProperty(global, 'window', {
  value: {
    api: {
      importFiles: vi.fn(),
      fetchUrl: vi.fn(),
      saveUrlContent: vi.fn(),
      chatLoad: vi.fn(),
      createFolder: vi.fn(),
      createFile: vi.fn(),
      saveFile: vi.fn(),
      saveAutoAISettings: vi.fn()
    }
  },
  writable: true
})

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234'
  }
})
