import pdf from 'pdf-parse'

export async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer)
  return data.text
}

export function parseTxt(buffer: Buffer): string {
  return buffer.toString('utf-8')
}

export function parseMarkdown(buffer: Buffer): string {
  return buffer.toString('utf-8')
}
