import { describe, it, expect } from 'vitest'
import { tokenize, cosineSimilarity, computeTFIDF, buildEdges } from './graph'

describe('graph service', () => {
  describe('tokenize', () => {
    it('should tokenize Chinese text', () => {
      const text = '这是一个测试文档'
      const tokens = tokenize(text)
      expect(tokens.size).toBeGreaterThan(0)
      // Check for Chinese character tokens (2-3 character grams)
      const hasChineseTokens = Array.from(tokens.keys()).some(t => /[\u4e00-\u9fff]{2,}/.test(t))
      expect(hasChineseTokens).toBe(true)
    })

    it('should tokenize English text', () => {
      const text = 'This is a test document for analysis'
      const tokens = tokenize(text)
      expect(tokens.has('test')).toBe(true)
      expect(tokens.has('document')).toBe(true)
      expect(tokens.has('analysis')).toBe(true)
    })

    it('should remove stopwords', () => {
      const text = 'the a an is are was were'
      const tokens = tokenize(text)
      expect(tokens.has('the')).toBe(false)
      expect(tokens.has('a')).toBe(false)
    })

    it('should handle markdown syntax', () => {
      const text = '# Title\n\n**Bold** and *italic*'
      const tokens = tokenize(text)
      expect(tokens.has('title')).toBe(true)
      expect(tokens.has('bold')).toBe(true)
    })

    it('should handle code blocks', () => {
      const text = '```javascript\nconst x = 1;\n```\n\n正文内容'
      const tokens = tokenize(text)
      // Code blocks should be removed or tokenized differently
      expect(tokens.has('正文')).toBe(true)
      expect(tokens.has('内容')).toBe(true)
    })
  })

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vecA = new Map([['a', 1], ['b', 2]])
      const vecB = new Map([['a', 1], ['b', 2]])
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1)
    })

    it('should return 0 for orthogonal vectors', () => {
      const vecA = new Map([['a', 1]])
      const vecB = new Map([['b', 1]])
      expect(cosineSimilarity(vecA, vecB)).toBe(0)
    })

    it('should handle empty vectors', () => {
      const vecA = new Map()
      const vecB = new Map([['a', 1]])
      expect(cosineSimilarity(vecA, vecB)).toBe(0)
    })
  })

  describe('computeTFIDF', () => {
    it('should compute TF-IDF vectors', () => {
      const docs = [
        { file: 'a.md', title: 'A', tags: ['tag1'], tokens: new Map([['word', 2], ['test', 1]]) },
        { file: 'b.md', title: 'B', tags: ['tag1'], tokens: new Map([['word', 1], ['other', 3]]) }
      ]
      const { vectors, idf } = computeTFIDF(docs)
      expect(vectors).toHaveLength(2)
      expect(idf.size).toBeGreaterThan(0)
    })

    it('should boost tags', () => {
      const docs = [
        { file: 'a.md', title: 'A', tags: ['important'], tokens: new Map() },
        { file: 'b.md', title: 'B', tags: ['important'], tokens: new Map() }
      ]
      const { vectors } = computeTFIDF(docs)
      expect(vectors[0].get('important')).toBeGreaterThan(0)
    })
  })

  describe('buildEdges', () => {
    it('should create tag-based edges', () => {
      const docs = [
        { file: 'a.md', title: 'A', tags: ['tag1'], tokens: new Map() },
        { file: 'b.md', title: 'B', tags: ['tag1'], tokens: new Map() }
      ]
      const { vectors, idf } = computeTFIDF(docs)
      const edges = buildEdges(docs, vectors, idf)
      expect(edges.length).toBeGreaterThan(0)
      expect(edges[0].relation).toBe('shared_tag')
    })

    it('should create content-based edges', () => {
      const docs = [
        { file: 'a.md', title: 'A', tags: [], tokens: new Map([['word', 5]]) },
        { file: 'b.md', title: 'B', tags: [], tokens: new Map([['word', 5]]) }
      ]
      const { vectors, idf } = computeTFIDF(docs)
      const edges = buildEdges(docs, vectors, idf)
      expect(edges.some(e => e.relation === 'similar_content')).toBe(true)
    })

    it('should cap edges at MAX_EDGES', () => {
      const docs = Array.from({ length: 50 }, (_, i) => ({
        file: `${i}.md`,
        title: `${i}`,
        tags: [],
        tokens: new Map([['word', 1]])
      }))
      const { vectors, idf } = computeTFIDF(docs)
      const edges = buildEdges(docs, vectors, idf)
      expect(edges.length).toBeLessThanOrEqual(200)
    })
  })
})
