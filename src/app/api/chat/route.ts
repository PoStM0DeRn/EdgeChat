import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getEmbedding, cosineSimilarity } from '@/lib/embeddings'

// NOTE: Do NOT use `export const runtime = 'edge'` here.
// Prisma requires Node.js runtime.

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  tunnelUrl: string
  token?: string
  model?: string
  documentId?: string
  systemPrompt?: string
}

export async function POST(req: NextRequest) {
  const body: ChatRequest = await req.json()
  const { messages, tunnelUrl, token, model, documentId, systemPrompt } = body

  if (!tunnelUrl) {
    return new Response(
      JSON.stringify({ error: 'URL туннеля не указан' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const baseUrl = tunnelUrl.replace(/\/+$/, '')
  const endpoint = `${baseUrl}/v1/chat/completions`

  // Build the system message
  let systemContent =
    systemPrompt ||
    'Ты полезный ассистент. Отвечай чётко и по существу.'

  // RAG: If documentId is provided, find relevant chunks
  if (documentId) {
    try {
      const document = await db.document.findUnique({
        where: { id: documentId },
        include: { chunks: true },
      })

      if (document && document.chunks.length > 0) {
        const lastUserMessage =
          messages.filter((m) => m.role === 'user').pop()?.content || ''

        // Get embedded chunks
        const embeddedChunks = document.chunks.filter((c) => c.embedding)

        if (embeddedChunks.length > 0 && lastUserMessage) {
          // Vectorize the query
          try {
            const queryEmbedding = await getEmbedding(
              lastUserMessage,
              tunnelUrl,
              token
            )

            // Compute similarities
            const scored = embeddedChunks.map((chunk) => {
              const chunkEmbedding = JSON.parse(chunk.embedding!) as number[]
              return {
                content: chunk.content,
                score: cosineSimilarity(queryEmbedding, chunkEmbedding),
              }
            })

            // Sort by similarity and take top 5
            scored.sort((a, b) => b.score - a.score)
            const topChunks = scored.slice(0, 5)

            const contextBlock = topChunks
              .map((c, i) => `[Фрагмент ${i + 1}]\n${c.content}`)
              .join('\n\n')

            systemContent = `${
              systemPrompt ||
              'Ты полезный ассистент. Отвечай на вопрос пользователя, используя только предоставленный контекст. Если ответа в контексте нет, скажи "Я не нашёл ответа в документе".'
            }\n\nКонтекст из документа "${document.filename}":\n\n${contextBlock}`
          } catch (embedError) {
            console.error(
              'Embedding query failed, falling back to all chunks:',
              embedError
            )
            // Fallback: use first 3 chunks if embedding fails
            const fallbackChunks = document.chunks.slice(0, 3)
            const contextBlock = fallbackChunks
              .map((c, i) => `[Фрагмент ${i + 1}]\n${c.content}`)
              .join('\n\n')
            systemContent = `${systemContent}\n\nКонтекст из документа "${document.filename}" (без векторного поиска):\n\n${contextBlock}`
          }
        } else if (document.chunks.length > 0) {
          // No embeddings available, use first 3 chunks
          const fallbackChunks = document.chunks.slice(0, 3)
          const contextBlock = fallbackChunks
            .map((c, i) => `[Фрагмент ${i + 1}]\n${c.content}`)
            .join('\n\n')
          systemContent = `${systemContent}\n\nКонтекст из документа "${document.filename}" (без векторного поиска):\n\n${contextBlock}`
        }
      }
    } catch (ragError) {
      console.error('RAG error:', ragError)
      // Continue without RAG context
    }
  }

  // Build final messages array with system prompt
  const finalMessages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...messages.filter((m) => m.role !== 'system'),
  ]

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
        messages: finalMessages,
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

    // Forward SSE stream
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
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed || !trimmed.startsWith('data: ')) continue
              const data = trimmed.slice(6)
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                continue
              }
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ content, model: parsed.model })}\n\n`
                    )
                  )
                }
              } catch {
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              }
            }
          }
        } catch (err) {
          console.error('Stream error:', err)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'Соединение разорвано' })}\n\n`
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
      err instanceof Error ? err.message : 'Неизвестная ошибка'
    return new Response(
      JSON.stringify({ error: `Не удалось подключиться: ${message}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
