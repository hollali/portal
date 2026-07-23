import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'images'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = parseInt(searchParams.get('perPage') || '10')
  const search = searchParams.get('search') || ''
  const source = searchParams.get('source') || ''
  const sort = searchParams.get('sort') || 'id'
  const dir = searchParams.get('dir') || 'desc'
  const exportFormat = searchParams.get('export') || ''

  const skip = (page - 1) * perPage
  const orderBy: any = { [sort]: dir }

  const buildWhere = (baseWhere: any = {}) => {
    const where = { ...baseWhere }
    if (source) where.source = source
    if (search) {
      if (type === 'images') {
        where.OR = [
          { url: { contains: search, mode: 'insensitive' } },
          { query: { contains: search, mode: 'insensitive' } },
          { source: { contains: search, mode: 'insensitive' } },
        ]
      } else if (type === 'videos') {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { channel: { contains: search, mode: 'insensitive' } },
          { source: { contains: search, mode: 'insensitive' } },
        ]
      } else if (type === 'news') {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { sourceName: { contains: search, mode: 'insensitive' } },
          { snippet: { contains: search, mode: 'insensitive' } },
          { source: { contains: search, mode: 'insensitive' } },
        ]
      } else if (type === 'audio') {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { artist: { contains: search, mode: 'insensitive' } },
          { source: { contains: search, mode: 'insensitive' } },
        ]
      }
    }
    return where
  }

  let model: any
  switch (type) {
    case 'images': model = prisma.image; break
    case 'videos': model = prisma.video; break
    case 'news': model = prisma.news; break
    case 'audio': model = prisma.audio; break
    default: return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  const where = buildWhere()

  // Export all matching records
  if (exportFormat === 'json' || exportFormat === 'csv') {
    const allItems = await model.findMany({ where, orderBy: { id: 'desc' } })
    const fields = type === 'images' ? ['id', 'source', 'query', 'url', 'collectedAt'] :
      type === 'videos' ? ['id', 'source', 'platform', 'title', 'url', 'channel', 'duration', 'views', 'collectedAt'] :
      type === 'news' ? ['id', 'source', 'title', 'url', 'sourceName', 'date', 'snippet', 'collectedAt'] :
      ['id', 'source', 'title', 'url', 'artist', 'duration', 'collectedAt']

    if (exportFormat === 'csv') {
      const header = fields.join(',')
      const rows = allItems.map((item: any) =>
        fields.map(f => `"${String(item[f] ?? '').replace(/"/g, '""')}"`).join(',')
      )
      const csv = [header, ...rows].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${type}_export_${Date.now()}.csv"`,
        }
      })
    }

    return NextResponse.json({ items: allItems, total: allItems.length })
  }

  const [items, total, sources] = await Promise.all([
    model.findMany({ where, orderBy, skip, take: perPage }),
    model.count({ where }),
    model.findMany({
      where: buildWhere(),
      select: { source: true },
      distinct: ['source'],
      orderBy: { source: 'asc' },
    }),
  ])

  const sourceList = sources.map((s: any) => s.source).filter(Boolean)

  return NextResponse.json({ items, total, page, perPage, sources: sourceList })
}

export async function POST(request: Request) {
  let userId: number | undefined
  try {
    const session = await requireAuth()
    userId = (session as any)?.userId
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

    for (const id of ids) {
      await logAudit('delete', type, id, userId, `Deleted ${type} #${id}`)
    }

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
    await logAudit('create', type, item.id, userId, `Created ${type} #${item.id}`)

    return NextResponse.json({ success: true, item })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
