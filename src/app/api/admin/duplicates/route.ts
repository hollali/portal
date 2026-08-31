import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = Math.min(100, parseInt(searchParams.get('perPage') || '20'))

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

  return NextResponse.json({ groups: paginated, totalGroups, totalDuplicates, page, perPage })
}
