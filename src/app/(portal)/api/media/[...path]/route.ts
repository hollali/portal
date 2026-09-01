import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MEDIA_ROOT = path.resolve(
  process.env.MEDIA_ROOT || path.join(process.cwd(), '..', 'osint_bagbin_enhanced')
)

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathSegments } = await params
  const filePath = path.join(MEDIA_ROOT, ...pathSegments)

  if (!filePath.startsWith(MEDIA_ROOT)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new NextResponse('Not found', { status: 404 })
  }

  const ext = path.extname(filePath).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.txt': 'text/plain', '.json': 'application/json',
  }

  const contentType = mimeMap[ext] || 'application/octet-stream'
  const buffer = fs.readFileSync(filePath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
