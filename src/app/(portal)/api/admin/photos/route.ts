import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, canManageMedia } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { PHOTO_FACET_FIELDS } from '@/lib/library'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const onlyCurated = searchParams.get('curated') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20') || 20))

  const where: Record<string, unknown> = {}
  if (onlyCurated) where.curated = true
  if (q) {
    where.OR = [
      { caption: { contains: q, mode: 'insensitive' } },
      { event: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
      { person: { contains: q, mode: 'insensitive' } },
      { source: { contains: q, mode: 'insensitive' } },
      { query: { contains: q, mode: 'insensitive' } },
      { url: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [items, total, curatedCount] = await Promise.all([
    prisma.image.findMany({ where, orderBy: { id: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
    prisma.image.count({ where }),
    prisma.image.count({ where: { curated: true } }),
  ])

  return NextResponse.json({ items, total, page, perPage, curatedCount })
}

export async function POST(request: Request) {
  let session: { role: string; userId: number }
  try {
    const s = await requireAuth()
    session = { role: s.role, userId: s.userId }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!canManageMedia(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  const action = body.action || ''
  const id = Number(body.id || '')

  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  if (action === 'save_facets') {
    const data: Record<string, unknown> = { curated: body.curated === true }
    if (body.year !== undefined && body.year !== null && body.year !== '') {
      const y = parseInt(String(body.year), 10)
      data.year = isNaN(y) ? null : y
    }
    for (const f of PHOTO_FACET_FIELDS) {
      if (body[f.key] !== undefined) {
        data[f.key] = body[f.key] === null || body[f.key] === '' ? null : String(body[f.key]).slice(0, 300)
      }
    }
    if (body.caption !== undefined) data.caption = body.caption === null || body.caption === '' ? null : String(body.caption).slice(0, 2000)

    try {
      const item = await prisma.image.update({ where: { id }, data: data as never })
      await logAudit('edit', 'images', id, session.userId, `Updated photo facets for image #${id}`)
      return NextResponse.json({ success: true, item })
    } catch {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }
  }

  if (action === 'toggle_curated') {
    const item = await prisma.image.findUnique({ where: { id }, select: { curated: true } })
    if (!item) return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    const next = !item.curated
    await prisma.image.update({ where: { id }, data: { curated: next } })
    await logAudit('edit', 'images', id, session.userId, `${next ? 'Curated' : 'Uncurated'} image #${id}`)
    return NextResponse.json({ success: true, curated: next })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}