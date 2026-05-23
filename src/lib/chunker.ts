/**
 * Split text into chunks of approximately `chunkSize` tokens
 * with `overlap` tokens of overlap between chunks.
 * Uses ~4 chars per token approximation.
 */
export interface Chunk {
  content: string
  index: number
}

export function chunkText(
  text: string,
  chunkSize: number = 500,
  overlap: number = 100
): Chunk[] {
  const charsPerToken = 4
  const chunkChars = chunkSize * charsPerToken
  const overlapChars = overlap * charsPerToken

  if (text.length <= chunkChars) {
    return [{ content: text, index: 0 }]
  }

  const chunks: Chunk[] = []
  let start = 0
  let index = 0

  while (start < text.length) {
    let end = start + chunkChars

    // Try to break at paragraph or sentence boundary
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf('\n\n', end)
      const sentenceBreak = text.lastIndexOf('. ', end)

      if (paragraphBreak > start + chunkChars * 0.5) {
        end = paragraphBreak + 2
      } else if (sentenceBreak > start + chunkChars * 0.5) {
        end = sentenceBreak + 2
      }
    }

    chunks.push({
      content: text.slice(start, end).trim(),
      index,
    })

    const nextStart = end - overlapChars
    // Prevent infinite loop: always advance at least 1 character past start
    if (nextStart <= start) {
      start = end
    } else {
      start = nextStart
    }
    index++
  }

  return chunks
}
