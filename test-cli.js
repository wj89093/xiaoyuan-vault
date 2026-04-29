const content = '/usr/local/bin/node\nat main.js:10:5\n'.repeat(50)
const stripped = content.replace(/^---[\s\S]*?---\n?/, '').trim()
const wordCount = stripped.replace(/\s+/g, ' ').trim().length
console.log('wordCount:', wordCount)

const cliPatterns = [
  /\/usr\/(?:local\/)?(?:bin|lib|share)\//,
  /node_modules\//,
  /at\s+\w+\.\w+\s+\(.+\.\w+:\d+:\d+\)/,
  /^\s*[\[\]{}()]=>/m,
]
for (const pattern of cliPatterns) {
  const matches = pattern.test(stripped)
  console.log('pattern', pattern, 'matches:', matches)
  if (matches && wordCount < 200) {
    console.log('Would be log')
    process.exit(0)
  }
}

console.log('Not detected as CLI')
