import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-helpers'
import { checkLimit } from '@/lib/plan-limits'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const tokens = await db.agentToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        token: true,
        name: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json(tokens)
  } catch (err) {
    console.error('Agent tokens GET error:', err)
    return NextResponse.json({ error: 'Ошибка загрузки токенов' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const limit = await checkLimit(userId, 'agentTokens')
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Лимит токенов: ${limit.limit}. Удалите старые или оформите Pro.` },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const name = (body as { name?: string }).name?.trim() || `Agent ${limit.current + 1}`

    const token = randomUUID()

    const created = await db.agentToken.create({
      data: {
        token,
        userId,
        name,
      },
    })

    return NextResponse.json({
      id: created.id,
      token: created.token,
      name: created.name,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
    })
  } catch (err) {
    console.error('Agent tokens POST error:', err)
    return NextResponse.json({ error: 'Ошибка создания токена' }, { status: 500 })
  }
}
