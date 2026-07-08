import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { id } = await params

    const token = await db.agentToken.findFirst({
      where: { id, userId },
    })

    if (!token) {
      return NextResponse.json({ error: 'Токен не найден' }, { status: 404 })
    }

    await db.agentToken.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Agent token DELETE error:', err)
    return NextResponse.json({ error: 'Ошибка удаления токена' }, { status: 500 })
  }
}
