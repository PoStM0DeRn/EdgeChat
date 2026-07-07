import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { sessionId } = await params

    const session = await db.chatSession.findUnique({
      where: { id: sessionId, userId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 })
    }

    return NextResponse.json({
      id: session.id,
      title: session.title,
      model: session.model,
      systemPromptId: session.systemPromptId,
      documentId: session.documentId,
      messages: session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      })),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    })
  } catch (err) {
    console.error('Session GET error:', err)
    return NextResponse.json({ error: 'Ошибка загрузки сессии' }, { status: 500 })
  }
}

export async function PUT(
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
    const { title, model, systemPromptId, documentId } = body as {
      title?: string
      model?: string
      systemPromptId?: string
      documentId?: string
    }

    const session = await db.chatSession.findUnique({ where: { id: sessionId, userId } })
    if (!session) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 })
    }

    const updated = await db.chatSession.update({
      where: { id: sessionId },
      data: {
        ...(title !== undefined && { title }),
        ...(model !== undefined && { model: model || null }),
        ...(systemPromptId !== undefined && { systemPromptId: systemPromptId || null }),
        ...(documentId !== undefined && { documentId: documentId || null }),
      },
    })

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      model: updated.model,
      systemPromptId: updated.systemPromptId,
      documentId: updated.documentId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (err) {
    console.error('Session PUT error:', err)
    return NextResponse.json({ error: 'Ошибка обновления сессии' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { sessionId } = await params

    const session = await db.chatSession.findUnique({ where: { id: sessionId, userId } })
    if (!session) {
      return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 })
    }

    await db.chatSession.delete({ where: { id: sessionId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('Session DELETE error:', err)
    return NextResponse.json({ error: 'Ошибка удаления сессии' }, { status: 500 })
  }
}
