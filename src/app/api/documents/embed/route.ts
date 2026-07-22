import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3000'

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const body = await req.json()
    const { documentId, token, embedModel } = body as {
      documentId: string
      token?: string
      embedModel?: string
    }

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId обязателен' },
        { status: 400 }
      )
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Токен агента обязателен для векторизации' },
        { status: 400 }
      )
    }

    const doc = await db.document.findUnique({
      where: { id: documentId, userId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    if (doc.chunks.length === 0) {
      return NextResponse.json({ error: 'Нет чанков для векторизации' }, { status: 400 })
    }

    await db.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    })

    let embeddedCount = 0
    let errors = 0

    for (const chunk of doc.chunks) {
      try {
        const res = await fetch(`${WS_SERVER_URL}/api/agent/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            text: chunk.content,
            model: embedModel || 'nomic-embed-text',
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `WS server error ${res.status}`)
        }

        const { embedding } = await res.json()

        if (!embedding || !Array.isArray(embedding)) {
          throw new Error('Неверный формат эмбеддинга')
        }

        await db.documentChunk.update({
          where: { id: chunk.id },
          data: { embedding: JSON.stringify(embedding) },
        })
        embeddedCount++
      } catch (err) {
        console.error(`Embedding error for chunk ${chunk.chunkIndex}:`, err)
        errors++
      }
    }

    if (embeddedCount === 0) {
      await db.document.update({
        where: { id: documentId },
        data: { status: 'error', errorMsg: 'Не удалось векторизовать ни один чанк' },
      })
      return NextResponse.json(
        { error: 'Ошибка векторизации всех чанков' },
        { status: 500 }
      )
    }

    await db.document.update({
      where: { id: documentId },
      data: { status: 'embedded' },
    })

    return NextResponse.json({
      ok: true,
      embedded: embeddedCount,
      errors,
      total: doc.chunks.length,
    })
  } catch (err) {
    console.error('Embed error:', err)
    return NextResponse.json(
      { error: `Ошибка векторизации: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    )
  }
}
