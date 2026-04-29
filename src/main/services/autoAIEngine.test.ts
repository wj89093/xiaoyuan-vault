import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assessContentWorth } from './autoAIEngine'

describe('assessContentWorth', () => {
  it('should reject empty content', () => {
    const result = assessContentWorth('')
    expect(result.worth).toBe(false)
    expect(result.score).toBe(0)
  })

  it('should reject too short content', () => {
    const result = assessContentWorth('短内容')
    expect(result.worth).toBe(false)
    expect(result.reason).toContain('too short')
  })

  it('should reject URL-only content', () => {
    const result = assessContentWorth('https://example.com')
    expect(result.worth).toBe(false)
    expect(result.contentType).toBe('snippet')
  })

  it('should reject CLI output', () => {
    const result = assessContentWorth('/usr/local/bin/node\nat main.js:10:5')
    expect(result.worth).toBe(false)
    expect(result.contentType).toBe('log')
  })

  it('should accept article-length content', () => {
    const content = '# 标题\n\n'.repeat(100)
    const result = assessContentWorth(content)
    expect(result.worth).toBe(true)
    expect(result.score).toBeGreaterThan(0.5)
    expect(result.contentType).toBe('article')
  })

  it('should accept structured markdown', () => {
    const content = `# 标题

## 第一节

这是一段有意义的正文内容，讨论了某个重要话题。

## 第二节

更多内容在这里。

\`\`\`javascript
const x = 1;
\`\`\`
`
    const result = assessContentWorth(content)
    expect(result.worth).toBe(true)
    expect(result.score).toBeGreaterThan(0.4)
  })

  it('should reject ad-like content', () => {
    const content = '🎉🔥💥 限时优惠！点击链接领取福利！'.repeat(20) + ' https://example.com'.repeat(10)
    const result = assessContentWorth(content)
    expect(result.worth).toBe(false)
    expect(result.contentType).toBe('trash')
  })

  it('should cap score at 1.0', () => {
    const content = '# '.repeat(50) + '\n\n' + '正文'.repeat(1000)
    const result = assessContentWorth(content)
    expect(result.score).toBeLessThanOrEqual(1.0)
  })
})
