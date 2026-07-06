import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { title, content } = body as { title: string; content: string }

    const prompt = await db.prompt.findUnique({ where: { id } })
    if (!prompt) {
      return NextResponse.json({ error: 'Промпт не найден' }, { status: 404 })
    }

    if (prompt.isDefault) {
      return NextResponse.json({ error: 'Нельзя редактировать промпт по умолчанию' }, { status: 400 })
    }

    const updated = await db.prompt.update({
      where: { id },
      data: {
        ...(title?.trim() && { title: title.trim() }),
        ...(content?.trim() && { content: content.trim() }),
      },
    })

    return NextResponse.json({
      ...updated,
      isDefault: false,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (err) {
    console.error('Prompt PUT error:', err)
    return NextResponse.json({ error: 'Ошибка обновления промпта' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const prompt = await db.prompt.findUnique({ where: { id } })
    if (!prompt) {
      return NextResponse.json({ error: 'Промпт не найден' }, { status: 404 })
    }

    if (prompt.isDefault) {
      return NextResponse.json({ error: 'Нельзя удалить промпт по умолчанию' }, { status: 400 })
    }

    await db.prompt.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Prompt DELETE error:', err)
    return NextResponse.json({ error: 'Ошибка удаления промпта' }, { status: 500 })
  }
}
