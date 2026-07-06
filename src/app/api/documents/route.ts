import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { unlink } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const documents = await db.document.findMany({
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
    const body = await req.json()
    const { documentId } = body as { documentId: string }

    if (!documentId) {
      return NextResponse.json({ error: 'documentId обязателен' }, { status: 400 })
    }

    const doc = await db.document.findUnique({
      where: { id: documentId },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    // Delete files from disk
    try {
      const uploadDir = join(process.cwd(), 'uploads', documentId)
      await unlink(uploadDir).catch(() => {})
    } catch {}

    // Delete from DB (cascades to chunks)
    await db.document.delete({
      where: { id: documentId },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Documents DELETE error:', err)
    return NextResponse.json({ error: 'Ошибка удаления документа' }, { status: 500 })
  }
}
