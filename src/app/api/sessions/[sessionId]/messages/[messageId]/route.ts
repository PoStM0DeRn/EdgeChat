import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  try {
    const { sessionId, messageId } = await params

    const message = await db.chatMessage.findFirst({
      where: {
        id: messageId,
        sessionId,
      },
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
