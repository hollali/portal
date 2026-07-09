import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'images'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = 10

  let items, total
  const orderBy = { id: 'desc' as const }
  const skip = (page - 1) * perPage

  switch (type) {
    case 'images':
      items = await prisma.image.findMany({ orderBy, skip, take: perPage })
      total = await prisma.image.count()
      break
    case 'videos':
      items = await prisma.video.findMany({ orderBy, skip, take: perPage })
      total = await prisma.video.count()
      break
    case 'news':
      items = await prisma.news.findMany({ orderBy, skip, take: perPage })
      total = await prisma.news.count()
      break
    case 'audio':
      items = await prisma.audio.findMany({ orderBy, skip, take: perPage })
      total = await prisma.audio.count()
      break
    default:
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  return NextResponse.json({ items, total, page, perPage })
}

export async function POST(request: Request) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const action = formData.get('action') as string
  const type = formData.get('type') as string || 'images'

  if (!action) return NextResponse.json({ error: 'No action' }, { status: 400 })

  if (action.startsWith('delete_')) {
    const pks = (formData.get('pks') as string || '').split(',').filter(Boolean)
    if (pks.length === 0) return NextResponse.json({ error: 'No IDs' }, { status: 400 })

    const ids = pks.map(Number).filter(n => !isNaN(n))
    let model: any
    switch (type) {
      case 'images': model = prisma.image; break
      case 'videos': model = prisma.video; break
      case 'news': model = prisma.news; break
      case 'audio': model = prisma.audio; break
      default: return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    await (model as any).deleteMany({ where: { id: { in: ids } } })
    return NextResponse.json({ success: true, deleted: ids.length })
  }

  if (action === 'add') {
    const data: Record<string, string> = {}
    for (const [key, val] of formData.entries()) {
      if (typeof val === 'string') data[key] = val
    }
    data.collectedAt = new Date().toISOString()

    let model: any
    switch (type) {
      case 'images': model = prisma.image; break
      case 'videos': model = prisma.video; break
      case 'news': model = prisma.news; break
      case 'audio': model = prisma.audio; break
      default: return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const item = await model.create({ data })
    return NextResponse.json({ success: true, item })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
