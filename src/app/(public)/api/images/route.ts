import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveMediaSrc } from '@/lib/mediaServer'

const SORTABLE = new Set(['id', 'source', 'query', 'collectedAt', 'faceDetected', 'faceMatch', 'faceMatchScore'])

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '24') || 24))
  const query = searchParams.get('q') || ''
  const source = searchParams.get('source') || ''
  const sort = SORTABLE.has(searchParams.get('sort') || '') ? searchParams.get('sort')! : 'id'
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

  const where: Record<string, unknown> = {}
  if (query) {
    where.OR = [
      { url: { contains: query } },
      { source: { contains: query } },
      { query: { contains: query } },
    ]
  }
  if (source) where.source = source

  const total = await prisma.image.count({ where })

  const images = await prisma.image.findMany({
    where,
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
    orderBy: { [sort]: dir },
    skip: (page - 1) * perPage,
    take: perPage,
  })

  const items = images.map(({ localPath, url, ...rest }) => ({
    ...rest,
    url,
    src: resolveMediaSrc({ localPath, url }),
  }))

  const sources = await prisma.image.findMany({ distinct: ['source'], select: { source: true }, orderBy: { source: 'asc' } })

  return NextResponse.json({ items, total, page, perPage, sources: sources.map(s => s.source).filter(Boolean) })
}
