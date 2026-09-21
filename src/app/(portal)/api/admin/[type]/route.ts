import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, canManageMedia, type Session } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notify'
import { resolveMediaSrc } from '@/lib/mediaServer'

type WhereInput = Record<string, unknown>
type DataInput = Record<string, unknown>

interface MediaItem {
  id: number
  [key: string]: unknown
}

interface MediaModelApi {
  findMany: (args: WhereInput) => Promise<MediaItem[]>
  findUnique: (args: { where: { id: number }; select: { tags: true } }) => Promise<{ tags: string | null } | null>
  create: (args: { data: DataInput }) => Promise<MediaItem>
  update: (args: { where: { id: number }; data: DataInput }) => Promise<MediaItem>
  updateMany: (args: WhereInput) => Promise<{ count: number }>
  deleteMany: (args: WhereInput) => Promise<{ count: number }>
  count: (args?: WhereInput) => Promise<number>
}

function getModel(type: string): MediaModelApi | null {
  switch (type) {
    case 'images': return prisma.image as unknown as MediaModelApi
    case 'videos': return prisma.video as unknown as MediaModelApi
    case 'news': return prisma.news as unknown as MediaModelApi
    case 'audio': return prisma.audio as unknown as MediaModelApi
    default: return null
  }
}

const SORTABLE: Record<string, string[]> = {
  images: ['id', 'source', 'query', 'url', 'collectedAt', 'faceDetected', 'year', 'curated'],
  videos: ['id', 'source', 'platform', 'title', 'url', 'collectedAt', 'duration', 'views', 'year', 'category', 'featured', 'status'],
  news: ['id', 'source', 'title', 'url', 'sourceName', 'date', 'collectedAt'],
  audio: ['id', 'source', 'title', 'url', 'artist', 'collectedAt', 'year', 'category', 'featured', 'status'],
}

const EDITABLE_FIELDS: Record<string, string[]> = {
  images: ['source', 'query', 'url', 'faceDetected', 'faceCount', 'faceMatch', 'faceMatchScore', 'faceMatchDistance', 'dateTaken', 'year', 'event', 'location', 'person', 'institution', 'parliament', 'theme', 'caption', 'notes', 'tags', 'curated'],
  videos: ['source', 'platform', 'title', 'url', 'channel', 'duration', 'views', 'notes', 'tags', 'category', 'caption', 'date', 'year', 'event', 'location', 'theme', 'featured', 'status'],
  news: ['source', 'query', 'title', 'url', 'sourceName', 'date', 'snippet', 'notes', 'tags'],
  audio: ['source', 'query', 'title', 'url', 'artist', 'duration', 'notes', 'tags', 'category', 'caption', 'date', 'year', 'event', 'location', 'theme', 'featured', 'status'],
}

const INT_FIELDS: Record<string, string[]> = {
  images: ['faceDetected', 'faceCount', 'faceMatch', 'year'],
  videos: ['duration', 'views', 'year'],
  news: [],
  audio: ['year'],
}

const FLOAT_FIELDS: Record<string, string[]> = {
  images: ['faceMatchScore', 'faceMatchDistance'],
  videos: [],
  news: [],
  audio: [],
}

const BOOL_FIELDS: Record<string, string[]> = {
  images: ['curated'],
  videos: ['featured'],
  news: [],
  audio: ['featured'],
}

function cleanData(type: string, raw: Record<string, unknown>): DataInput {
  const allowed = new Set(EDITABLE_FIELDS[type] || [])
  const ints = new Set(INT_FIELDS[type] || [])
  const floats = new Set(FLOAT_FIELDS[type] || [])
  const bools = new Set(BOOL_FIELDS[type] || [])
  const data: DataInput = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) continue
    if (ints.has(key)) {
      data[key] = value === '' || value === null || value === undefined ? null : Number(value)
    } else if (floats.has(key)) {
      data[key] = value === '' || value === null || value === undefined ? null : Number(value)
    } else if (bools.has(key)) {
      data[key] = value === true || value === 'true' || value === '1'
    } else {
      data[key] = String(value)
    }
  }
  return data
}

function buildWhere(type: string, source: string, search: string, tags?: string, dateFrom?: string, dateTo?: string): WhereInput {
  const where: WhereInput = {}
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
  if (tags) {
    const tagFilters = tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
    if (tagFilters.length > 0 && type !== 'images') {
      where.AND = [...(Array.isArray(where.AND) ? where.AND : []), {
        OR: tagFilters.map((t: string) => ({ tags: { contains: t, mode: 'insensitive' } })),
      }]
    }
  }
  if (dateFrom || dateTo) {
    const fromDate = new Date(dateFrom || '')
    const toDate = new Date(dateTo || '')
    if (dateFrom && isNaN(fromDate.getTime())) {
      return where
    }
    if (dateTo && isNaN(toDate.getTime())) {
      return where
    }
    const range: Record<string, string> = {}
    if (dateFrom) range.gte = fromDate.toISOString()
    if (dateTo) {
      const d = toDate
      d.setDate(d.getDate() + 1)
      range.lt = d.toISOString()
    }
    where.collectedAt = range
  }
  return where
}

export async function GET(request: NextRequest) {
  let session: Session
  try {
    session = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'images'
  const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
  const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('perPage') || '10') || 10))
  const search = searchParams.get('search') || ''
  const source = searchParams.get('source') || ''
  const tags = searchParams.get('tags') || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo = searchParams.get('dateTo') || ''
  const sort = searchParams.get('sort') || 'id'
  const dir = searchParams.get('dir') || 'desc'
  const exportFormat = searchParams.get('export') || ''

  const model = getModel(type)
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const sortable = SORTABLE[type] || ['id']
  const safeSort = sortable.includes(sort) ? sort : 'id'
  const safeDir = dir === 'asc' ? 'asc' : 'desc'

  const skip = (page - 1) * perPage
  const orderBy: WhereInput = { [safeSort]: safeDir }
  const where = buildWhere(type, source, search, tags, dateFrom, dateTo)

  // Export requires editor/admin rights (viewers can browse but not exfiltrate)
  if (exportFormat === 'json' || exportFormat === 'csv') {
    if (!canManageMedia(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const allItems = await model.findMany({ where, orderBy: { id: 'desc' } })
    const fields = type === 'images' ? ['id', 'source', 'query', 'url', 'collectedAt'] :
      type === 'videos' ? ['id', 'source', 'platform', 'title', 'url', 'channel', 'duration', 'views', 'collectedAt'] :
      type === 'news' ? ['id', 'source', 'title', 'url', 'sourceName', 'date', 'snippet', 'collectedAt'] :
      ['id', 'source', 'title', 'url', 'artist', 'duration', 'collectedAt']

    if (exportFormat === 'csv') {
      const header = fields.join(',')
      const rows = allItems.map((item: MediaItem) =>
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

  const [rawItems, total, sources] = await Promise.all([
    model.findMany({ where, orderBy, skip, take: perPage }),
    model.count({ where }),
    model.findMany({
      where: buildWhere(type, source, '', tags, dateFrom, dateTo),
      select: { source: true },
      distinct: ['source'],
      orderBy: { source: 'asc' },
    }),
  ])

  const sourceList = sources.map((s: MediaItem) => s.source).filter(Boolean)
  const items = rawItems.map((row: MediaItem) => ({ ...row, src: resolveMediaSrc(row as { localPath?: string | null; url?: string | null }) }))

  return NextResponse.json({ items, total, page, perPage, sources: sourceList })
}

export async function POST(request: Request) {
  let userId: number | undefined
  let session: Session
  try {
    session = await requireAuth()
    userId = session.userId
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!canManageMedia(session.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }
  const action = formData.get('action') as string
  const type = formData.get('type') as string || 'images'

  if (!action) return NextResponse.json({ error: 'No action' }, { status: 400 })

  const model = getModel(type)
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const parseIds = (raw: string | null): number[] =>
    (raw || '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)

  if (action === 'delete_image') {
    const ids = parseIds(formData.get('pks') as string | null)
    if (ids.length === 0) return NextResponse.json({ error: 'No IDs' }, { status: 400 })

    const victims = await model.findMany({ where: { id: { in: ids } }, select: { localPath: true, url: true } as never })
    const result = await model.deleteMany({ where: { id: { in: ids } } })

    for (const id of ids) {
      await logAudit('delete', type, id, userId, `Deleted ${type} #${id}`)
    }

    const { deleteStoredFile } = await import('@/lib/mediaFiles')
    for (const v of victims) {
      deleteStoredFile(v.localPath as string | undefined)
      deleteStoredFile(v.url as string | undefined)
    }

    return NextResponse.json({ success: true, deleted: result.count })
  }

  if (action === 'delete_filtered') {
    const where = buildWhere(
      type,
      (formData.get('source') as string) || '',
      (formData.get('search') as string) || '',
      (formData.get('tags') as string) || '',
      (formData.get('dateFrom') as string) || '',
      (formData.get('dateTo') as string) || '',
    )

    const matching = await model.findMany({ where, select: { id: true, localPath: true, url: true } as never })
    const victims = matching as unknown as MediaItem[]
    const ids = victims.map((r: MediaItem) => r.id).filter((id: unknown): id is number => typeof id === 'number')

    if (ids.length === 0) return NextResponse.json({ success: true, deleted: 0 })

    await model.deleteMany({ where: { id: { in: ids } } })
    for (const id of ids) {
      await logAudit('delete', type, id, userId, `Deleted ${type} #${id} (filtered)` )
    }

    const { deleteStoredFile } = await import('@/lib/mediaFiles')
    for (const v of victims) {
      deleteStoredFile(v.localPath as string | undefined)
      deleteStoredFile(v.url as string | undefined)
    }

    return NextResponse.json({ success: true, deleted: ids.length })
  }

  if (action === 'bulk_tag') {
    const pks = parseIds(formData.get('pks') as string | null)
    const rawTags = (formData.get('tags') as string || '').split(',').map((t: string) => t.trim()).filter(Boolean)
    const mode = (formData.get('mode') as string) || 'add'
    if (pks.length === 0 || rawTags.length === 0) return NextResponse.json({ error: 'No IDs or tags' }, { status: 400 })

    for (const id of pks) {
      const item = await model.findUnique({ where: { id }, select: { tags: true } })
      const tagsValue = item?.tags
      const current = tagsValue ? String(tagsValue).split(',').map((t: string) => t.trim()).filter(Boolean) : []
      let next: string[]
      if (mode === 'remove') {
        next = current.filter((t: string) => !rawTags.some((rt: string) => rt.toLowerCase() === t.toLowerCase()))
      } else {
        const lower = new Set(current.map((t: string) => t.toLowerCase()))
        for (const t of rawTags) {
          if (!lower.has(t.toLowerCase())) { current.push(t); lower.add(t.toLowerCase()) }
        }
        next = current
      }
      await model.update({
        where: { id },
        data: { tags: next.length > 0 ? next.join(', ') : null },
      })
    }
    await logAudit('edit', type, 0, userId, `Bulk tag ${pks.length} ${type} record(s)`)
    return NextResponse.json({ success: true, updated: pks.length })
  }

  if (action === 'bulk_reassign') {
    const pks = parseIds(formData.get('pks') as string | null)
    const newSource = (formData.get('source') as string || '').trim()
    if (pks.length === 0 || !newSource) return NextResponse.json({ error: 'No IDs or source' }, { status: 400 })

    await model.updateMany({ where: { id: { in: pks } }, data: { source: newSource } })
    await logAudit('edit', type, 0, userId, `Bulk reassigned ${pks.length} ${type} record(s) to "${newSource}"`)
    return NextResponse.json({ success: true, updated: pks.length })
  }

  if (action === 'bulk_import') {
    const raw = (formData.get('urls') as string) || ''
    const source = (formData.get('source') as string) || ''
    const query = (formData.get('query') as string) || ''
    const urls = raw.split(/\r?\n/).map(u => u.trim()).filter(Boolean)

    if (urls.length === 0) return NextResponse.json({ error: 'No URLs provided' }, { status: 400 })

    const existing = await model.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    })
    const existingUrls = new Set(existing.map((r: MediaItem) => r.url).filter(Boolean).map(u => String(u).toLowerCase()))

    let created = 0
    const seen = new Set<string>()
    let failed = 0
    for (const url of urls) {
      const key = url.toLowerCase()
      if (existingUrls.has(key) || seen.has(key)) continue
      seen.add(key)
      try {
        const data: DataInput = { url, source, collectedAt: new Date().toISOString() }
        if (query) data.query = query
        // best-effort title from filename for videos/news/audio
        if (type !== 'images') {
          const seg = url.split('/').filter(Boolean).pop() || ''
          let title = ''
          try {
            title = decodeURIComponent(seg.replace(/[-_]/g, ' ').replace(/\.[a-z0-9]{2,5}$/i, '')).trim()
          } catch {
            title = seg.trim()
          }
          if (title) data.title = title
        }
        await model.create({ data })
        created++
        await logAudit('create', type, 0, userId, `Imported ${type} by URL`)
      } catch {
        // ignore per-row failures (e.g. constraint race)
        failed++
      }
    }

    if (created > 0) {
      await createNotification('success', `Bulk import complete: created ${created} ${type} record(s).`, userId)
    }
    if (failed > 0) {
      await createNotification('error', `Bulk import: ${failed} ${type} URL(s) failed to import.`, userId)
    }

    return NextResponse.json({ success: true, created, skipped: urls.length - created, failed })
  }

  if (action === 'csv_import') {
    const csv = (formData.get('csv') as string) || ''
    const source = (formData.get('source') as string) || ''
    if (!csv.trim()) return NextResponse.json({ error: 'No CSV data' }, { status: 400 })

    const lines = csv.split(/\r?\n/).filter(l => l.trim() && !l.trim().startsWith('#'))
    let created = 0
    let failed = 0
    for (const line of lines) {
      // Parse simple CSV (comma separated, optional quotes, escaped quotes)
      const fields: string[] = []
      let cur = '', inQ = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') {
            cur += '"'; i++
          } else {
            inQ = !inQ
          }
        } else if (ch === ',' && !inQ) {
          fields.push(cur.trim()); cur = ''
        } else {
          cur += ch
        }
      }
      fields.push(cur.trim())
      const url = fields[0] || ''
      if (!url) continue
      const data: DataInput = { url, source, collectedAt: new Date().toISOString() }
      if (fields[1]) data.title = fields[1]
      if (fields[2]) data.notes = fields[2]
      if (fields[3]) data.tags = fields[3]
      try {
        await model.create({ data })
        created++
      } catch {
        failed++
      }
    }
    await createNotification('success', `CSV import complete: created ${created} record(s).`, userId)
    if (failed > 0) await createNotification('error', `CSV import: ${failed} row(s) failed (possibly duplicates).`, userId)
    return NextResponse.json({ success: true, created, failed })
  }

  if (action === 'add') {
    const data: DataInput = {}
    let mediaUrl: string | null = null
    let localPath: string | null = null

    const file = formData.get('file')
    if (file instanceof File && file.size > 0) {
      try {
        const { saveUploadedFile } = await import('@/lib/upload')
        const saved = await saveUploadedFile(file, type)
        localPath = saved.localPath
        mediaUrl = saved.url
      } catch {
        return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
      }
    }

    const raw: Record<string, unknown> = {}
    for (const [key, val] of formData.entries()) {
      if (key === 'action' || key === 'type' || key === 'file') continue
      if (typeof val === 'string') raw[key] = val
    }
    Object.assign(data, cleanData(type, raw))
    if (mediaUrl) data.url = mediaUrl
    if (localPath) data.localPath = localPath
    data.collectedAt = new Date().toISOString()

    try {
      const item = await model.create({ data })
      await logAudit('create', type, item.id, userId, `Created ${type} #${item.id}`)
      return NextResponse.json({ success: true, item })
    } catch (e: unknown) {
      const { deleteStoredFile } = await import('@/lib/mediaFiles')
      if (localPath) deleteStoredFile(localPath)
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'A record with that URL already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create record' }, { status: 500 })
    }
  }

  if (action === 'edit') {
    const id = Number(formData.get('id') as string || '')
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const raw: Record<string, unknown> = {}
    for (const [key, val] of formData.entries()) {
      if (typeof val !== 'string' || key === 'action' || key === 'type' || key === 'id') continue
      raw[key] = val
    }
    const data = cleanData(type, raw)

    try {
      const item = await model.update({ where: { id }, data })
      await logAudit('edit', type, id, userId, `Updated ${type} #${id}`)
      return NextResponse.json({ success: true, item })
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2025') {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 })
      }
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'A record with that URL already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}