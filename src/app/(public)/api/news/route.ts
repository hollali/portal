import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseYearFromDate } from '@/lib/library'

const SORTABLE = new Set(['id', 'source', 'query', 'title', 'sourceName', 'date', 'collectedAt'])

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '15') || 15))
  const query = searchParams.get('q') || ''
  const source = searchParams.get('source') || ''
  const year = (searchParams.get('year') || '').trim()
  const sort = SORTABLE.has(searchParams.get('sort') || '') ? searchParams.get('sort')! : 'id'
  const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'

  const where: Record<string, unknown> = {}
  const and: Record<string, unknown>[] = []
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
  // `date` is a loosely formatted string (ISO, RFC 2822, `YYYY-MM-DD`), so the year
  // is matched as a four-digit substring against the record date and its collection date.
  if (year) and.push({ OR: [{ date: { contains: year } }, { collectedAt: { contains: year } }] })
  if (and.length > 0) where.AND = and

  const [items, total, allRows] = await Promise.all([
    prisma.news.findMany({
      where,
      select: {
        id: true,
        title: true,
        url: true,
        source: true,
        sourceName: true,
        query: true,
        date: true,
        collectedAt: true,
        snippet: true,
        notes: true,
        tags: true,
      },
      orderBy: { [sort]: dir },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.news.count({ where }),
    prisma.news.findMany({ select: { sourceName: true, date: true, collectedAt: true } }),
  ])

  const yearCounts = new Map<string, number>()
  const sourceCounts = new Map<string, number>()
  for (const row of allRows) {
    // `source` is a free-text crawler label; the `?source=` filter matches `sourceName`.
    if (row.sourceName) sourceCounts.set(row.sourceName, (sourceCounts.get(row.sourceName) || 0) + 1)
    const y = parseYearFromDate(row.date, row.collectedAt)
    if (y) yearCounts.set(y, (yearCounts.get(y) || 0) + 1)
  }

  const byCountDesc = (a: { value: string; count: number }, b: { value: string; count: number }) =>
    b.count - a.count || a.value.localeCompare(b.value)

  const facets: Record<string, { value: string; count: number }[]> = {
    year: Array.from(yearCounts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.value.localeCompare(a.value)),
    source: Array.from(sourceCounts.entries()).map(([value, count]) => ({ value, count })).sort(byCountDesc),
  }

  const sources = facets.source.map(f => f.value)

  return NextResponse.json({ items, total, page, perPage, sources, facets })
}
