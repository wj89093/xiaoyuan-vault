import { describe, it, expect } from 'vitest'
import { parseFrontmatter, applyFrontmatter, generateFileTemplate, extractWikiLinks } from './frontmatter'

describe('frontmatter', () => {
  describe('parseFrontmatter', () => {
    it('should parse basic frontmatter', () => {
      const content = `---
title: "测试文档"
type: note
tags: [test, demo]
---

正文内容`
      const result = parseFrontmatter(content)
      expect(result.frontmatter.title).toBe('测试文档')
      expect(result.frontmatter.type).toBe('note')
      expect(result.frontmatter.tags).toEqual(['test', 'demo'])
      expect(result.content.trim()).toBe('正文内容')
    })

    it('should handle missing frontmatter', () => {
      const content = '纯正文内容'
      const result = parseFrontmatter(content)
      expect(result.frontmatter).toEqual({})
      expect(result.content).toBe('纯正文内容')
    })

    it('should parse relationships', () => {
      const content = `---
title: "公司A"
type: company
relationships:
  - type: founded_by
    target: "创始人张三"
    confidence: EXTRACTED
---

正文`
      const result = parseFrontmatter(content)
      expect(result.frontmatter.relationships).toHaveLength(1)
      expect(result.frontmatter.relationships![0].target).toBe('创始人张三')
    })

    it('should parse open threads', () => {
      const content = `---
title: "项目X"
openThreads:
  - content: "确认技术方案"
    status: open
    created: "2026-04-29"
---

正文`
      const result = parseFrontmatter(content)
      expect(result.frontmatter.openThreads).toHaveLength(1)
      expect(result.frontmatter.openThreads![0].status).toBe('open')
    })

    it('should handle empty frontmatter block', () => {
      const content = `---
---

正文`
      const result = parseFrontmatter(content)
      expect(result.frontmatter).toEqual({})
    })
  })

  describe('applyFrontmatter', () => {
    it('should add frontmatter to content without one', () => {
      const content = '正文内容'
      const frontmatter = { title: '新标题', type: 'note' }
      const result = applyFrontmatter(content, frontmatter)
      expect(result).toContain('---')
      expect(result).toContain('title: "新标题"')
      expect(result).toContain('type: note')
      expect(result).toContain('正文内容')
    })

    it('should update existing frontmatter', () => {
      const content = `---
title: "旧标题"
type: old
---

正文`
      const frontmatter = { title: '新标题', type: 'note', tags: ['new'] }
      const result = applyFrontmatter(content, frontmatter)
      expect(result).toContain('title: "新标题"')
      expect(result).toContain('type: note')
      expect(result).toContain('tags:')
      expect(result).not.toContain('type: old')
    })

    it('should preserve existing content', () => {
      const content = `---
title: "标题"
---

第一行
第二行
第三行`
      const result = applyFrontmatter(content, { title: '新标题' })
      expect(result).toContain('第一行')
      expect(result).toContain('第二行')
      expect(result).toContain('第三行')
    })
  })

  describe('generateFileTemplate', () => {
    it('should generate template with title', () => {
      const result = generateFileTemplate('测试标题')
      expect(result).toContain('title: "测试标题"')
      expect(result).toContain('type: note')
      expect(result).toContain('# 测试标题')
    })

    it('should use provided type', () => {
      const result = generateFileTemplate('公司A', 'company')
      expect(result).toContain('type: company')
    })

    it('should include timestamp fields', () => {
      const result = generateFileTemplate('测试')
      expect(result).toContain('created:')
      expect(result).toContain('updated:')
    })

    it('should include default sections', () => {
      const result = generateFileTemplate('测试')
      expect(result).toContain('## 基本信息')
      expect(result).toContain('## Open Threads')
      expect(result).toContain('## See Also')
    })
  })

  describe('extractWikiLinks', () => {
    it('should extract wiki links', () => {
      const content = '参见 [[公司A]] 和 [[项目B]] 的文档'
      const links = extractWikiLinks(content)
      expect(links).toEqual(['公司A', '项目B'])
    })

    it('should handle empty content', () => {
      const links = extractWikiLinks('')
      expect(links).toEqual([])
    })

    it('should not extract malformed links', () => {
      const content = '[[未完成链接'
      const links = extractWikiLinks(content)
      expect(links).toEqual([])
    })

    it('should handle display title syntax', () => {
      const content = '[[文件A|显示标题]]'
      const links = extractWikiLinks(content)
      expect(links).toEqual(['文件A'])
    })
  })
})
