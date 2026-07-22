import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3000'

const agentPortCache = new Map<string, { port: number; expires: number }>()
const PORT_CACHE_TTL = 60_000

async function getAgentHttpPort(token: string): Promise<number | null> {
  const cached = agentPortCache.get(token)
  if (cached && cached.expires > Date.now()) return cached.port
  try {
    const res = await fetch(`${WS_SERVER_URL}/api/agent/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(3000),
    })
    const data = await res.json()
    if (data.online && data.httpPort) {
      agentPortCache.set(token, { port: data.httpPort, expires: Date.now() + PORT_CACHE_TTL })
      return data.httpPort
    }
  } catch {}
  agentPortCache.set(token, { port: 0, expires: Date.now() + 5000 })
  return null
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  let token = url.searchParams.get('token') || req.cookies.get('agent-token')?.value || req.headers.get('x-agent-token')
  if (!token) {
    return NextResponse.json({ error: 'Токен не указан' }, { status: 401 })
  }

  url.searchParams.delete('token')
  const cleanSearch = url.searchParams.toString()
  const cleanSearchFull = cleanSearch ? '?' + cleanSearch : ''
  const path = url.pathname + cleanSearchFull

  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => {
    if (!['host', 'x-agent-token', 'content-length', 'origin', 'referer'].includes(k) && !k.startsWith('sec-')) {
      headers[k] = v
    }
  })

  const httpPort = await getAgentHttpPort(token)
  if (httpPort) {
    try {
      const agentHeaders: Record<string, string> = { ...headers, 'x-agent-token': token }
      const agentRes = await fetch(`http://127.0.0.1:${httpPort}${path}`, {
        method: 'GET',
        headers: agentHeaders,
        signal: AbortSignal.timeout(120_000),
      })
      const resBody = Buffer.from(await agentRes.arrayBuffer())
      const contentType = agentRes.headers.get('content-type') || 'application/octet-stream'
      return new NextResponse(resBody, {
        status: agentRes.status,
        headers: { 'Content-Type': contentType },
      })
    } catch {
      // Fall through to WS Server tunnel
    }
  }

  try {
    const tunnelRes = await fetch(`${WS_SERVER_URL}/api/agent/tunnel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        method: 'GET',
        path,
        headers,
        body: null,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!tunnelRes.ok) {
      const text = await tunnelRes.text()
      return NextResponse.json({ error: text.slice(0, 200) }, { status: 502 })
    }

    const data = await tunnelRes.json()
    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 502 })
    }

    const decodedBody = Buffer.from(data.body || '', 'base64')
    const contentType = (Array.isArray(data.headers?.['content-type'])
      ? data.headers['content-type'][0]
      : data.headers?.['content-type']) || 'application/octet-stream'

    return new NextResponse(decodedBody, {
      status: data.statusCode || 200,
      headers: { 'Content-Type': contentType },
    })
  } catch (err) {
    return NextResponse.json({ error: 'WS Server недоступен: ' + (err instanceof Error ? err.message : '') }, { status: 502 })
  }
}
