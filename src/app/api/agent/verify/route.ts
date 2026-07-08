import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ valid: false })
    }

    const agentToken = await db.agentToken.findUnique({
      where: { token },
      select: {
        id: true,
        userId: true,
        name: true,
        isActive: true,
      },
    })

    if (!agentToken || !agentToken.isActive) {
      return NextResponse.json({ valid: false })
    }

    await db.agentToken.update({
      where: { id: agentToken.id },
      data: { lastUsedAt: new Date() },
    })

    return NextResponse.json({
      valid: true,
      userId: agentToken.userId,
      tokenName: agentToken.name,
    })
  } catch (err) {
    console.error('Agent verify error:', err)
    return NextResponse.json({ valid: false })
  }
}
