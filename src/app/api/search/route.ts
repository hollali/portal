import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''

  if (!q) return NextResponse.json({ images: [], videos: [], news: [], audio: [], total: 0 })

  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))

  const where = {
    OR: [
      { url: { contains: q } },
      { source: { contains: q } },
      { query: { contains: q } },
    ],
  }

  const whereV = {
    OR: [
      { title: { contains: q } },
      { url: { contains: q } },
      { source: { contains: q } },
      { channel: { contains: q } },
      { platform: { contains: q } },
    ],
  }

  const whereN = {
    OR: [
      { title: { contains: q } },
      { url: { contains: q } },
      { source: { contains: q } },
      { sourceName: { contains: q } },
      { snippet: { contains: q } },
    ],
  }

  const whereA = {
    OR: [
      { title: { contains: q } },
      { url: { contains: q } },
      { source: { contains: q } },
      { artist: { contains: q } },
    ],
  }

  const perPage = 12
  const skip = (page - 1) * perPage

  const [images, videos, news, audio, countI, countV, countN, countA] = await Promise.all([
    prisma.image.findMany({ where, orderBy: { id: 'desc' }, skip, take: perPage }),
    prisma.video.findMany({ where: whereV, orderBy: { id: 'desc' }, skip, take: 10 }),
    prisma.news.findMany({ where: whereN, orderBy: { id: 'desc' }, skip, take: 10 }),
    prisma.audio.findMany({ where: whereA, orderBy: { id: 'desc' }, skip, take: 10 }),
    prisma.image.count({ where }),
    prisma.video.count({ where: whereV }),
    prisma.news.count({ where: whereN }),
    prisma.audio.count({ where: whereA }),
  ])

  return NextResponse.json({
    images: { items: images, total: countI },
    videos: { items: videos, total: countV },
    news: { items: news, total: countN },
    audio: { items: audio, total: countA },
    total: countI + countV + countN + countA,
    page,
  })
}
