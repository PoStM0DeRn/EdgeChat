import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, getCurrentUserPlan } from '@/lib/auth-helpers'
import { checkLimit } from '@/lib/plan-limits'

export const runtime = 'nodejs'

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3000'

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const limit = await checkLimit(userId, 'imageGenerations')
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Лимит генераций исчерпан: ${limit.current}/${limit.limit}` },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { prompt, agentToken } = body as { prompt?: string; agentToken: string }

    if (!prompt) {
      return NextResponse.json({ error: 'prompt обязателен' }, { status: 400 })
    }

    if (!agentToken) {
      return NextResponse.json({ error: 'Укажите токен Агента' }, { status: 400 })
    }

    const requestId = randomUUID()

    const wsResponse = await fetch(`${WS_SERVER_URL}/api/agent/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: agentToken, requestId, prompt }),
      signal: AbortSignal.timeout(180_000),
    })

    if (!wsResponse.ok) {
      const err = await wsResponse.json().catch(() => ({ error: 'Agent unavailable' }))
      return NextResponse.json(
        { error: err.error || 'Агент недоступен' },
        { status: 502 }
      )
    }

    const result = await wsResponse.json() as { ok: boolean; url: string }

    return NextResponse.json({ url: result.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('Generate-image error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
