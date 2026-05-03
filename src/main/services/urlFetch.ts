import axios from 'axios'
import * as cheerio from 'cheerio'

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-invalid-this, @typescript-eslint/unbound-method */

const JINA_READER_BASE = 'https://r.jina.ai/'
const _MAX_CONTENT_LENGTH = 50000 // ~50KB
const FETCH_TIMEOUT = 15000 // 15s
const MIN_CONTENT_LENGTH = 20

export interface URLFetchResult {
  title: string
  content: string
  author?: string
  date?: string
  url: string
  source: 'jina' | 'direct' | 'wechat' | 'youtube' | 'twitter' | 'github' | 'reddit'
}

/**
 * 智能抓取：根据 URL 选择最佳抓取策略
 */
export async function fetchURL(url: string): Promise<URLFetchResult> {
  const cleanUrl = url.trim()
  if (!cleanUrl) {
    throw new Error('Empty URL')
  }

  // 1. 平台专用抓取
  if (cleanUrl.includes('mp.weixin.qq.com')) {
    return fetchWechat(cleanUrl)
  }
  if (cleanUrl.includes('youtube.com/') || cleanUrl.includes('youtu.be/')) {
    return fetchYouTube(cleanUrl)
  }
  if (cleanUrl.includes('twitter.com/') || cleanUrl.includes('x.com/')) {
    return fetchTwitter(cleanUrl)
  }
  if (cleanUrl.includes('github.com/')) {
    return fetchGitHub(cleanUrl)
  }
  if (cleanUrl.includes('reddit.com/')) {
    return fetchReddit(cleanUrl)
  }

  // 2. Jina Reader 通用抓取
  try {
    return await fetchViaJina(cleanUrl)
  } catch (jinaErr) {
    console.warn(`[Jina] failed: ${String(jinaErr)}, trying direct fetch`)
    
    // 3. 直接 HTML 抓取（降级方案）
    try {
      return await fetchDirectHTML(cleanUrl)
    } catch (directErr) {
      throw new Error(`Jina: ${String(jinaErr)} | Direct: ${String(directErr)}`)
    }
  }
}

/**
 * Jina Reader 抓取（通用方案）
 * 优点：自动提取正文，直接返回 Markdown
 */
async function fetchViaJina(url: string): Promise<URLFetchResult> {
  const jinaUrl = `${JINA_READER_BASE}${url}`
  
  const response = await axios.get(jinaUrl, {
    timeout: FETCH_TIMEOUT,
    headers: {
      'X-Return-Format': 'markdown',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  })

  const content = response.data as string
  
  if (content.length < MIN_CONTENT_LENGTH) {
    throw new Error('Content too short')
  }

  // 提取标题（第一行通常是标题）
  const lines = content.split('\n')
  const title = lines[0].replace(/^#\s*/, '').trim() || '未命名'
  const body = lines.slice(1).join('\n').trim()

  return {
    title,
    content: body,
    url,
    source: 'jina'
  }
}

/**
 * 直接 HTML 抓取（降级方案）
 */
async function fetchDirectHTML(url: string): Promise<URLFetchResult> {
  const response = await axios.get(url, {
    timeout: FETCH_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  })

  const html = response.data as string
  const $ = cheerio.load(html)
  
  // Remove script and style elements
  $('script').remove()
  $('style').remove()
  $('nav').remove()
  $('header').remove()
  $('footer').remove()
  $('aside').remove()
  
  // Try to find main content area
  let content = ''
  const mainContent = $('main, article, [role="main"], .content, .post, .entry').first()
  if (mainContent.length > 0) {
    content = mainContent.text()
  } else {
    // Fallback to body
    content = $('body').text()
  }
  
  // Clean up whitespace
  content = content.replace(/\s+/g, ' ').trim()
  
  // Extract title
  const title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                '未命名'

  return {
    title,
    content,
    url,
    source: 'direct'
  }
}

/**
 * 微信公众号抓取
 */
async function fetchWechat(url: string): Promise<URLFetchResult> {
  const response = await axios.get(url, {
    timeout: FETCH_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    }
  })

  const html = response.data as string
  const $ = cheerio.load(html)

  // 尝试多种内容选择器
  let content = ''
  
  // 1. 传统文章：js_content
  const jsContent = $('#js_content').html()
  if (jsContent && jsContent.length > MIN_CONTENT_LENGTH) {
    content = cleanWechatContent(jsContent)
  }
  
  // 2. 新格式：content_noencode
  if (!content) {
    const noencodeMatch = html.match(/content_noencode\s*=\s*"([^"]+)"/)
    if (noencodeMatch) {
      content = cleanWechatContent(noencodeMatch[1])
    }
  }
  
  // 3. 降级：og:description
  if (!content || content.length < MIN_CONTENT_LENGTH) {
    const desc = $('meta[property="og:description"]').attr('content')
    if (desc) {
      content = desc.replace(/\\x0a/g, '\n').replace(/\\x26amp;amp;/g, '&')
    }
  }

  // 4. 最后手段：标题
  const title = $('meta[property="og:title"]').attr('content') ??
                ($('h1').text() || $('title').text() || '微信文章')

  if (!content && title) {
    content = title
  }

  if (!content) {
    throw new Error('WeChat content extraction failed')
  }

  return {
    title: title.trim(),
    content: content.trim(),
    url,
    source: 'wechat'
  }
}

/**
 * 清理微信内容（处理 HTML 实体和格式）
 */
function cleanWechatContent(html: string): string {
  const $ = cheerio.load(html)
  
  // 移除样式标签
  $('style').remove()
  $('script').remove()
  
  // 获取文本
  let text = $.text()
  
  // 解码 HTML 实体
  text = text.replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'")
               .replace(/&nbsp;/g, ' ')
  
  // 清理多余空白
  text = text.replace(/\n{3,}/g, '\n\n')
             .replace(/^\s+|\s+$/g, '')
  
  return text
}

/**
 * YouTube 字幕提取
 */
async function fetchYouTube(url: string): Promise<URLFetchResult> {
  const videoId = extractYouTubeId(url)
  if (!videoId) {
    throw new Error('Invalid YouTube URL')
  }

  // 获取视频页面
  const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
    timeout: FETCH_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }
  })

  const html = response.data as string
  
  // 提取标题
  const titleMatch = html.match(/"title":"([^"]+)"/)
  const title = titleMatch ? titleMatch[1].replace(/\\u0026/g, '&') : 'YouTube Video'

  // 提取字幕（简化版，实际需调用 InnerTube API）
  // 这里返回视频描述作为内容
  const descMatch = html.match(/"shortDescription":"([^"]+)"/)
  const description = descMatch ? descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') : ''

  return {
    title: title.trim(),
    content: `[YouTube 视频] ${title}\n\n${description}\n\n链接: ${url}`,
    url,
    source: 'youtube'
  }
}

/**
 * Twitter/X 抓取
 */
async function fetchTwitter(url: string): Promise<URLFetchResult> {
  // 使用 fxtwitter API
  const fxtwitterUrl = url.replace(/twitter\.com|x\.com/, 'api.fxtwitter.com')
  
  const response = await axios.get(fxtwitterUrl, {
    timeout: FETCH_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Bot/0.1)'
    }
  })

  const data = response.data
  const tweet = data.tweet as Record<string, unknown>
  
  if (!tweet) {
    throw new Error('Twitter API response invalid')
  }

  const author = (tweet.author as Record<string, string> | undefined)?.name ?? 'Unknown'
  const handle = (tweet.author as Record<string, string> | undefined)?.screen_name ?? ''
  const text = (tweet.text as string | undefined) ?? ''

  return {
    title: `@${handle}: ${text.slice(0, 50)}...`,
    content: `> @${handle} (${author})\n\n${text}`,
    url,
    source: 'twitter'
  }
}

/**
 * GitHub 仓库抓取
 */
async function fetchGitHub(url: string): Promise<URLFetchResult> {
  // 解析 owner/repo
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/)
  if (!match) {
    throw new Error('Invalid GitHub URL')
  }

  const [, owner, repo] = match

  // 获取仓库信息
  const repoResponse = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
    timeout: FETCH_TIMEOUT,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OpenWiki/0.1'
    }
  })

  const repoData = repoResponse.data
  
  // 获取 README
  let readme = ''
  try {
    const readmeResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      {
        timeout: FETCH_TIMEOUT,
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OpenWiki/0.1'
        }
      }
    )
    const readmeData = readmeResponse.data
    if (readmeData.content) {
      readme = Buffer.from(readmeData.content, 'base64').toString('utf-8')
    }
  } catch {
    // README 可能不存在
  }

  const content = `# ${repoData.full_name}\n\n` +
    `⭐ ${repoData.stargazers_count} stars | ` +
    `📝 ${repoData.language ?? 'Unknown'}\n\n` +
    `${repoData.description ?? ''}\n\n` +
    (readme ? `## README\n\n${readme.slice(0, 10000)}` : '')

  return {
    title: repoData.full_name,
    content,
    url,
    source: 'github'
  }
}

/**
 * Reddit 抓取
 */
async function fetchReddit(url: string): Promise<URLFetchResult> {
  // Reddit 支持 .json 后缀获取 JSON
  const jsonUrl = url.replace(/\/?$/, '.json')
  
  const response = await axios.get(jsonUrl, {
    timeout: FETCH_TIMEOUT,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }
  })

  const data = response.data
  const post = data[0]?.data?.children[0]?.data
  
  if (!post) {
    throw new Error('Reddit post not found')
  }

  return {
    title: post.title ?? 'Reddit Post',
    content: `${post.selftext ?? ''}\n\n` +
             `[原文链接](${url})`,
    url,
    source: 'reddit'
  }
}

/**
 * 提取 YouTube 视频 ID
 */
function extractYouTubeId(url: string): string | null {
  // youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return shortMatch[1]

  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]

  // youtube.com/embed/VIDEO_ID or shorts
  const embedMatch = url.match(/youtube\.com\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return embedMatch[1]

  return null
}

/**
 * 保存 URL 内容到 Vault
 */
export async function saveURLToVault(
  url: string,
  vaultPath: string,
  result: URLFetchResult
): Promise<string> {
  const fs = await import('fs/promises')
  const path = await import('path')

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safeTitle = result.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 50)
  const fileName = `web-${timestamp}-${safeTitle}.md`
  const filePath = path.join(vaultPath, '0-收集', fileName)

  // 确保目录存在
  await fs.mkdir(path.join(vaultPath, '0-收集'), { recursive: true })

  // 构建 frontmatter
  const frontmatter = `---
title: "${result.title}"
url: "${url}"
${result.author ? `author: "${result.author}"` : ''}
${result.date ? `date: "${result.date}"` : ''}
tags: ["auto-import", "web", "${result.source}"]
source: "${result.source}"
created: ${Date.now()}
---

# ${result.title}

[原文链接](${url})

${result.content}
`

  await fs.writeFile(filePath, frontmatter, 'utf-8')

  return filePath
}
