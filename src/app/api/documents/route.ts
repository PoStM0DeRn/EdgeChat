import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const documents = await db.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(documents)
  } catch (err) {
    console.error('Documents GET error:', err)
    return NextResponse.json({ error: 'Ошибка загрузки документов' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await req.json()
    const { documentId } = body as { documentId: string }

    if (!documentId) {
      return NextResponse.json({ error: 'documentId обязателен' }, { status: 400 })
    }

    const doc = await db.document.findUnique({
      where: { id: documentId, userId },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    try {
      const uploadDir = join(process.cwd(), 'uploads', documentId)
      await unlink(uploadDir).catch(() => {})
    } catch {}

    await db.document.delete({
      where: { id: documentId },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Documents DELETE error:', err)
    return NextResponse.json({ error: 'Ошибка удаления документа' }, { status: 500 })
  }
}
