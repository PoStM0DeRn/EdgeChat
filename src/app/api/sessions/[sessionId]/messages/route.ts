import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { sessionId } = await params
    const body = await req.json()
    const { role, content, imageUrl } = body as { role: string; content: string; imageUrl?: string }

    if (!role) {
      return NextResponse.json(
        { error: 'role обязателен' },
        { status: 400 }
      )
    }

    const session = await db.chatSession.findUnique({ where: { id: sessionId, userId } })
    if (!session) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 })
    }

    const message = await db.chatMessage.create({
      data: {
        sessionId,
        role,
        content: content || '',
        imageUrl: imageUrl || null,
      },
    })

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
