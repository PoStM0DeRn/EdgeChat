import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const sessions = await db.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
      },
    })

    return NextResponse.json(
      sessions.map((s) => ({
        id: s.id,
        title: s.title,
        model: s.model,
        systemPromptId: s.systemPromptId,
        documentId: s.documentId,
        messageCount: s._count.messages,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      }))
    )
  } catch (err) {
    console.error('Sessions GET error:', err)
    return NextResponse.json({ error: 'Ошибка загрузки сессий' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await req.json()
    const { title, model, systemPromptId, documentId } = body as {
      title?: string
      model?: string
      systemPromptId?: string
      documentId?: string
    }

    const session = await db.chatSession.create({
      data: {
        userId,
        title: title || 'Новый чат',
        model: model || null,
        systemPromptId: systemPromptId || null,
        documentId: documentId || null,
      },
    })

    return NextResponse.json({
      id: session.id,
      title: session.title,
      model: session.model,
      systemPromptId: session.systemPromptId,
      documentId: session.documentId,
      messageCount: 0,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })
  } catch (err) {
    console.error('Sessions POST error:', err)
    return NextResponse.json({ error: 'Ошибка создания сессии' }, { status: 500 })
  }
}
