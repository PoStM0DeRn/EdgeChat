import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { defaultPrompts } from '@/lib/default-prompts'

export const runtime = 'nodejs'

export async function GET() {
  try {
    // Get user prompts from DB
    const userPrompts = await db.prompt.findMany({
      orderBy: { createdAt: 'desc' },
    })

    // Merge with defaults (user prompts take precedence)
    const defaultPromptRecords = defaultPrompts.map((p, i) => ({
      id: `default-${i}`,
      title: p.title,
      content: p.content,
      isDefault: true,
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    // Filter out defaults that user has overridden
    const result = [
      ...defaultPromptRecords,
      ...userPrompts.map((p) => ({
        ...p,
        isDefault: false,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    ]

    return NextResponse.json(result)
  } catch (err) {
    console.error('Prompts GET error:', err)
    return NextResponse.json({ error: 'Ошибка загрузки промптов' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, content } = body as { title: string; content: string }

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: 'title и content обязательны' },
        { status: 400 }
      )
    }

    const prompt = await db.prompt.create({
      data: {
        title: title.trim(),
        content: content.trim(),
      },
    })

    return NextResponse.json({
      ...prompt,
      isDefault: false,
      createdAt: prompt.createdAt.toISOString(),
      updatedAt: prompt.updatedAt.toISOString(),
    })
  } catch (err) {
    console.error('Prompts POST error:', err)
    return NextResponse.json({ error: 'Ошибка создания промпта' }, { status: 500 })
  }
}
