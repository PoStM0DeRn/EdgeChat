import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await req.json()
    const { role, content } = body as { role: string; content: string }

    if (!role || !content) {
      return NextResponse.json(
        { error: 'role и content обязательны' },
        { status: 400 }
      )
    }

    const session = await db.chatSession.findUnique({ where: { id: sessionId } })
    if (!session) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 })
    }

    const message = await db.chatMessage.create({
      data: {
        sessionId,
        role,
        content,
      },
    })

    // Update session timestamp
    await db.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })
  } catch (err) {
    console.error('Messages POST error:', err)
    return NextResponse.json({ error: 'Ошибка сохранения сообщения' }, { status: 500 })
  }
}
