/**
 * Get embeddings from the user's local LLM instance.
 * Tries /api/embeddings (Ollama native) first, then /v1/embeddings (OpenAI-compatible).
 */
export async function getEmbedding(
  text: string,
  llmUrl: string,
  token?: string,
  model?: string
): Promise<number[]> {
  const baseUrl = llmUrl.replace(/\/+$/, '')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  // Try Ollama native endpoint first
  try {
    const res = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'nomic-embed-text',
        prompt: text,
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.embedding && Array.isArray(data.embedding)) {
        return data.embedding
      }
    }
  } catch {
    // Continue to next endpoint
  }

  // Try OpenAI-compatible endpoint
  try {
    const res = await fetch(`${baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'nomic-embed-text',
        input: text,
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.data?.[0]?.embedding) {
        return data.data[0].embedding
      }
    }
  } catch {
    // Continue to error
  }

  throw new Error(
    'Не удалось получить эмбеддинги. Убедитесь, что модель эмбеддингов запущена (например, nomic-embed-text).'
  )
}

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}
