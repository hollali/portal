import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const [imageCount, videoCount, newsCount, audioCount] = await Promise.all([
    prisma.image.count(),
    prisma.video.count(),
    prisma.news.count(),
    prisma.audio.count(),
  ])
  const total = imageCount + videoCount + newsCount + audioCount

  const sourceMap: Record<string, number> = {}

  const processGroup = (rows: { source: string | null; _count: { id: number } }[]) => {
    for (const row of rows) {
      const src = row.source || 'Unknown'
      sourceMap[src] = (sourceMap[src] || 0) + row._count.id
    }
  }

  const [imageSources, videoSources, newsSources, audioSources] = await Promise.all([
    prisma.image.groupBy({ by: ['source'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    prisma.video.groupBy({ by: ['source'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    prisma.news.groupBy({ by: ['source'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    prisma.audio.groupBy({ by: ['source'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
  ])

  processGroup(imageSources)
  processGroup(videoSources)
  processGroup(newsSources)
  processGroup(audioSources)

  const sorted = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])
  const sources = Object.fromEntries(sorted)

  return NextResponse.json({ images: imageCount, videos: videoCount, news: newsCount, audio: audioCount, total, sources })
}
