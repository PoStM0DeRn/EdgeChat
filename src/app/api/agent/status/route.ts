import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3000'

export async function POST(req: Request) {
  try {
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ online: false, name: null })
    }

    const res = await fetch(`${WS_SERVER_URL}/api/agent/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return NextResponse.json({ online: false, name: null })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ online: false, name: null })
  }
}
