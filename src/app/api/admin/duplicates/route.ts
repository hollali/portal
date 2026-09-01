import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = Math.min(100, parseInt(searchParams.get('perPage') || '20'))
  const mode = searchParams.get('mode') === 'url' ? 'url' : 'hash'

  if (mode === 'url') {
    const models = [
      { name: 'images', rows: await prisma.image.findMany({ select: { id: true, url: true, source: true, collectedAt: true } }) },
      { name: 'videos', rows: await prisma.video.findMany({ select: { id: true, url: true, source: true, collectedAt: true } }) },
      { name: 'news', rows: await prisma.news.findMany({ select: { id: true, url: true, source: true, collectedAt: true } }) },
      { name: 'audio', rows: await prisma.audio.findMany({ select: { id: true, url: true, source: true, collectedAt: true } }) },
    ]

    type UrlRow = { id: number; url: string | null; source: string | null; collectedAt: string | null; type: string }
    const groups: Record<string, UrlRow[]> = {}
    for (const { name, rows } of models) {
      for (const row of rows) {
        if (!row.url) continue
        const key = row.url.toLowerCase()
        if (!groups[key]) groups[key] = []
        groups[key].push({ ...row, type: name })
      }
    }

    const dupeGroups = Object.values(groups).filter(g => g.length > 1)
    const totalGroups = dupeGroups.length
    const totalDuplicates = dupeGroups.reduce((sum, g) => sum + g.length - 1, 0)
    const paginated = dupeGroups.slice((page - 1) * perPage, page * perPage)

    return NextResponse.json({ groups: paginated, totalGroups, totalDuplicates, page, perPage, mode })
  }

  const hashed = await prisma.image.findMany({
    where: { AND: [{ imageHash: { not: null } }, { imageHash: { not: { equals: '' } } }] },
    select: { id: true, imageHash: true, url: true, source: true, collectedAt: true, localPath: true },
  })

  const groups: Record<string, typeof hashed> = {}
  for (const img of hashed) {
    const h = img.imageHash!
    if (!groups[h]) groups[h] = []
    groups[h].push(img)
  }

  const dupeGroups = Object.values(groups).filter(g => g.length > 1)
  const totalGroups = dupeGroups.length
  const totalDuplicates = dupeGroups.reduce((sum, g) => sum + g.length - 1, 0)

  const paginated = dupeGroups.slice((page - 1) * perPage, page * perPage)

  return NextResponse.json({ groups: paginated, totalGroups, totalDuplicates, page, perPage, mode })
}
