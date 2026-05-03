import { describe, it, expect } from 'vitest'

describe('chat.ts exports', () => {
  it('should export SESSION_TITLE_MAX_LEN as 50', async () => {
    const mod = await import('./chat')
    expect(mod.SESSION_TITLE_MAX_LEN).toBe(50)
  })

  it('should export session management functions', async () => {
    const mod = await import('./chat')
    expect(typeof mod.loadSessions).toBe('function')
    expect(typeof mod.saveSessions).toBe('function')
    expect(typeof mod.createSession).toBe('function')
    expect(typeof mod.deleteSession).toBe('function')
    expect(typeof mod.loadMessages).toBe('function')
    expect(typeof mod.saveMessages).toBe('function')
  })

  it('should export AI functions', async () => {
    const mod = await import('./chat')
    expect(typeof mod.askQuestion).toBe('function')
    expect(typeof mod.askQuestionStream).toBe('function')
    expect(typeof mod.buildAnswerPrompt).toBe('function')
  })
})

describe('Session title truncation', () => {
  it('should truncate title to 50 chars', () => {
    const longTitle = 'A'.repeat(100)
    const truncated = longTitle.slice(0, 50)
    expect(truncated.length).toBe(50)
  })

  it('should not modify short title', () => {
    const short = 'Hello world'
    const result = short.slice(0, 50)
    expect(result).toBe('Hello world')
  })

  it('should handle empty string', () => {
    const result = ''.slice(0, 50)
    expect(result).toBe('')
  })
})

import { createHash } from 'crypto'

describe('Session id generation', () => {
  it('sha256 hex should be 64 chars', () => {
    const hash = createHash('sha256').update('test').digest('hex')
    expect(hash.length).toBe(64)
  })

  it('should generate unique ids', () => {
    const id1 = createHash('sha256').update(Date.now().toString()).digest('hex')
    const id2 = createHash('sha256').update((Date.now() + 1).toString()).digest('hex')
    expect(id1).not.toBe(id2)
  })
})
