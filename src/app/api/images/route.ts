import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SORTABLE = new Set(['id', 'source', 'query', 'collected_at', 'face_detected', 'face_match', 'face_match_score'])

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '24')))
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

  const [items, total] = await Promise.all([
    prisma.image.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.image.count({ where }),
  ])

  const sources = await prisma.image.findMany({ distinct: ['source'], select: { source: true }, orderBy: { source: 'asc' } })

  return NextResponse.json({ items, total, page, perPage, sources: sources.map(s => s.source).filter(Boolean) })
}
