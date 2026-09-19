import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, canManageMedia } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { normalizeSlug } from '@/lib/library'

const VALID_TYPES = ['archive', 'milestones', 'testimonials']
const VALID_KINDS = ['speech', 'paper', 'interview', 'note', 'letter', 'memo']
const VALID_STATUSES = ['draft', 'published', 'archived']

const ALLOWED_FIELDS: Record<string, string[]> = {
  archive: ['kind', 'title', 'slug', 'date', 'year', 'event', 'location', 'person', 'institution', 'parliament', 'theme', 'venue', 'source', 'sourceUrl', 'sourceType', 'excerpt', 'body', 'filePath', 'fileName', 'coverUrl', 'featured', 'status'],
  milestones: ['year', 'period', 'title', 'description', 'category', 'order', 'status'],
  testimonials: ['author', 'role', 'quote', 'source', 'year', 'photoUrl', 'sortOrder', 'status'],
}

const NUM_FIELDS: Record<string, string[]> = {
  archive: ['year'],
  milestones: ['order'],
  testimonials: ['year', 'sortOrder'],
}

const BOOL_FIELDS: Record<string, string[]> = {
  archive: ['featured'],
  milestones: [],
  testimonials: [],
}

async function auth() {
  const session = await requireAuth()
  if (!canManageMedia(session.role)) throw new Error('Forbidden')
  return session
}

function buildWhere(type: string, q: string, kind?: string) {
  let or: Record<string, unknown>[] = []
  if (type === 'archive') {
    or = [
      { title: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
    ]
    if (kind && VALID_KINDS.includes(kind)) return { OR: or, kind }
    return { OR: or }
  }
  if (type === 'milestones') return { OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] }
  return { OR: [{ author: { contains: q, mode: 'insensitive' } }, { quote: { contains: q, mode: 'insensitive' } }] }
}

export async function GET(request: NextRequest) {
  try {
    await auth()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'archive'
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  const q = searchParams.get('q') || ''
  const kind = searchParams.get('kind') || ''
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('perPage') || '20') || 20))

  const where = q || kind ? buildWhere(type, q, kind) : {}

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
      if (typeof val === 'string') body[key] = val
    }
    const file = fd.get('file')
    if (file instanceof File && file.size > 0) {
      try {
        const { saveUploadedFile } = await import('@/lib/upload')
        const saved = await saveUploadedFile(file, 'documents')
        body.filePath = saved.url
        body.fileName = file.name
      } catch {
        return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
      }
    }
  } else {
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
  }

  const action = String(body.action || '')
  const type = String(body.type || 'archive')

  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const cleanData = (data: Record<string, unknown>): Record<string, unknown> => {
    const allowed = new Set(ALLOWED_FIELDS[type] || [])
    const nums = new Set(NUM_FIELDS[type] || [])
    const bools = new Set(BOOL_FIELDS[type] || [])
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(data)) {
      if (!allowed.has(key)) continue
      if (nums.has(key)) {
        out[key] = val === '' || val === null || val === undefined ? null : Number(val)
      } else if (bools.has(key)) {
        out[key] = val === true || val === 'true' || val === '1'
      } else {
        out[key] = val === '' || val === null ? null : String(val)
      }
    }
    return out
  }

  const validateStatus = (data: Record<string, unknown>): string =>
    VALID_STATUSES.includes(String(data.status)) ? String(data.status) : 'draft'

  if (action === 'create') {
    let data = cleanData(body)
    if (type === 'archive') {
      const title = String(body.title || 'Untitled')
      data = { ...data, title, slug: data.slug ? String(data.slug) : `${normalizeSlug(title)}-${Date.now()}` }
      const kind = String(data.kind || 'speech')
      data.kind = VALID_KINDS.includes(kind) ? kind : 'speech'
    }
    data.status = validateStatus(data)

    try {
      let item: { id: number }
      if (type === 'archive') item = await prisma.archiveItem.create({ data: data as never }) as never
      else if (type === 'milestones') item = await prisma.milestone.create({ data: data as never }) as never
      else item = await prisma.testimonial.create({ data: data as never }) as never

      await logAudit('create', type, item.id, session.userId, `Created ${type} #${item.id}`)
      return NextResponse.json({ success: true, item })
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'A record with that slug already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create record' }, { status: 500 })
    }
  }

  if (action === 'update') {
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    const data = cleanData(body)
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    if ('status' in data) data.status = validateStatus(data)

    try {
      let item: { id: number }
      if (type === 'archive') item = await prisma.archiveItem.update({ where: { id }, data: data as never }) as never
      else if (type === 'milestones') item = await prisma.milestone.update({ where: { id }, data: data as never }) as never
      else item = await prisma.testimonial.update({ where: { id }, data: data as never }) as never

      await logAudit('edit', type, id, session.userId, `Updated ${type} #${id}`)
      return NextResponse.json({ success: true, item })
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2025') {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 })
      }
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'A record with that slug already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
    }
  }

  if (action === 'delete') {
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    try {
      if (type === 'archive') await prisma.archiveItem.delete({ where: { id } })
      else if (type === 'milestones') await prisma.milestone.delete({ where: { id } })
      else await prisma.testimonial.delete({ where: { id } })
      await logAudit('delete', type, id, session.userId, `Deleted ${type} #${id}`)
      return NextResponse.json({ success: true })
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2025') {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 })
    }
  }

  if (action === 'set_status') {
    const id = Number(body.id)
    const status = String(body.status || 'draft')
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    if (!VALID_STATUSES.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    try {
      if (type === 'archive') await prisma.archiveItem.update({ where: { id }, data: { status } })
      else if (type === 'milestones') await prisma.milestone.update({ where: { id }, data: { status } })
      else await prisma.testimonial.update({ where: { id }, data: { status } })
      await logAudit('edit', type, id, session.userId, `Set status ${status} on ${type} #${id}`)
      return NextResponse.json({ success: true })
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2025') {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}