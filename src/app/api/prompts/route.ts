import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { defaultPrompts } from '@/lib/default-prompts'
import { getCurrentUser } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const userPrompts = await db.prompt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    const defaultPromptRecords = defaultPrompts.map((p, i) => ({
      id: `default-${i}`,
      title: p.title,
      content: p.content,
      isDefault: true,
      isPublic: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

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
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

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
        userId,
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
