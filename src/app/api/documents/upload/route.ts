import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parsePdf, parseTxt, parseMarkdown } from '@/lib/pdf-parser'
import { chunkText } from '@/lib/chunker'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['.pdf', '.txt', '.md', '.markdown']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedTypes.includes(ext)) {
      return NextResponse.json(
        { error: 'Поддерживаются только PDF, TXT, MD файлы' },
        { status: 400 }
      )
    }

    // Create document record
    const doc = await db.document.create({
      data: {
        filename: file.name,
        fileType: ext.replace('.', ''),
        fileSize: file.size,
        status: 'processing',
      },
    })

    // Save file to disk
    const uploadDir = join(process.cwd(), 'uploads', doc.id)
    await mkdir(uploadDir, { recursive: true })
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(join(uploadDir, file.name), buffer)

    // Parse file
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

    // Chunk text
    const chunks = chunkText(text)

    // Save chunks to DB
    for (const chunk of chunks) {
      await db.documentChunk.create({
        data: {
          documentId: doc.id,
          content: chunk.content,
          chunkIndex: chunk.index,
        },
      })
    }

    // Update document status
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
