import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'

export const runtime = 'nodejs'

const IMAGES_DIR = path.join(process.cwd(), 'public', 'generated')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const safe = path.basename(filename)
  const filePath = path.join(IMAGES_DIR, safe)

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ext = path.extname(safe).toLowerCase()
  const contentType = ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : 'application/octet-stream'

  const buffer = fs.readFileSync(filePath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
