import { db } from './db'
import { cosineSimilarity } from './embeddings'

const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3002'

const VECTOR_WEIGHT = 0.4
const KEYWORD_WEIGHT = 0.6

function keywordScore(content: string, query: string): number {
  const lower = content.toLowerCase()
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 2)

  if (words.length === 0) return 0

  let score = 0

  for (const word of words) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i')
    if (regex.test(content)) {
      score += 1
    } else if (lower.includes(word)) {
      score += 0.5
    }
  }

  const fullPhrase = words.join(' ')
  if (lower.includes(fullPhrase)) {
    score += 3
  }

  for (const word of words) {
    if (/^\d+$/.test(word)) {
      const numRegex = new RegExp(`(?:статья|пункт|подпункт|раздел|глава|абзац|пп|п)\\s*\\.?\\s*${word}\\b`, 'i')
      if (numRegex.test(content)) {
        score += 2
      }
    }
  }

  return score / words.length
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function getQueryEmbedding(text: string, agentToken: string): Promise<number[]> {
  const res = await fetch(`${WS_SERVER_URL}/api/agent/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: agentToken,
      text,
      model: 'nomic-embed-text',
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Embedding failed: ${res.status}`)
  }

  const { embedding } = await res.json()
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Invalid embedding response')
  }

  return embedding
}

export async function findRelevantChunks(
  documentId: string,
  queryText: string,
  agentToken: string,
  topK: number = 7
) {
  let queryEmbedding: number[] | null = null
  try {
    queryEmbedding = await getQueryEmbedding(queryText, agentToken)
  } catch {
    // Fallback to keyword-only search if embedding fails
  }

  const chunks = await db.documentChunk.findMany({
    where: {
      documentId,
    },
    orderBy: { chunkIndex: 'asc' },
  })

  if (chunks.length === 0) return []

  const scored = chunks.map((chunk) => {
    const kwScore = keywordScore(chunk.content, queryText)

    let vecScore = 0
    if (queryEmbedding && chunk.embedding) {
      try {
        const chunkEmbedding = JSON.parse(chunk.embedding) as number[]
        vecScore = cosineSimilarity(queryEmbedding, chunkEmbedding)
      } catch {}
    }

    const finalScore = VECTOR_WEIGHT * vecScore + KEYWORD_WEIGHT * kwScore

    return {
      id: chunk.id,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      score: finalScore,
      vectorScore: vecScore,
      keywordScore: kwScore,
    }
  })

  scored.sort((a, b) => b.score - a.score)

  const strongKeywordHits = scored.filter((c) => c.keywordScore >= 1.0)

  if (strongKeywordHits.length > 0) {
    const remainingSlots = Math.max(0, topK - strongKeywordHits.length)
    const vectorFallback = scored
      .filter((c) => c.keywordScore < 1.0 && c.score > 0)
      .slice(0, remainingSlots)
    return [...strongKeywordHits, ...vectorFallback].slice(0, topK + 3)
  }

  return scored.filter((c) => c.score > 0).slice(0, topK)
}
