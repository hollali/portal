import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PHOTO_FACET_FIELDS } from '@/lib/library'
import { localMediaExists, resolveMediaSrc } from '@/lib/mediaServer'

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
  /** Original remote image URL from the collector, independent of `src`. */
  sourceUrl: string | null
  query: string | null
  collectedAt: string | null
  dateTaken: string | null
  notes: string | null
  tags: string | null
  curated: boolean
  /** True when the file is served from the local media store rather than remotely. */
  storedLocally: boolean
  // Ingest/technical provenance, surfaced in the "Technical details" disclosure.
  imageHash: string | null
  faceDetected: number | null
  faceCount: number | null
  faceMatch: number | null
  faceMatchScore: number | null
  faceMatchDistance: number | null
  bestReferencePath: string | null
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

  const singleId = searchParams.get('id')
  if (singleId) {
    const idNum = parseInt(singleId, 10)
    if (!isNaN(idNum)) {
      const img = await prisma.image.findUnique({ where: { id: idNum } })
      if (!img) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const item: PhotoItem = {
        id: img.id,
        src: resolveMediaSrc(img),
        year: img.year,
        event: img.event,
        location: img.location,
        person: img.person,
        institution: img.institution,
        parliament: img.parliament,
        theme: img.theme,
        caption: img.caption || img.notes || null,
        source: img.source,
        sourceUrl: img.url,
        query: img.query,
        collectedAt: img.collectedAt,
        dateTaken: img.dateTaken,
        notes: img.notes,
        tags: img.tags,
        curated: img.curated,
        storedLocally: localMediaExists(img.localPath),
        imageHash: img.imageHash,
        faceDetected: img.faceDetected,
        faceCount: img.faceCount,
        faceMatch: img.faceMatch,
        faceMatchScore: img.faceMatchScore,
        faceMatchDistance: img.faceMatchDistance,
        bestReferencePath: img.bestReferencePath ? img.bestReferencePath.split(/[\\/]/).pop() || null : null,
      }
      return NextResponse.json({ item })
    }
  }

  const q = searchParams.get('q')?.trim() || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('perPage') || '48')))
  const skip = (page - 1) * perPage

  const andFilters: Record<string, unknown>[] = []

  // Ensure image has an available source
  andFilters.push({
    OR: [
      { localPath: { not: null } },
      { url: { not: null } },
    ],
  })

  // Facet filters
  for (const f of PHOTO_FACET_FIELDS) {
    const val = searchParams.get(f.key) || ''
    if (val) {
      if (f.key === 'year') {
        const y = parseInt(val, 10)
        if (!isNaN(y)) andFilters.push({ year: y })
      } else {
        andFilters.push({ [FIELD_MAP[f.key]]: val })
      }
    }
  }

  // Full-text query across textual fields
  if (q) {
    const orQueries: Record<string, unknown>[] = [
      { caption: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
      { event: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
      { person: { contains: q, mode: 'insensitive' } },
      { institution: { contains: q, mode: 'insensitive' } },
      { theme: { contains: q, mode: 'insensitive' } },
      { tags: { contains: q, mode: 'insensitive' } },
    ]
    const numericYear = parseInt(q, 10)
    if (!isNaN(numericYear) && numericYear >= 1900 && numericYear <= 2100) {
      orQueries.push({ year: numericYear })
    }
    andFilters.push({ OR: orQueries })
  }

  const where: Record<string, unknown> = andFilters.length > 0 ? { AND: andFilters } : {}

  const [rows, count, allRows] = await Promise.all([
    prisma.image.findMany({ where, orderBy: [{ year: 'desc' }, { id: 'desc' }], skip, take: perPage }),
    prisma.image.count({ where }),
    prisma.image.findMany({ where: {}, select: { year: true, event: true, location: true, person: true, institution: true, parliament: true, theme: true } }),
  ])

  const items: PhotoItem[] = rows
    .map(img => ({
      id: img.id,
      src: resolveMediaSrc(img),
      year: img.year,
      event: img.event,
      location: img.location,
      person: img.person,
      institution: img.institution,
      parliament: img.parliament,
      theme: img.theme,
      caption: img.caption || img.notes || null,
      source: img.source,
      sourceUrl: img.url,
      query: img.query,
      collectedAt: img.collectedAt,
      dateTaken: img.dateTaken,
      notes: img.notes,
      tags: img.tags,
      curated: img.curated,
      storedLocally: localMediaExists(img.localPath),
      imageHash: img.imageHash,
      faceDetected: img.faceDetected,
      faceCount: img.faceCount,
      faceMatch: img.faceMatch,
      faceMatchScore: img.faceMatchScore,
      faceMatchDistance: img.faceMatchDistance,
      // Only the best-matching reference image, never the server-side paths.
      bestReferencePath: img.bestReferencePath ? img.bestReferencePath.split(/[\\/]/).pop() || null : null,
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

  return NextResponse.json({ items, total: count, page, perPage, facets })
}