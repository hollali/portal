import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { localToMediaUrl } from '@/lib/media'
import { PHOTO_FACET_FIELDS } from '@/lib/library'

export interface PhotoItem {
  id: number
  src: string | null
  year: number | null
  event: string | null
  location: string | null
  person: string | null
  institution: string | null
  parliament: string | null
  theme: string | null
  caption: string | null
  source: string | null
}

const FIELD_MAP: Record<string, string> = {
  year: 'year',
  event: 'event',
  location: 'location',
  person: 'person',
  institution: 'institution',
  parliament: 'parliament',
  theme: 'theme',
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const facetWhere: Record<string, unknown>[] = []
  let hasFacetFilter = false
  for (const f of PHOTO_FACET_FIELDS) {
    const val = searchParams.get(f.key) || ''
    if (val) {
      hasFacetFilter = true
      facetWhere.push({ [FIELD_MAP[f.key]]: val })
    }
  }

  const where: Record<string, unknown> = {}
  if (hasFacetFilter) {
    where.AND = facetWhere
  }

  const [rows, count, allRows] = await Promise.all([
    prisma.image.findMany({ where, orderBy: [{ year: 'desc' }, { id: 'desc' }], take: 200 }),
    prisma.image.count({ where }),
    prisma.image.findMany({ where: {}, select: { year: true, event: true, location: true, person: true, institution: true, parliament: true, theme: true } }),
  ])

  const items: PhotoItem[] = rows
    .map(img => ({
      id: img.id,
      src: localToMediaUrl(img.localPath) || img.url,
      year: img.year,
      event: img.event,
      location: img.location,
      person: img.person,
      institution: img.institution,
      parliament: img.parliament,
      theme: img.theme,
      caption: img.caption || img.notes || null,
      source: img.source,
    }))
    .filter(p => p.src)

  const facets: Record<string, { value: string; count: number }[]> = {}
  for (const f of PHOTO_FACET_FIELDS) {
    const key = FIELD_MAP[f.key]
    const counts = new Map<string, number>()
    for (const row of allRows) {
      const rowVal = (row as Record<string, unknown>)[key]
      if (!rowVal) continue
      const v = String(rowVal)
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    facets[f.key] = Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
  }

  return NextResponse.json({ items, total: count, facets })
}