import { prisma } from '@/lib/prisma'
import {
  DEFAULT_HERO,
  DEFAULT_SECTIONS,
  parseData,
  type HeroData,
  type SectionData,
  type SectionKey,
} from '@/lib/content'

const CACHE_TTL_MS = 60_000

function memCache<T, A extends unknown[]>(load: (...args: A) => Promise<T>): (...args: A) => Promise<T> {
  const slots = new Map<string, { value: T; at: number }>()
  return async (...args: A) => {
    const key = JSON.stringify(args)
    const entry = slots.get(key)
    const now = Date.now()
    if (entry && now - entry.at < CACHE_TTL_MS) return entry.value
    const value = await load(...args)
    slots.set(key, { value, at: now })
    return value
  }
}

export interface LibraryCounts {
  speeches: number
  papers: number
  interviews: number
  notes: number
  milestones: number
  testimonials: number
  photos: number
  videos: number
  audio: number
  news: number
  images: number
  total: number
}

export async function getLibraryCounts(): Promise<LibraryCounts> {
  return getLibraryCountsCached()
}
const getLibraryCountsCached = memCache(async () => {
  try {
    const [byKind, milestones, testimonials, photos, videos, audio, news] = await Promise.all([
      prisma.archiveItem.groupBy({ by: ['kind'], where: { status: 'published' }, _count: { _all: true } }),
      prisma.milestone.count({ where: { status: 'published' } }),
      prisma.testimonial.count({ where: { status: 'published' } }),
      prisma.image.count(),
      prisma.video.count(),
      prisma.audio.count(),
      prisma.news.count(),
    ])

    const kindMap: Record<string, number> = {}
    for (const row of byKind) {
      kindMap[row.kind] = row._count._all
    }

    const speeches = kindMap.speech || 0
    const papers = kindMap.paper || 0
    const interviews = kindMap.interview || 0
    const notes = (kindMap.note || 0) + (kindMap.letter || 0) + (kindMap.memo || 0)

    return {
      speeches,
      papers,
      interviews,
      notes,
      milestones,
      testimonials,
      photos,
      videos,
      audio,
      news,
      images: photos,
      total: speeches + papers + interviews + notes + milestones + testimonials + photos + videos + audio + news,
    }
  } catch {
    return { speeches: 0, papers: 0, interviews: 0, notes: 0, milestones: 0, testimonials: 0, photos: 0, videos: 0, audio: 0, news: 0, images: 0, total: 0 }
  }
})

export interface LatestItem {
  id: number
  kind: string
  title: string
  slug: string
  date: string | null
  year: number | null
  event: string | null
  location: string | null
  theme: string | null
  excerpt: string | null
  filePath: string | null
  fileName: string | null
}

export async function getLatestArchiveItems(limit = 8): Promise<LatestItem[]> {
  return getLatestArchiveItemsCached(limit)
}

const getLatestArchiveItemsCached = memCache(async (limit: number) => {
  try {
    const items = await prisma.archiveItem.findMany({
      where: { status: 'published' },
      orderBy: [{ createdAt: 'desc' }, { year: 'desc' }, { date: 'desc' }],
      take: limit,
    })
    return items.map(i => ({
      id: i.id,
      kind: i.kind,
      title: i.title,
      slug: i.slug,
      date: i.date,
      year: i.year,
      event: i.event,
      location: i.location,
      theme: i.theme,
      excerpt: i.excerpt,
      filePath: i.filePath,
      fileName: i.fileName,
    }))
  } catch {
    return []
  }
})

const getHeroContentCached = memCache(async (): Promise<HeroData> => {
  try {
    const row = await prisma.contentSection.findUnique({ where: { key: 'home_hero' } })
    if (!row || row.status !== 'published') return DEFAULT_HERO
    return parseData<HeroData>(row.data, DEFAULT_HERO)
  } catch {
    return DEFAULT_HERO
  }
})

export async function getHeroContent(): Promise<HeroData> {
  return getHeroContentCached()
}

/* ── Generic CMS section reader ─────────────────────────
   Every public page reads its copy through here. A section only goes live
   when its status is `published`; anything else (missing row, draft, parse
   failure) falls back to the compiled-in default, so the site can never
   render an empty page because a row is missing. */

const getSectionRawCached = memCache(async (key: SectionKey): Promise<unknown> => {
  try {
    const row = await prisma.contentSection.findUnique({ where: { key } })
    if (!row || row.status !== 'published' || !row.data) return null
    return row.data
  } catch {
    return null
  }
})

export async function getSectionData<T extends SectionData>(key: SectionKey): Promise<T> {
  const fallback = DEFAULT_SECTIONS[key] as T
  return parseData<T>(await getSectionRawCached(key), fallback)
}
