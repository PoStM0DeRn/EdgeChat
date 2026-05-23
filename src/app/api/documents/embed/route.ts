import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getEmbedding } from '@/lib/embeddings'

export async function POST(req: NextRequest) {
  try {
    const { documentId, tunnelUrl, token, embedModel } = await req.json()

    if (!documentId || !tunnelUrl) {
      return NextResponse.json(
        { error: 'Не указан documentId или tunnelUrl' },
        { status: 400 }
      )
    }

    const document = await db.document.findUnique({
      where: { id: documentId },
      include: { chunks: true },
    })

    if (!document) {
      return NextResponse.json(
        { error: 'Документ не найден' },
        { status: 404 }
      )
    }

    // Get chunks without embeddings
    const unembeddedChunks = document.chunks.filter((c) => !c.embedding)

    if (unembeddedChunks.length === 0) {
      await db.document.update({
        where: { id: documentId },
        data: { status: 'embedded' },
      })
      return NextResponse.json({
        message: 'Все чанки уже векторизованы',
        embedded: 0,
        total: document.chunks.length,
      })
    }

    let embeddedCount = 0
    let errors = 0

    for (const chunk of unembeddedChunks) {
      try {
        const embedding = await getEmbedding(
          chunk.content,
          tunnelUrl,
          token,
          embedModel
        )
        await db.documentChunk.update({
          where: { id: chunk.id },
          data: { embedding: JSON.stringify(embedding) },
        })
        embeddedCount++
      } catch (err) {
        console.error(`Embedding error for chunk ${chunk.id}:`, err)
        errors++
      }
    }

    const allChunks = await db.documentChunk.findMany({
      where: { documentId },
    })
    const allEmbedded = allChunks.every((c) => c.embedding)

    await db.document.update({
      where: { id: documentId },
      data: {
        status: allEmbedded ? 'embedded' : 'parsed',
      },
    })

    return NextResponse.json({
      embedded: embeddedCount,
      errors,
      total: allChunks.length,
      allEmbedded,
    })
  } catch (error) {
    console.error('Embed error:', error)
    return NextResponse.json({ error: 'Ошибка векторизации' }, { status: 500 })
  }
}
