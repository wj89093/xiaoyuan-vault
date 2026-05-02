import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock window.addEventListener / removeEventListener (used by electron-log/renderer)
Object.defineProperty(global, 'window', {
  value: {
    api: {
      importFiles: vi.fn(),
      fetchUrl: vi.fn(),
      saveUrlContent: vi.fn(),
      chatLoad: vi.fn(),
      chatSessions: vi.fn().mockResolvedValue([]),
      chatCreate: vi.fn(),
      chatSave: vi.fn(),
      chatDelete: vi.fn(),
      chatAsk: vi.fn(),
      createFolder: vi.fn(),
      createFile: vi.fn(),
      saveFile: vi.fn(),
      saveAutoAISettings: vi.fn()
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  },
  writable: true
})

// Mock scrollIntoView
Object.defineProperty(global.Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true
})

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-1234'
  }
})
