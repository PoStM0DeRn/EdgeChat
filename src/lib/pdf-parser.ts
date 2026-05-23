import PDFParser from 'pdf2json'

export async function parsePdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser()

    parser.on('pdfParser_dataReady', () => {
      const text = parser.getRawTextContent()
      resolve(text)
    })

    parser.on('pdfParser_dataError', (err: { ParserError?: string }) => {
      reject(new Error(err?.ParserError || 'Ошибка парсинга PDF'))
    })

    parser.parseBuffer(buffer)
  })
}

export function parseTxt(buffer: Buffer): string {
  return buffer.toString('utf-8')
}

export function parseMarkdown(buffer: Buffer): string {
  return buffer.toString('utf-8')
}
