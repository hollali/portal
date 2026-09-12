import { prisma } from '@/lib/prisma'

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
  try {
    const [byKind, milestones, testimonials, photos, videos, audio, news, images] = await Promise.all([
      prisma.archiveItem.groupBy({ by: ['kind'], where: { status: 'published' }, _count: { _all: true } }),
      prisma.milestone.count({ where: { status: 'published' } }),
      prisma.testimonial.count({ where: { status: 'published' } }),
      prisma.image.count(),
      prisma.video.count(),
      prisma.audio.count(),
      prisma.news.count(),
      prisma.image.count(),
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
      images,
      total: speeches + papers + interviews + notes + milestones + testimonials + photos + videos + audio + news,
    }
  } catch {
    return { speeches: 0, papers: 0, interviews: 0, notes: 0, milestones: 0, testimonials: 0, photos: 0, videos: 0, audio: 0, news: 0, images: 0, total: 0 }
  }
}

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
  try {
    const items = await prisma.archiveItem.findMany({
      where: { status: 'published' },
      orderBy: [{ year: 'desc' }, { date: 'desc' }, { updatedAt: 'desc' }],
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
}