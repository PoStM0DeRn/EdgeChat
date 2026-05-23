import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { defaultPrompts } from '@/lib/default-prompts'

export async function GET() {
  try {
    // Get DB prompts
    const dbPrompts = await db.prompt.findMany({
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    })

    // If no default prompts seeded yet, return defaults from code
    if (dbPrompts.filter((p) => p.isDefault).length === 0) {
      return NextResponse.json([
        ...defaultPrompts.map((p, i) => ({
          id: `default-${i}`,
          title: p.title,
          content: p.content,
          isPublic: true,
          isDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        ...dbPrompts,
      ])
    }

    return NextResponse.json(dbPrompts)
  } catch (error) {
    console.error('List prompts error:', error)
    // Fallback to code defaults
    return NextResponse.json(
      defaultPrompts.map((p, i) => ({
        id: `default-${i}`,
        title: p.title,
        content: p.content,
        isPublic: true,
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }))
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, content } = await req.json()
    if (!title || !content) {
      return NextResponse.json(
        { error: 'Заголовок и содержание обязательны' },
        { status: 400 }
      )
    }
    const prompt = await db.prompt.create({
      data: { title, content, isPublic: false, isDefault: false },
    })
    return NextResponse.json(prompt)
  } catch (error) {
    console.error('Create prompt error:', error)
    return NextResponse.json(
      { error: 'Ошибка создания промпта' },
      { status: 500 }
    )
  }
}
