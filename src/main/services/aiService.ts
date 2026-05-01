import log from 'electron-log/main'
import { callQwenAI } from './qwen'

// ============ Types ============

export type AIProvider = 'qwen' | 'minimax' | 'deepseek'

interface ProviderConfig {
  name: string
  apiKey: string
  apiUrl: string
  model: string
}

const PROVIDERS: Record<AIProvider, ProviderConfig> = {
  qwen: {
    name: '通义千问 (Qwen3.6-Flash)',
    apiKey: process.env.QWEN_API_KEY || '',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: process.env.QWEN_MODEL || 'qwen3.6-flash',
  },
  minimax: {
    name: 'MiniMax M2.7',
    apiKey: process.env.MINIMAX_API_KEY || '',
    apiUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    model: 'MiniMax-M2.7',
  },
  deepseek: {
    name: 'DeepSeek V4',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
  },
}

// ============ Multi-Provider AI Call ============

export async function callAI(
  action: string,
  params: Record<string, any>,
  provider?: AIProvider
): Promise<any> {
  const selectedProvider = provider || 'qwen'
  const config = PROVIDERS[selectedProvider]

  if (!config.apiKey && selectedProvider !== 'qwen') {
    log.warn(`[AI] ${selectedProvider} API key not set, falling back to Qwen`)
    return callAI(action, params, 'qwen')
  }

  if (selectedProvider !== 'qwen') {
    return callOpenAICompatible(action, params, config)
  }

  // Qwen has its own implementation with specialized prompt handling
  return callQwenAI(action, params)
}

// ============ OpenAI-compatible provider call ============

async function callOpenAICompatible(
  action: string,
  params: Record<string, any>,
  config: ProviderConfig
): Promise<any> {
  let systemPrompt = ''
  let userPrompt = ''
  let maxTokens = 2000

  switch (action) {
    case 'classify':
      systemPrompt = `你是一个文档分类助手。根据文档内容，推荐最合适的文件夹。
现有文件夹：${params.folders.join('、')}
只返回一个文件夹名称，不要解释。`
      userPrompt = params.content.slice(0, 2000)
      maxTokens = 50
      break

    case 'tags':
      systemPrompt = `你是一个标签提取助手。从文档内容中提取 3-5 个关键词标签。
只返回标签列表，用逗号分隔，不要解释。`
      userPrompt = params.content.slice(0, 2000)
      maxTokens = 100
      break

    case 'summary':
      systemPrompt = `你是一个摘要生成助手。为文档生成简短的摘要（100字以内）。
只返回摘要内容，不要有其他文字。`
      userPrompt = params.content.slice(0, 4000)
      maxTokens = 200
      break

    case 'reason':
      systemPrompt = params.systemPrompt || `你是一个问答助手。基于提供的文档内容回答用户问题。
如果文档中没有相关内容，说明"我没有在文档中找到相关信息"。
回答要简洁，直接回答问题，使用 Markdown 格式。`
      userPrompt = `问题：${params.question}\n\n相关文档内容：\n${params.context.join('\n\n')}`
      maxTokens = 2000
      break

    case 'write':
      systemPrompt = `你是一个写作助手。根据用户提供的提纲或主题，生成完整的 Markdown 文档。
直接生成文档内容，不要有前言或解释。`
      userPrompt = params.outline
      maxTokens = 4000
      break

    case 'resolve':
      systemPrompt = params.systemPrompt || `你是一个知识助手。只返回 JSON，不要解释。`
      userPrompt = params.prompt || ''
      maxTokens = 800
      break

    default:
      return null
  }

  try {
    // MiniMax uses a slightly different request format
    const isMiniMax = config.apiUrl.includes('minimax')

    const body: any = {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
    }

    if (isMiniMax) {
      // MiniMax expects msg_type
      body.messages = body.messages.map((m: any) =>
        m.role === 'system'
          ? { sender_type: 'BOT', sender_name: 'system', text: m.content }
          : { sender_type: 'USER', sender_name: 'user', text: m.content }
      )
      body.model = 'MiniMax-M2.7'
      delete body.max_tokens
      body.tokens_to_generate = maxTokens
    }

    log.info(`[AI:${config.name}] ${action} (${maxTokens} tokens)`)
    const start = Date.now()

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      log.error(`[AI:${config.name}] API error:`, response.status, error.slice(0, 200))
      return action === 'tags' ? [] : 'AI 调用失败'
    }

    const data = await response.json()
    const elapsed = Date.now() - start
    log.info(`[AI:${config.name}] ${action} done (${elapsed}ms)`)

    // Parse response (different providers have different response shapes)
    let content = ''
    if (data.choices?.[0]?.message?.content) {
      content = data.choices[0].message.content
    } else if (data.reply || data.choices?.[0]?.text) {
      content = data.reply || data.choices[0].text
    } else if (data.choices?.[0]?.delta?.content) {
      content = data.choices[0].delta.content
    }

    if (action === 'tags') {
      return content.split(/[,，、]/).map(t => t.trim()).filter(Boolean)
    }

    return content.trim()
  } catch (err) {
    log.error(`[AI:${config.name}] exception:`, err)
    return action === 'tags' ? [] : '网络错误'
  }
}

// ============ Provider Management ============

export function getAvailableProviders(): { id: AIProvider; name: string; available: boolean }[] {
  return Object.entries(PROVIDERS).map(([id, config]) => ({
    id: id as AIProvider,
    name: config.name,
    available: !!config.apiKey,
  }))
}

export function getDefaultProvider(): AIProvider {
  if (PROVIDERS.minimax.apiKey) return 'minimax'
  if (PROVIDERS.deepseek.apiKey) return 'deepseek'
  return 'qwen'
}
