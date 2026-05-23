import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { title, content } = await req.json()
    const prompt = await db.prompt.update({
      where: { id },
      data: { title, content },
    })
    return NextResponse.json(prompt)
  } catch (error) {
    console.error('Update prompt error:', error)
    return NextResponse.json(
      { error: 'Ошибка обновления промпта' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.prompt.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete prompt error:', error)
    return NextResponse.json(
      { error: 'Ошибка удаления промпта' },
      { status: 500 }
    )
  }
}
