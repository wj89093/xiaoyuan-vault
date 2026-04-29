const content = '🎉🔥💥 限时优惠！点击链接领取福利！'.repeat(20) + ' https://example.com'.repeat(10)

// Strip frontmatter if present
const stripped = content.replace(/^---[\s\S]*?---\n?/, '').trim()

// Skip empty content
if (!stripped || stripped.length === 0) {
  console.log({ worth: false, score: 0, reason: 'empty content', contentType: 'trash' })
  process.exit(0)
}

// Skip too short
const wordCount = stripped.replace(/\s+/g, ' ').trim().length
console.log('wordCount:', wordCount)

// Skip pure URL-only content
const urlPattern = /^https?:\/\/[^\s]+\s*$/
if (urlPattern.test(stripped)) {
  console.log({ worth: false, score: 0.2, reason: 'URL-only content', contentType: 'snippet' })
  process.exit(0)
}

// Skip CLI logs
const cliPatterns = [
  /\/usr\/(?:local\/)?(?:bin|lib|share)\//,
  /node_modules\//,
  /at\s+\w+\.\w+\s+\(.+\.\w+:\d+:\d+\)/,
  /^\s*[\[\]{}()]=>/m,
]
for (const pattern of cliPatterns) {
  if (pattern.test(stripped) && wordCount < 200) {
    console.log({ worth: false, score: 0.3, reason: 'CLI/log output detected', contentType: 'log' })
    process.exit(0)
  }
}

// Skip ad-like content
const emojiCount = (stripped.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length
const linkCount = (stripped.match(/https?:\/\/[^\s]+/g) || []).length
console.log('emojiCount:', emojiCount, 'linkCount:', linkCount)

if (emojiCount > 10 && linkCount > 5 && wordCount < 300) {
  console.log({ worth: false, score: 0.2, reason: 'ad-like content (emoji+links)', contentType: 'trash' })
  process.exit(0)
}

// Score calculation
let score = 0.5
let contentType = 'note'

if (wordCount > 1000) { score += 0.2; contentType = 'article' }
else if (wordCount > 300) { score += 0.1; contentType = 'article' }

const paragraphs = stripped.split(/\n\n+/).filter(p => p.trim().length > 100)
if (paragraphs.length >= 3) score += 0.15

// Has lists
const listItems = stripped.split('\n').filter(l => /^\s*[-*]\s+/.test(l)).length
if (listItems >= 3) score += 0.1

// Has code blocks
if (stripped.includes('```')) score += 0.1

// Has headers
const headers = stripped.match(/^#{1,6}\s+/gm)
if (headers && headers.length >= 2) score += 0.1

score = Math.min(1.0, score)

console.log({ worth: score > 0.4, score, reason: 'content assessment', contentType })
