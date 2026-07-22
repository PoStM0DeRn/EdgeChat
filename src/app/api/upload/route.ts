import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import * as fs from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'
export const maxDuration = 30

const PUBLIC_DIR = path.join(process.cwd(), 'public', 'generated')

export async function POST(req: NextRequest) {
  try {
    let userId = await getCurrentUser()

    if (!userId) {
      const agentToken = req.headers.get('agent-token')
      console.log('[Upload] agent-token header:', agentToken ? agentToken.slice(0, 16) + '...' : 'MISSING')
      console.log('[Upload] all headers:', JSON.stringify(Object.fromEntries(req.headers.entries())))
      if (agentToken) {
        const token = await db.agentToken.findUnique({
          where: { token: agentToken },
          select: { userId: true, isActive: true },
        })
        if (token?.isActive) {
          userId = token.userId
          await db.agentToken.update({
            where: { token: agentToken },
            data: { lastUsedAt: new Date() },
          })
        }
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: 400 })
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Допустимы только PNG, JPEG, WebP' }, { status: 400 })
    }

    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Файл больше 20MB' }, { status: 400 })
    }

    const ext = file.type === 'image/png' ? '.png' : file.type === 'image/jpeg' ? '.jpg' : '.webp'
    const filename = `${randomUUID()}${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    fs.mkdirSync(PUBLIC_DIR, { recursive: true })
    fs.writeFileSync(path.join(PUBLIC_DIR, filename), buffer)

    return NextResponse.json({ url: `/generated/${filename}` })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ error: 'Ошибка загрузки' }, { status: 500 })
  }
}
