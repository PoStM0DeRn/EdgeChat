import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const documents = await db.document.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    })
    return NextResponse.json(documents)
  } catch (error) {
    console.error('List documents error:', error)
    return NextResponse.json(
      { error: 'Ошибка получения списка документов' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { documentId } = await req.json()
    if (!documentId) {
      return NextResponse.json(
        { error: 'Не указан documentId' },
        { status: 400 }
      )
    }
    await db.document.delete({ where: { id: documentId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json(
      { error: 'Ошибка удаления документа' },
      { status: 500 }
    )
  }
}
