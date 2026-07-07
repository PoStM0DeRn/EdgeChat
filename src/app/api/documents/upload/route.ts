import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parsePdf, parseTxt, parseMarkdown } from '@/lib/pdf-parser'
import { chunkText } from '@/lib/chunker'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 })
    }

    const allowedTypes = ['.pdf', '.txt', '.md', '.markdown']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedTypes.includes(ext)) {
      return NextResponse.json(
        { error: 'Поддерживаются только PDF, TXT, MD файлы' },
        { status: 400 }
      )
    }

    const doc = await db.document.create({
      data: {
        userId,
        filename: file.name,
        fileType: ext.replace('.', ''),
        fileSize: file.size,
        status: 'processing',
      },
    })

    const uploadDir = join(process.cwd(), 'uploads', doc.id)
    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, file.name), buffer)

    let text = ''
    try {
      if (ext === '.pdf') {
        text = await parsePdf(buffer)
      } else if (ext === '.txt') {
        text = parseTxt(buffer)
      } else if (ext === '.md' || ext === '.markdown') {
        text = parseMarkdown(buffer)
      }
    } catch (err) {
      await db.document.update({
        where: { id: doc.id },
        data: { status: 'error', errorMsg: `Ошибка парсинга: ${err instanceof Error ? err.message : 'Unknown'}` },
      })
      return NextResponse.json(
        { error: `Ошибка парсинга файла: ${err instanceof Error ? err.message : 'Unknown'}` },
        { status: 400 }
      )
    }

    const chunks = chunkText(text)

    for (const chunk of chunks) {
      await db.documentChunk.create({
        data: {
          documentId: doc.id,
          content: chunk.content,
          chunkIndex: chunk.index,
        },
      })
    }

    await db.document.update({
      where: { id: doc.id },
      data: { status: 'parsed', chunkCount: chunks.length },
    })

    return NextResponse.json({
      id: doc.id,
      filename: doc.filename,
      status: 'parsed',
      chunkCount: chunks.length,
    })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json(
      { error: `Ошибка загрузки: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 500 }
    )
  }
}
