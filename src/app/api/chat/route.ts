import { NextRequest } from 'next/server'

export const runtime = 'edge'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  tunnelUrl: string
  token?: string
  model?: string
}

export async function POST(req: NextRequest) {
  const body: ChatRequest = await req.json()
  const { messages, tunnelUrl, token, model } = body

  if (!tunnelUrl) {
    return new Response(JSON.stringify({ error: 'URL туннеля не указан' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Normalize the tunnel URL — strip trailing slash
  const baseUrl = tunnelUrl.replace(/\/+$/, '')
  const endpoint = `${baseUrl}/v1/chat/completions`

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const upstreamRes = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'default',
        messages,
        stream: true,
      }),
    })

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text()
      return new Response(
        JSON.stringify({
          error: `Ошибка от модели (${upstreamRes.status}): ${errorText}`,
        }),
        {
          status: upstreamRes.status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Forward the SSE stream from the upstream LLM to the client
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstreamRes.body?.getReader()
        if (!reader) {
          controller.close()
          return
        }

        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // Process complete SSE events from buffer
            const lines = buffer.split('\n')
            // Keep the last potentially incomplete line in the buffer
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()

              if (trimmed === '') continue

              if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6)

                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  continue
                }

                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content

                  if (content) {
                    // Forward the token to the client
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ content, model: parsed.model })}\n\n`
                      )
                    )
                  }
                } catch {
                  // If JSON parse fails, forward raw data
                  controller.enqueue(
                    encoder.encode(`data: ${data}\n\n`)
                  )
                }
              }
            }
          }
        } catch (err) {
          console.error('Stream reading error:', err)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'Соединение с моделью разорвано' })}\n\n`
            )
          )
        } finally {
          reader.releaseLock()
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Неизвестная ошибка подключения'
    return new Response(
      JSON.stringify({
        error: `Не удалось подключиться к модели: ${message}`,
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
