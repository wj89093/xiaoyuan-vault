function testAdContent(repeatEmoji, repeatLink) {
  const content = '🎉🔥💥 限时优惠！点击链接领取福利！'.repeat(repeatEmoji) + ' https://example.com'.repeat(repeatLink)
  const stripped = content.replace(/^---[\s\S]*?---\n?/, '').trim()
  const wordCount = stripped.replace(/\s+/g, ' ').trim().length
  const emojiCount = (stripped.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length
  const linkCount = (stripped.match(/https?:\/\/[^\s]+/g) || []).length
  
  console.log(`repeatEmoji=${repeatEmoji}, repeatLink=${repeatLink}, wordCount=${wordCount}, emojiCount=${emojiCount}, linkCount=${linkCount}`)
  
  if (emojiCount > 10 && linkCount > 5 && wordCount < 300) {
    console.log('  -> Would be rejected as trash')
    return true
  } else {
    console.log('  -> Would pass')
    return false
  }
}

for (let e = 5; e <= 15; e++) {
  for (let l = 3; l <= 8; l++) {
    if (testAdContent(e, l)) {
      console.log(`Found: emoji=${e}, links=${l}`)
      process.exit(0)
    }
  }
}
