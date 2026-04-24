import log from 'electron-log/main'

// Qwen API configuration - in production, this should be in config
const QWEN_API_KEY = process.env.QWEN_API_KEY || ''
const QWEN_API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

interface QwenRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  max_tokens?: number
}

export async function callQwenAI(action: string, params: Record<string, any>): Promise<any> {
  if (!QWEN_API_KEY) {
    log.warn('QWEN_API_KEY not set')
    return action === 'tags' ? [] : '请配置 QWEN_API_KEY'
  }

  let systemPrompt = ''
  let userPrompt = ''

  switch (action) {
    case 'classify':
      systemPrompt = `你是一个文档分类助手。根据文档内容，推荐最合适的文件夹。
现有文件夹：${params.folders.join('、')}
只返回一个文件夹名称，不要解释。`
      userPrompt = params.content.slice(0, 2000)
      break

    case 'tags':
      systemPrompt = `你是一个标签提取助手。从文档内容中提取 3-5 个关键词标签。
只返回标签列表，用逗号分隔，不要解释。`
      userPrompt = params.content.slice(0, 2000)
      break

    case 'summary':
      systemPrompt = `你是一个摘要生成助手。为文档生成简短的摘要（100字以内）。
只返回摘要内容，不要有其他文字。`
      userPrompt = params.content.slice(0, 4000)
      break

    case 'reason':
      systemPrompt = `你是一个问答助手。基于提供的文档内容片段回答用户问题。
如果文档中没有相关内容，说明"我没有在文档中找到相关信息"。
回答要简洁，直接回答问题。`
      userPrompt = `问题：${params.question}\n\n相关文档内容：\n${params.context.join('\n\n')}`
      break

    case 'write':
      systemPrompt = `你是一个写作助手。根据用户提供的提纲或主题，生成完整的 Markdown 文档。
文档要有结构，使用 Markdown 格式，包括标题、列表等。
直接生成文档内容，不要有前言或解释。`
      userPrompt = params.outline
      break

    default:
      return null
  }

  try {
    const response = await fetch(QWEN_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${QWEN_API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen3.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      } as QwenRequest)
    })

    if (!response.ok) {
      const error = await response.text()
      log.error('Qwen API error:', response.status, error)
      return action === 'tags' ? [] : 'API 调用失败'
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    if (action === 'tags') {
      return content.split(/[,，、]/).map(t => t.trim()).filter(Boolean)
    }

    return content.trim()
  } catch (err) {
    log.error('Qwen API exception:', err)
    return action === 'tags' ? [] : '网络错误'
  }
}
