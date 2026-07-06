import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getEmbedding } from '@/lib/embeddings'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { documentId, llmUrl, token, embedModel } = body as {
      documentId: string
      llmUrl: string
      token?: string
      embedModel?: string
    }

    if (!documentId || !llmUrl) {
      return NextResponse.json(
        { error: 'documentId и llmUrl обязательны' },
        { status: 400 }
      )
    }

    const doc = await db.document.findUnique({
      where: { id: documentId },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    if (doc.chunks.length === 0) {
      return NextResponse.json({ error: 'Нет чанков для векторизации' }, { status: 400 })
    }

    // Update status to processing
    await db.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    })

    let embeddedCount = 0
    let errors = 0

    for (const chunk of doc.chunks) {
      try {
        const embedding = await getEmbedding(
          chunk.content,
          llmUrl,
          token,
          embedModel || 'nomic-embed-text'
        )
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

    // Update status to embedded
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
