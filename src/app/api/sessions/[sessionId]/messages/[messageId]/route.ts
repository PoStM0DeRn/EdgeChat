import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { sessionId, messageId } = await params

    const session = await db.chatSession.findUnique({ where: { id: sessionId, userId } })
    if (!session) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 })
    }

    const message = await db.chatMessage.findFirst({
      where: { id: messageId, sessionId },
    })

    if (!message) {
      return NextResponse.json({ error: 'Сообщение не найдено' }, { status: 404 })
    }

    await db.chatMessage.delete({ where: { id: messageId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('Message DELETE error:', err)
    return NextResponse.json({ error: 'Ошибка удаления сообщения' }, { status: 500 })
  }
}
