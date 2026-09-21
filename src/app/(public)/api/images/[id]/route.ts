import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveMediaSrc } from '@/lib/mediaServer'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numericId = Number(id)
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const item = await prisma.image.findUnique({
    where: { id: numericId },
    select: {
      id: true,
      url: true,
      localPath: true,
      source: true,
      query: true,
      collectedAt: true,
      faceDetected: true,
      faceCount: true,
      faceMatch: true,
      faceMatchScore: true,
    },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { localPath, url, ...rest } = item
  return NextResponse.json({ ...rest, url, src: resolveMediaSrc({ localPath, url }) })
}
