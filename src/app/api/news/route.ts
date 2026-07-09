import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const SORTABLE = new Set(['id', 'source', 'query', 'title', 'source_name', 'date', 'collected_at'])

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '15')))
  const query = searchParams.get('q') || ''
  const source = searchParams.get('source') || ''
  const sort = SORTABLE.has(searchParams.get('sort') || '') ? searchParams.get('sort')! : 'id'
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

  const where: Record<string, unknown> = {}
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { url: { contains: query } },
      { source: { contains: query } },
      { sourceName: { contains: query } },
      { snippet: { contains: query } },
    ]
  }
  if (source) where.sourceName = source

  const [items, total] = await Promise.all([
    prisma.news.findMany({
      where,
      orderBy: { [sort]: dir },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.news.count({ where }),
  ])

  const sources = await prisma.news.findMany({ distinct: ['sourceName'], select: { sourceName: true }, orderBy: { sourceName: 'asc' } })

  return NextResponse.json({ items, total, page, perPage, sources: sources.map(s => s.sourceName).filter(Boolean) })
}
