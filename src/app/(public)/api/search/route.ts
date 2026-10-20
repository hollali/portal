import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''

  if (!q) {
    return NextResponse.json({ archive: { items: [], total: 0 }, milestones: { items: [], total: 0 }, testimonials: { items: [], total: 0 }, images: { items: [], total: 0 }, videos: { items: [], total: 0 }, news: { items: [], total: 0 }, audio: { items: [], total: 0 }, total: 0 })
  }

  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = 12
  const skip = (page - 1) * perPage

  const where = {
    OR: [
      { url: { contains: q, mode: 'insensitive' as const } },
      { source: { contains: q, mode: 'insensitive' as const } },
      { query: { contains: q, mode: 'insensitive' as const } },
      { caption: { contains: q, mode: 'insensitive' as const } },
    ],
  }

  const whereV = {
    OR: [
      { title: { contains: q, mode: 'insensitive' as const } },
      { url: { contains: q, mode: 'insensitive' as const } },
      { source: { contains: q, mode: 'insensitive' as const } },
      { channel: { contains: q, mode: 'insensitive' as const } },
      { platform: { contains: q, mode: 'insensitive' as const } },
      { caption: { contains: q, mode: 'insensitive' as const } },
      { category: { contains: q, mode: 'insensitive' as const } },
    ],
  }

  const whereN = {
    OR: [
      { title: { contains: q, mode: 'insensitive' as const } },
      { url: { contains: q, mode: 'insensitive' as const } },
      { source: { contains: q, mode: 'insensitive' as const } },
      { sourceName: { contains: q, mode: 'insensitive' as const } },
      { snippet: { contains: q, mode: 'insensitive' as const } },
    ],
  }

  const whereA = {
    OR: [
      { title: { contains: q, mode: 'insensitive' as const } },
      { url: { contains: q, mode: 'insensitive' as const } },
      { source: { contains: q, mode: 'insensitive' as const } },
      { artist: { contains: q, mode: 'insensitive' as const } },
      { caption: { contains: q, mode: 'insensitive' as const } },
      { category: { contains: q, mode: 'insensitive' as const } },
    ],
  }

  const whereArchive = {
    OR: [
      { title: { contains: q, mode: 'insensitive' as const } },
      { excerpt: { contains: q, mode: 'insensitive' as const } },
      { body: { contains: q, mode: 'insensitive' as const } },
      { event: { contains: q, mode: 'insensitive' as const } },
      { occasion: { contains: q, mode: 'insensitive' as const } },
      { location: { contains: q, mode: 'insensitive' as const } },
      { person: { contains: q, mode: 'insensitive' as const } },
      { institution: { contains: q, mode: 'insensitive' as const } },
      { parliament: { contains: q, mode: 'insensitive' as const } },
      { theme: { contains: q, mode: 'insensitive' as const } },
      { source: { contains: q, mode: 'insensitive' as const } },
    ],
  }

  const whereMilestones = {
    OR: [
      { title: { contains: q, mode: 'insensitive' as const } },
      { description: { contains: q, mode: 'insensitive' as const } },
    ],
  }

  const whereTestimonials = {
    OR: [
      { author: { contains: q, mode: 'insensitive' as const } },
      { role: { contains: q, mode: 'insensitive' as const } },
      { quote: { contains: q, mode: 'insensitive' as const } },
      { source: { contains: q, mode: 'insensitive' as const } },
    ],
  }

  const [archives, milestones, testimonials, images, videos, news, audio, countAr, countM, countT, countI, countV, countN, countA] = await Promise.all([
    prisma.archiveItem.findMany({ where: { status: 'published', ...whereArchive }, orderBy: { year: 'desc' }, skip, take: perPage }),
    prisma.milestone.findMany({ where: { status: 'published', ...whereMilestones }, orderBy: { year: 'asc' }, skip, take: 8 }),
    prisma.testimonial.findMany({ where: { status: 'published', ...whereTestimonials }, orderBy: [{ sortOrder: 'asc' }], skip, take: 8 }),
    prisma.image.findMany({ where, orderBy: { id: 'desc' }, skip, take: perPage }),
    prisma.video.findMany({ where: whereV, orderBy: { id: 'desc' }, skip, take: 10 }),
    prisma.news.findMany({ where: whereN, orderBy: { id: 'desc' }, skip, take: 10 }),
    prisma.audio.findMany({ where: whereA, orderBy: { id: 'desc' }, skip, take: 10 }),
    prisma.archiveItem.count({ where: { status: 'published', ...whereArchive } }),
    prisma.milestone.count({ where: { status: 'published', ...whereMilestones } }),
    prisma.testimonial.count({ where: { status: 'published', ...whereTestimonials } }),
    prisma.image.count({ where }),
    prisma.video.count({ where: whereV }),
    prisma.news.count({ where: whereN }),
    prisma.audio.count({ where: whereA }),
  ])

  return NextResponse.json({
    archive: { items: archives, total: countAr },
    milestones: { items: milestones, total: countM },
    testimonials: { items: testimonials, total: countT },
    images: { items: images, total: countI },
    videos: { items: videos, total: countV },
    news: { items: news, total: countN },
    audio: { items: audio, total: countA },
    total: countAr + countM + countT + countI + countV + countN + countA,
    page,
  })
}