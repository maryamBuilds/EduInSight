import { describe, expect, it } from 'vitest'
import {
  buildProviderRequest,
  callProvider,
  readProviderConfig,
} from '../../supabase/functions/analyze-feedback/ai-provider'

const CONFIG = {
  provider: 'qwen',
  apiKey: 'test-api-key',
  baseUrl: 'https://dashscope.example.com/compatible-mode/v1',
  model: 'qwen-plus',
}

const CONTEXT = {
  feedbackText: 'Library Wi-Fi bohat slow chal raha hai subah ke waqt.',
  feedbackArea: 'Technical access or system failure',
  universityService: 'IT, Wi-Fi and Learning Management System',
}

function providerResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('readProviderConfig', () => {
  it('returns null when any required value is missing or blank', () => {
    expect(readProviderConfig({})).toBeNull()
    expect(readProviderConfig({ AI_API_KEY: '   ' })).toBeNull()
    expect(readProviderConfig({ AI_API_KEY: 'secret-key' })).toBeNull()
    expect(
      readProviderConfig({ AI_API_KEY: 'secret-key', AI_BASE_URL: 'https://api.example.com/v1' }),
    ).toBeNull()
    expect(readProviderConfig({ AI_API_KEY: 'secret-key', AI_MODEL: 'qwen-plus' })).toBeNull()
  })

  it('returns the explicit server-side configuration', () => {
    const config = readProviderConfig({
      AI_API_KEY: 'secret-key',
      AI_BASE_URL: 'https://custom.example.com/v1/',
      AI_MODEL: 'qwen-max',
    })
    expect(config).toEqual({
      provider: 'qwen',
      apiKey: 'secret-key',
      baseUrl: 'https://custom.example.com/v1',
      model: 'qwen-max',
      fallbackModels: [],
    })
  })

  it('reads fallback models, dropping blanks, duplicates and the main model', () => {
    const config = readProviderConfig({
      AI_API_KEY: 'secret-key',
      AI_BASE_URL: 'https://custom.example.com/v1',
      AI_MODEL: 'qwen-max',
      AI_FALLBACK_MODELS: ' backup-a, ,qwen-max,backup-b,backup-a ',
    })
    expect(config?.fallbackModels).toEqual(['backup-a', 'backup-b'])
  })

  it('honours an explicit provider label', () => {
    const config = readProviderConfig({
      AI_PROVIDER: 'qwen-intl',
      AI_API_KEY: 'secret-key',
      AI_BASE_URL: 'https://custom.example.com/v1',
      AI_MODEL: 'qwen-max',
    })
    expect(config?.provider).toBe('qwen-intl')
  })
})

describe('buildProviderRequest', () => {
  it('targets the OpenAI-compatible chat completions endpoint with bearer auth', () => {
    const request = buildProviderRequest(CONFIG, CONTEXT)
    expect(request.url).toBe(`${CONFIG.baseUrl}/chat/completions`)
    expect(request.headers.Authorization).toBe(`Bearer ${CONFIG.apiKey}`)
    expect(request.headers['Content-Type']).toBe('application/json')
  })

  it('requests predictable JSON output', () => {
    const body = JSON.parse(buildProviderRequest(CONFIG, CONTEXT).body)
    expect(body.model).toBe(CONFIG.model)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages).toHaveLength(2)
  })

  it('disables reasoning for Groq JSON classification', () => {
    const body = JSON.parse(buildProviderRequest({ ...CONFIG, provider: 'groq' }, CONTEXT).body)
    expect(body.reasoning_effort).toBe('none')
  })

  it('includes prompt-injection resistance in the system prompt', () => {
    const body = JSON.parse(buildProviderRequest(CONFIG, CONTEXT).body)
    const system = body.messages[0].content as string
    expect(system).toMatch(/untrusted data/i)
    expect(system).toMatch(/never follow any instructions/i)
    expect(system).toMatch(/json schema/i)
  })

  it('sends only the minimum feedback content and catalogue context', () => {
    const request = buildProviderRequest(CONFIG, CONTEXT)
    const userMessage = JSON.parse(JSON.parse(request.body).messages[1].content)

    expect(userMessage.feedback).toEqual({
      text: CONTEXT.feedbackText,
      feedback_area: CONTEXT.feedbackArea,
      university_service: CONTEXT.universityService,
    })
    expect(userMessage.allowed_categories).toContain('Technical access or system failure')
    expect(userMessage.allowed_responsible_areas).toContain('IT Department')

    const serialized = request.body
    expect(serialized).not.toContain(CONFIG.apiKey)
    expect(serialized).not.toContain('student_id')
    expect(serialized).not.toContain('studentId')
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('reference_number')
    expect(serialized).not.toContain('institution_id')
  })
})

describe('callProvider', () => {
  it('parses a successful structured response', async () => {
    const content = JSON.stringify({
      detected_language: 'mixed',
      english_summary: 'Student reports slow library Wi-Fi in the morning.',
      category: 'Technical access or system failure',
      sentiment: 'negative',
      priority: 'medium',
      responsible_area: 'IT Department',
      key_topics: ['Wi-Fi', 'library'],
      requires_human_review: false,
      confidence: 0.9,
    })
    const result = await callProvider(CONFIG, CONTEXT, async () => providerResponse(content))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.content).toEqual({
        detected_language: 'mixed',
        english_summary: 'Student reports slow library Wi-Fi in the morning.',
        category: 'Technical access or system failure',
        sentiment: 'negative',
        priority: 'medium',
        responsible_area: 'IT Department',
        key_topics: ['Wi-Fi', 'library'],
        requires_human_review: false,
        confidence: 0.9,
      })
    }
  })

  it('tolerates markdown-fenced JSON content', async () => {
    const content = '```json\n{"detected_language": "en"}\n```'
    const result = await callProvider(CONFIG, CONTEXT, async () => providerResponse(content))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.content).toEqual({ detected_language: 'en' })
  })

  it('classifies provider HTTP failures as ai_provider_error', async () => {
    const diagnostics: string[] = []
    const serverError = await callProvider(
      CONFIG,
      CONTEXT,
      async () => providerResponse('error', 500),
      (code) => diagnostics.push(code),
    )
    expect(serverError).toEqual({ ok: false, error: 'ai_provider_error' })
    expect(diagnostics).toEqual(['http_500'])

    const unauthorized = await callProvider(
      CONFIG,
      CONTEXT,
      async () => providerResponse('error', 401),
    )
    expect(unauthorized).toEqual({ ok: false, error: 'ai_provider_error' })
  })

  it('classifies a malformed provider body as ai_provider_error', async () => {
    const result = await callProvider(
      CONFIG,
      CONTEXT,
      async () => new Response('<html>gateway error</html>', { status: 200 }),
    )
    expect(result).toEqual({ ok: false, error: 'ai_provider_error' })
  })

  it('classifies non-JSON message content as ai_invalid_response', async () => {
    const result = await callProvider(
      CONFIG,
      CONTEXT,
      async () => providerResponse('The feedback is about Wi-Fi.'),
    )
    expect(result).toEqual({ ok: false, error: 'ai_invalid_response' })
  })

  it('classifies a missing choices array as ai_invalid_response', async () => {
    const response = new Response(JSON.stringify({ object: 'chat.completion' }), { status: 200 })
    const result = await callProvider(CONFIG, CONTEXT, async () => response)
    expect(result).toEqual({ ok: false, error: 'ai_invalid_response' })
  })

  it('classifies an aborted request as ai_timeout', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    const result = await callProvider(CONFIG, CONTEXT, async () => {
      throw abortError
    })
    expect(result).toEqual({ ok: false, error: 'ai_timeout' })
  })

  it('classifies network failures as ai_provider_error', async () => {
    const result = await callProvider(CONFIG, CONTEXT, async () => {
      throw new TypeError('fetch failed')
    })
    expect(result).toEqual({ ok: false, error: 'ai_provider_error' })
  })

  it('retries a rate-limited model after waiting', async () => {
    const waits: number[] = []
    const diagnostics: string[] = []
    let calls = 0
    const outcome = await callProvider(
      CONFIG,
      CONTEXT,
      async () => {
        calls += 1
        return calls === 1
          ? new Response('{}', { status: 429, headers: { 'retry-after': '1.5' } })
          : providerResponse('{"category":"Teaching"}')
      },
      (code) => diagnostics.push(code),
      async (ms) => { waits.push(ms) },
    )
    expect(outcome).toEqual({ ok: true, content: { category: 'Teaching' } })
    expect(waits).toEqual([1500])
    expect(diagnostics).toEqual(['http_429'])
  })

  it('moves to a fallback model when the main model stays rate limited', async () => {
    const models: string[] = []
    const waits: number[] = []
    const outcome = await callProvider(
      { ...CONFIG, fallbackModels: ['backup-model'] },
      CONTEXT,
      async (_url, init) => {
        const model = JSON.parse(String(init?.body)).model as string
        models.push(model)
        return model === 'qwen-plus'
          ? new Response('{}', { status: 429 })
          : providerResponse('{"category":"Teaching"}')
      },
      undefined,
      async (ms) => { waits.push(ms) },
    )
    expect(outcome.ok).toBe(true)
    expect(models).toEqual(['qwen-plus', 'qwen-plus', 'qwen-plus', 'backup-model'])
    expect(waits).toEqual([2000, 4000])
  })

  it('skips straight to the fallback when Retry-After is long (daily quota)', async () => {
    const models: string[] = []
    const waits: number[] = []
    await callProvider(
      { ...CONFIG, fallbackModels: ['backup-model'] },
      CONTEXT,
      async (_url, init) => {
        models.push(JSON.parse(String(init?.body)).model as string)
        return new Response('{}', { status: 429, headers: { 'retry-after': '3600' } })
      },
      undefined,
      async (ms) => { waits.push(ms) },
    )
    expect(models).toEqual(['qwen-plus', 'backup-model'])
    expect(waits).toEqual([])
  })

  it('returns ai_provider_error when every model stays rate limited', async () => {
    const outcome = await callProvider(
      CONFIG,
      CONTEXT,
      async () => new Response('{}', { status: 429 }),
      undefined,
      async () => undefined,
    )
    expect(outcome).toEqual({ ok: false, error: 'ai_provider_error' })
  })

  it('does not retry other HTTP failures', async () => {
    let calls = 0
    await callProvider(
      { ...CONFIG, fallbackModels: ['backup-model'] },
      CONTEXT,
      async () => { calls += 1; return providerResponse('error', 401) },
      undefined,
      async () => undefined,
    )
    expect(calls).toBe(1)
  })
})
