import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { chunkText } from '@/lib/chunker'
import { parsePdf, parseTxt, parseMarkdown } from '@/lib/pdf-parser'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Файл не предоставлен' },
        { status: 400 }
      )
    }

    const filename = file.name
    const ext = filename.split('.').pop()?.toLowerCase() || ''

    if (!['pdf', 'txt', 'md', 'markdown'].includes(ext)) {
      return NextResponse.json(
        { error: 'Поддерживаются только файлы PDF, TXT и MD' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileType = ext === 'markdown' ? 'md' : ext

    // Create document record
    const document = await db.document.create({
      data: {
        filename,
        fileType,
        fileSize: buffer.length,
        status: 'processing',
      },
    })

    try {
      // Parse file content
      let text: string
      switch (fileType) {
        case 'pdf':
          text = await parsePdf(buffer)
          break
        case 'txt':
          text = parseTxt(buffer)
          break
        case 'md':
          text = parseMarkdown(buffer)
          break
        default:
          text = parseTxt(buffer)
      }

      if (!text.trim()) {
        await db.document.update({
          where: { id: document.id },
          data: {
            status: 'error',
            errorMsg: 'Не удалось извлечь текст из файла',
          },
        })
        return NextResponse.json(
          { error: 'Не удалось извлечь текст из файла' },
          { status: 400 }
        )
      }

      // Chunk the text
      const chunks = chunkText(text)

      // Save chunks to DB
      await db.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          documentId: document.id,
          content: chunk.content,
          chunkIndex: chunk.index,
        })),
      })

      // Update document status
      await db.document.update({
        where: { id: document.id },
        data: {
          status: 'parsed',
          chunkCount: chunks.length,
        },
      })

      // Save original file to disk
      const uploadDir = path.join('/home/z/my-project/uploads', document.id)
      await mkdir(uploadDir, { recursive: true })
      await writeFile(path.join(uploadDir, filename), buffer)

      return NextResponse.json({
        id: document.id,
        filename,
        fileType,
        fileSize: buffer.length,
        chunkCount: chunks.length,
        status: 'parsed',
      })
    } catch (parseError) {
      await db.document.update({
        where: { id: document.id },
        data: {
          status: 'error',
          errorMsg:
            parseError instanceof Error
              ? parseError.message
              : 'Ошибка обработки',
        },
      })
      return NextResponse.json(
        { error: 'Ошибка обработки файла' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Ошибка загрузки файла' },
      { status: 500 }
    )
  }
}
