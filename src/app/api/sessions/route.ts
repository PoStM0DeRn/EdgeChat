import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const sessions = await db.chatSession.findMany({
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
    const body = await req.json()
    const { title, model, systemPromptId, documentId } = body as {
      title?: string
      model?: string
      systemPromptId?: string
      documentId?: string
    }

    const session = await db.chatSession.create({
      data: {
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
