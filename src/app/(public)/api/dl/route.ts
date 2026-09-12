import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const PUBLIC_ROOT = path.join(process.cwd(), 'public')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const file = searchParams.get('file') || ''

  const clean = file.replace(/^\/+/, '')
  const filePath = path.join(PUBLIC_ROOT, clean)

  if (!filePath.startsWith(PUBLIC_ROOT)) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new NextResponse('Not found', { status: 404 })
  }

  const buffer = fs.readFileSync(filePath)
  const fileName = path.basename(filePath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
      'Cache-Control': 'no-store',
    },
  })
}