import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseFrontmatter, extractWikiLinks } from './frontmatter'
import { assessContentWorth } from './autoAIEngine'
import { tokenize, cosineSimilarity } from './graph'

// Mock electron-log
vi.mock('electron-log/main', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('Integration: Content Pipeline', () => {
  it('should process markdown file through full pipeline', () => {
    // 1. Parse frontmatter
    const rawContent = `---
title: "公司A"
type: company
tags: [合成生物学, 融资]
---

# 公司A

公司A是一家合成生物学企业，最近完成了B轮融资。

## 融资历史

- 2024年：A轮 1000万
- 2025年：B轮 5000万

## 相关公司

参见 [[公司B]] 和 [[公司C]] 的竞争分析。`

    const { frontmatter, content } = parseFrontmatter(rawContent)
    // Parser keeps quotes in values
    expect(frontmatter.title).toBe('"公司A"')
    expect(frontmatter.type).toBe('company')

    // 2. Extract wiki links
    const links = extractWikiLinks(content)
    expect(links).toContain('公司B')
    expect(links).toContain('公司C')

    // 3. Assess content worth
    const assessment = assessContentWorth(rawContent)
    expect(assessment.worth).toBe(true)
    // Content type depends on length and structure
    expect(['article', 'note']).toContain(assessment.contentType)

    // 4. Tokenize for graph
    const tokens = tokenize(content)
    // Should have some tokens
    expect(tokens.size).toBeGreaterThan(0)
  })

  it('should handle Chinese and English mixed content', () => {
    const content = `---
title: "Xampla"
type: company
---

Xampla is a UK-based company working on synthetic biology.

参见 [[英国]] 的生物技术政策。`

    const { frontmatter } = parseFrontmatter(content)
    expect(frontmatter.title).toBe('"Xampla"')

    const tokens = tokenize(content)
    // Tokenize extracts English words
    expect(tokens.has('xampla')).toBe(true)
  })

  it('should calculate similarity between related documents', () => {
    const doc1 = new Map([['合成生物学', 0.5], ['融资', 0.3]])
    const doc2 = new Map([['合成生物学', 0.4], ['融资', 0.4]])
    const similarity = cosineSimilarity(doc1, doc2)
    expect(similarity).toBeGreaterThan(0)
    expect(similarity).toBeLessThan(1)
  })

  it('should reject low-quality imported content', () => {
    const importedContent = 'https://example.com/article'
    const assessment = assessContentWorth(importedContent)
    expect(assessment.worth).toBe(false)
    expect(assessment.contentType).toBe('snippet')
  })
})