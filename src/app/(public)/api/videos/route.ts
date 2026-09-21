import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveMediaSrc } from '@/lib/mediaServer'
import { VIDEO_CATEGORIES } from '@/lib/library'

const FACET_KEYS = ['category', 'year', 'event', 'location', 'theme'] as const

export interface VideoArchiveItem {
  id: number
  title: string | null
  src: string | null
  url: string | null
  source: string | null
  channel: string | null
  platform: string | null
  duration: number | null
  views: number | null
  category: string | null
  caption: string | null
  date: string | null
  year: number | null
  event: string | null
  location: string | null
  theme: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const perPage = Math.min(120, Math.max(1, parseInt(searchParams.get('perPage') || '24') || 24))
  const query = searchParams.get('q') || ''
  const source = searchParams.get('source') || ''

  const where: Record<string, unknown> = { status: 'published' }

  const facetWhere: Record<string, unknown>[] = []
  let hasFacet = false
  for (const key of FACET_KEYS) {
    const val = searchParams.get(key) || ''
    if (!val) continue
    hasFacet = true
    facetWhere.push({ [key]: key === 'year' ? parseInt(val) || undefined : val })
  }
  if (hasFacet) where.AND = facetWhere

  if (query) {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { url: { contains: query } },
      { source: { contains: query, mode: 'insensitive' } },
      { channel: { contains: query, mode: 'insensitive' } },
      { platform: { contains: query, mode: 'insensitive' } },
      { caption: { contains: query, mode: 'insensitive' } },
      { category: { contains: query, mode: 'insensitive' } },
    ]
  }
  if (source) where.source = source

  const [rows, total, sources, allRows] = await Promise.all([
    prisma.video.findMany({
      where,
      orderBy: [{ year: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.video.count({ where }),
    prisma.video.findMany({ distinct: ['source'], select: { source: true }, orderBy: { source: 'asc' } }),
    prisma.video.findMany({ where: { status: 'published' }, select: { category: true, year: true, event: true, location: true, theme: true } }),
  ])

  const items: VideoArchiveItem[] = rows.map(row => ({
    id: row.id,
    title: row.title,
    src: resolveMediaSrc({ localPath: row.localPath, url: row.url }),
    url: row.url,
    source: row.source,
    channel: row.channel,
    platform: row.platform,
    duration: row.duration,
    views: row.views,
    category: row.category,
    caption: row.caption,
    date: row.date,
    year: row.year,
    event: row.event,
    location: row.location,
    theme: row.theme,
  }))

  const facets: Record<string, { value: string; count: number }[]> = {}
  for (const key of FACET_KEYS) {
    const counts = new Map<string, number>()
    for (const row of allRows) {
      const rowVal = (row as Record<string, unknown>)[key]
      if (rowVal === null || rowVal === undefined || rowVal === '') continue
      const v = String(rowVal)
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    facets[key] = Array.from(counts.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
  }

  const categories = VIDEO_CATEGORIES
    .map(c => ({ value: c, count: facets.category?.find(f => f.value === c)?.count || 0 }))
    .filter(c => c.count > 0)

  return NextResponse.json({ items, total, page, perPage, sources: sources.map(s => s.source).filter(Boolean), facets, categories })
}