import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, canManageMedia } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { normalizeSlug } from '@/lib/library'

const VALID_TYPES = ['archive', 'milestones', 'testimonials']

async function auth() {
  const session = await requireAuth()
  if (!canManageMedia(session.role)) throw new Error('Forbidden')
  return session
}

function buildWhere(type: string, q: string) {
  if (type === 'archive') {
    const or: Record<string, unknown>[] = [
      { title: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
    ]
    return { OR: or }
  }
  if (type === 'milestones') return { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }
  return { OR: [{ author: { contains: q, mode: 'insensitive' } }, { quote: { contains: q, mode: 'insensitive' } }] }
}

export async function GET(request: NextRequest) {
  try {
    await auth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'archive'
  const q = searchParams.get('q') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = parseInt(searchParams.get('perPage') || '20')

  const where = q ? buildWhere(type, q) : {}

  let items: unknown[]
  let total: number
  if (type === 'archive') {
    const [rows, count] = await Promise.all([
      prisma.archiveItem.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * perPage, take: perPage }),
      prisma.archiveItem.count({ where }),
    ])
    items = rows
    total = count
  } else if (type === 'milestones') {
    const [rows, count] = await Promise.all([
      prisma.milestone.findMany({ where, orderBy: { year: 'asc' }, skip: (page - 1) * perPage, take: perPage }),
      prisma.milestone.count({ where }),
    ])
    items = rows
    total = count
  } else {
    const [rows, count] = await Promise.all([
      prisma.testimonial.findMany({ where, orderBy: { sortOrder: 'asc' }, skip: (page - 1) * perPage, take: perPage }),
      prisma.testimonial.count({ where }),
    ])
    items = rows
    total = count
  }

  return NextResponse.json({ items, total, page, perPage })
}

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof auth>>
  try {
    session = await auth()
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unauthorized' }, { status: err instanceof Error && err.message === 'Forbidden' ? 403 : 401 })
  }

  const contentType = request.headers.get('content-type') || ''
  let body: Record<string, unknown>

  if (contentType.includes('multipart/form-data')) {
    const fd = await request.formData()
    body = {}
    for (const [key, val] of fd.entries()) {
      if (key === 'file') continue
      if (typeof val === 'string') body[key] = val
    }
    const file = fd.get('file')
    if (file instanceof File && file.size > 0) {
      const { saveUploadedFile } = await import('@/lib/upload')
      const saved = await saveUploadedFile(file, 'documents')
      body.filePath = saved.url
      body.fileName = file.name
    }
  } else {
    body = await request.json()
  }

  const action = String(body.action || '')
  const type = String(body.type || 'archive')

  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  if (!canManageMedia(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cleanData = (data: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    const skipKeys = ['action', 'type', 'id', 'createdAt', 'updatedAt']
    const numKeys = ['year', 'sortOrder', 'order']
    for (const [key, val] of Object.entries(data)) {
      if (skipKeys.includes(key)) continue
      if (typeof val !== 'string' && typeof val !== 'number' && typeof val !== 'boolean' && val !== null) continue
      if (numKeys.includes(key)) {
        out[key] = val === '' || val === null ? null : Number(val)
      } else {
        out[key] = val === '' ? null : (typeof val === 'number' ? String(val) : val)
      }
    }
    return out
  }

  if (action === 'create') {
    let data = cleanData(body)
    if (type === 'archive') {
      const title = String(body.title || 'Untitled')
      data = { ...data, title, slug: data.slug ? String(data.slug) : `${normalizeSlug(title)}-${Date.now()}` }
      if (!data.kind) data.kind = 'speech'
      data.status = data.status || 'draft'
    } else if (type === 'milestones') {
      data.status = data.status || 'draft'
    } else {
      data.status = data.status || 'draft'
    }

    let item: { id: number }
    if (type === 'archive') item = await prisma.archiveItem.create({ data: data as never }) as never
    else if (type === 'milestones') item = await prisma.milestone.create({ data: data as never }) as never
    else item = await prisma.testimonial.create({ data: data as never }) as never

    await logAudit('create', type, item.id, session.userId, `Created ${type} #${item.id}`)
    return NextResponse.json({ success: true, item })
  }

  if (action === 'update') {
    const id = Number(body.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    const data = cleanData(body)

    let item: { id: number }
    if (type === 'archive') item = await prisma.archiveItem.update({ where: { id }, data: data as never }) as never
    else if (type === 'milestones') item = await prisma.milestone.update({ where: { id }, data: data as never }) as never
    else item = await prisma.testimonial.update({ where: { id }, data: data as never }) as never

    await logAudit('edit', type, id, session.userId, `Updated ${type} #${id}`)
    return NextResponse.json({ success: true, item })
  }

  if (action === 'delete') {
    const id = Number(body.id)
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    if (type === 'archive') await prisma.archiveItem.delete({ where: { id } })
    else if (type === 'milestones') await prisma.milestone.delete({ where: { id } })
    else await prisma.testimonial.delete({ where: { id } })
    await logAudit('delete', type, id, session.userId, `Deleted ${type} #${id}`)
    return NextResponse.json({ success: true })
  }

  if (action === 'set_status') {
    const id = Number(body.id)
    const status = String(body.status || 'draft')
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    if (type === 'archive') await prisma.archiveItem.update({ where: { id }, data: { status } })
    else if (type === 'milestones') await prisma.milestone.update({ where: { id }, data: { status } })
    else await prisma.testimonial.update({ where: { id }, data: { status } })
    await logAudit('edit', type, id, session.userId, `Set status ${status} on ${type} #${id}`)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}