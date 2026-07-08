import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findRelevantChunks } from '@/lib/rag'
import { getCurrentUser } from '@/lib/auth-helpers'
import { rateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3002'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const ip = getClientIp(req)
    const rl = rateLimit(`chat:${ip}`, { windowMs: 60_000, max: 30 })
    if (!rl.allowed) {
      return rateLimitResponse(rl.resetMs)
    }

    const body = await req.json()
    const { messages, token, model, documentId, systemPrompt, agentToken } = body as {
      messages: ChatMessage[]
      token?: string
      model?: string
      documentId?: string
      systemPrompt?: string
      agentToken?: string
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Нет сообщений' }, { status: 400 })
    }

    if (!agentToken) {
      return NextResponse.json({ error: 'Укажите токен Агента' }, { status: 400 })
    }

    // Build system prompt
    let contextBlock = ''

    // RAG: if document is selected, find relevant chunks via similarity search
    if (documentId) {
      try {
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || ''

        if (lastUserMessage) {
          const doc = await db.document.findUnique({
            where: { id: documentId },
            select: { chunkCount: true },
          })
          const chunkCount = doc?.chunkCount || 0
          const dynamicTopK = Math.min(Math.max(5, Math.ceil(chunkCount * 0.15)), 10)

          const relevantChunks = await findRelevantChunks(documentId, lastUserMessage, agentToken, dynamicTopK)

          if (relevantChunks.length > 0) {
            contextBlock = '\n\n--- КОНТЕКСТ ИЗ ДОКУМЕНТА ---\n' +
              relevantChunks.map((c, i) => `[Пункт ${i + 1} (чанк ${c.chunkIndex + 1})] ${c.content}`).join('\n\n') +
              '\n--- КОНЕЦ КОНТЕКСТА ---\n'
          }
        }
      } catch (err) {
        console.error('RAG error:', err)
      }
    }

    let fullSystemPrompt = systemPrompt || ''
    if (contextBlock) {
      fullSystemPrompt += contextBlock
    }

    // Build messages for LLM
    const llmMessages: { role: string; content: string }[] = []
    if (fullSystemPrompt) {
      llmMessages.push({ role: 'system', content: fullSystemPrompt })
    }
    for (const msg of messages) {
      llmMessages.push({ role: msg.role, content: msg.content })
    }

    // ═══════════════════════════════════════════
    // Forward request to Desktop Agent via WebSocket
    // ═══════════════════════════════════════════
    const requestId = crypto.randomUUID()

    try {
      const wsResponse = await fetch(`${WS_SERVER_URL}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: agentToken,
          requestId,
          messages: llmMessages,
          model: model || 'llama3',
          systemPrompt: fullSystemPrompt || undefined,
        }),
        signal: AbortSignal.timeout(120_000),
      })

      if (!wsResponse.ok) {
        const err = await wsResponse.json().catch(() => ({ error: 'Agent unavailable' }))
        return NextResponse.json(
          { error: err.error || 'Агент недоступен' },
          { status: 502 }
        )
      }

      const result = await wsResponse.json() as { ok: boolean; chunks: { type: string; content: string }[] }

      // Stream collected chunks back to client as SSE
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of result.chunks) {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ type: chunk.type, content: chunk.content })}\n\n`)
            )
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } catch (err) {
      return NextResponse.json(
        { error: `Ошибка подключения к Агенту: ${err instanceof Error ? err.message : 'Unknown'}` },
        { status: 502 }
      )
    }
  } catch (err) {
    console.error('Chat API error:', err)
    return NextResponse.json(
      { error: `Внутренняя ошибка: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    )
  }
}
