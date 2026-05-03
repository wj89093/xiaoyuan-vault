import log from 'electron-log/main'
import { callQwenAI } from './qwen'

// ============ Types ============


/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-template-expressions */

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
    apiKey: process.env.QWEN_API_KEY ?? '',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: process.env.QWEN_MODEL ?? 'qwen3.6-flash',
  },
  minimax: {
    name: 'MiniMax M2.7',
    apiKey: process.env.MINIMAX_API_KEY ?? '',
    apiUrl: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    model: 'MiniMax-M2.7',
  },
  deepseek: {
    name: 'DeepSeek V4',
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-v4-flash',
  },
}

// ============ Multi-Provider AI Call ============

export async function callAI(
  action: string,
  params: Record<string, unknown>,
  provider?: AIProvider
): Promise<any> {
  const selectedProvider = provider ?? 'deepseek'
  const config = PROVIDERS[selectedProvider]

  if (!config.apiKey) {
    log.warn(`[AI] ${selectedProvider} API key not set, falling back to qwen`)
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
  params: Record<string, unknown>,
  config: ProviderConfig
): Promise<any> {
  let systemPrompt = ''
  let userPrompt = ''
  let maxTokens = 2000

  switch (action) {
    case 'classify':
      systemPrompt = `你是一个文档分类助手。根据文档内容，推荐最合适的文件夹。
现有文件夹：${(params.folders as string[]).join('、')}
只返回一个文件夹名称，不要解释。`
      userPrompt = String(params.content ?? '').slice(0, 2000)
      maxTokens = 50
      break

    case 'tags':
      systemPrompt = `你是一个标签提取助手。从文档内容中提取 3-5 个关键词标签。
只返回标签列表，用逗号分隔，不要解释。`
      userPrompt = String(params.content ?? '').slice(0, 2000)
      maxTokens = 100
      break

    case 'summary':
      systemPrompt = `你是一个摘要生成助手。为文档生成简短的摘要（100字以内）。
只返回摘要内容，不要有其他文字。`
      userPrompt = String(params.content ?? '').slice(0, 4000)
      maxTokens = 200
      break

    case 'reason':
      systemPrompt = params.systemPrompt ?? `你是一个问答助手。基于提供的文档内容回答用户问题。
如果文档中没有相关内容，说明"我没有在文档中找到相关信息"。
回答要简洁，直接回答问题，使用 Markdown 格式。`
      userPrompt = `问题：${params.question}\n\n相关文档内容：\n${(params.context as string[]).join('\n\n')}`
      maxTokens = 2000
      break

    case 'write':
      systemPrompt = `你是一个写作助手。根据用户提供的提纲或主题，生成完整的 Markdown 文档。
直接生成文档内容，不要有前言或解释。`
      userPrompt = String(params.outline ?? '')
      maxTokens = 4000
      break

    case 'resolve':
      systemPrompt = params.systemPrompt ?? `你是一个知识助手。只返回 JSON，不要解释。`
      userPrompt = params.prompt ?? ''
      maxTokens = 800
      break

    default:
      return null
  }

  try {
    // MiniMax uses a slightly different request format
    const isMiniMax = config.apiUrl.includes('minimax')

    const body: Record<string, any> = {
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
    } else if (data.reply ?? data.choices?.[0]?.text) {
      content = data.reply ?? data.choices[0].text
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

// ─── Auth Gateway AI 调用 ───────────────────────────────────────
// 用于：Electron app 调 Auth Gateway（平台统一提供 AI）
// Gateway 验证 token + 扣 quota + 调 DeepSeek
const AUTH_GATEWAY_URL = process.env.AUTH_GATEWAY_URL
if (!AUTH_GATEWAY_URL && process.env.NODE_ENV === 'production') {
  throw new Error('AUTH_GATEWAY_URL 环境变量未配置，Auth Gateway 无法调用')
}

export async function callAIGateway(
  question: string,
  context?: string[],
  userToken?: string
): Promise<{ answer: string; used?: number; limit?: number; tokens?: number }> {
  const url = `${AUTH_GATEWAY_URL}/ai/query`
    const body: Record<string, any> = { question }
  if (context) body.context = context

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (userToken) headers['Authorization'] = `Bearer ${userToken}`

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error ?? `Gateway error: ${res.status}`)
  }
  return data
}

export function getGatewayUrl(): string {
  return AUTH_GATEWAY_URL
}
