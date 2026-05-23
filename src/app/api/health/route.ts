import { NextRequest } from 'next/server'

export const runtime = 'edge'

interface HealthRequest {
  tunnelUrl: string
  token?: string
}

export async function POST(req: NextRequest) {
  const body: HealthRequest = await req.json()
  const { tunnelUrl, token } = body

  if (!tunnelUrl) {
    return new Response(
      JSON.stringify({ ok: false, error: 'URL туннеля не указан' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const baseUrl = tunnelUrl.replace(/\/+$/, '')

  // Try multiple endpoints in order:
  // 1. /v1/models (OpenAI-compatible: LM Studio, vLLM, etc.)
  // 2. /api/tags (Ollama native)
  const endpoints = [
    { url: `${baseUrl}/v1/models`, name: 'OpenAI-compatible' },
    { url: `${baseUrl}/api/tags`, name: 'Ollama' },
  ]

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint.url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000), // 10s timeout
      })

      if (res.ok) {
        const data = await res.json()

        // Extract model names from the response
        let models: string[] = []

        // OpenAI format: { data: [{ id: "model-name", ... }] }
        if (data.data && Array.isArray(data.data)) {
          models = data.data.map(
            (m: { id: string }) => m.id
          )
        }
        // Ollama format: { models: [{ name: "model-name", ... }] }
        else if (data.models && Array.isArray(data.models)) {
          models = data.models.map(
            (m: { name: string }) => m.name
          )
        }

        return new Response(
          JSON.stringify({
            ok: true,
            endpoint: endpoint.name,
            url: endpoint.url,
            models,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } catch {
      // Continue to the next endpoint
    }
  }

  return new Response(
    JSON.stringify({
      ok: false,
      error:
        'Не удалось подключиться. Проверьте URL туннеля и убедитесь, что модель запущена.',
    }),
    { status: 502, headers: { 'Content-Type': 'application/json' } }
  )
}
