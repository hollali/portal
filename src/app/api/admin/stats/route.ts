import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [imageCount, videoCount, newsCount, audioCount] = await Promise.all([
    prisma.image.count(),
    prisma.video.count(),
    prisma.news.count(),
    prisma.audio.count(),
  ])

  const [imageWithFaces, faceMatches] = await Promise.all([
    prisma.image.count({ where: { faceCount: { gt: 0 } } }),
    prisma.image.count({ where: { faceMatch: { gt: 0 } } }),
  ])

  const total = imageCount + videoCount + newsCount + audioCount

  const topSources = async (model: any, field: string, limit = 8) => {
    const rows = await model.groupBy({
      by: [field],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } as any },
      take: limit,
    })
    return rows
      .filter((r: any) => r[field])
      .map((r: any) => ({ source: r[field], count: r._count.id }))
  }

  const [imageSources, videoSources, newsSources, audioSources] = await Promise.all([
    topSources(prisma.image, 'source'),
    topSources(prisma.video, 'source'),
    topSources(prisma.news, 'sourceName'),
    topSources(prisma.audio, 'source'),
  ])

  const [recentImages, recentVideos, recentNews, recentAudio] = await Promise.all([
    prisma.image.findMany({ orderBy: { id: 'desc' }, take: 6 }),
    prisma.video.findMany({ orderBy: { id: 'desc' }, take: 6 }),
    prisma.news.findMany({ orderBy: { id: 'desc' }, take: 6 }),
    prisma.audio.findMany({ orderBy: { id: 'desc' }, take: 6 }),
  ])

  // Collection trend for the last 14 days
  const days: string[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const trendByDay = async (model: any, limit = 14) => {
    const raw = await model.findMany({
      select: { collectedAt: true },
      orderBy: { id: 'desc' },
      take: 5000,
    })
    const counts: Record<string, number> = {}
    for (const r of raw) {
      if (!r.collectedAt) continue
      const day = String(r.collectedAt).slice(0, 10)
      counts[day] = (counts[day] || 0) + 1
    }
    return days.map(day => ({ date: day, count: counts[day] || 0 }))
  }

  const trend = {
    images: await trendByDay(prisma.image),
    videos: await trendByDay(prisma.video),
    news: await trendByDay(prisma.news),
    audio: await trendByDay(prisma.audio),
    labels: days,
  }

  // User activity from audit logs (last 30 days)
  const activityRows = await prisma.$queryRawUnsafe<{ username: string; c: number }[]>(
    `SELECT u.username, count(*)::int as c
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.created_at >= now() - interval '30 days'
     GROUP BY u.username ORDER BY c DESC LIMIT 10`
  )

  return NextResponse.json({
    counts: { images: imageCount, videos: videoCount, news: newsCount, audio: audioCount, total },
    images: { withFaces: imageWithFaces, faceMatches },
    sources: { images: imageSources, videos: videoSources, news: newsSources, audio: audioSources },
    recent: { images: recentImages, videos: recentVideos, news: recentNews, audio: recentAudio },
    trend,
    activity: activityRows.map(r => ({ username: r.username || 'unknown', count: Number(r.c) })),
  })
}
