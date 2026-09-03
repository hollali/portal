import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, canManageMedia, type Session } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { createNotification } from '@/lib/notify'

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
    const range: Record<string, string> = {}
    if (dateFrom) range.gte = new Date(dateFrom).toISOString()
    if (dateTo) {
      const d = new Date(dateTo)
      d.setDate(d.getDate() + 1)
      range.lt = d.toISOString()
    }
    where.collectedAt = range
  }
  return where
}

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
  const tags = searchParams.get('tags') || ''
  const dateFrom = searchParams.get('dateFrom') || ''
  const dateTo = searchParams.get('dateTo') || ''
  const sort = searchParams.get('sort') || 'id'
  const dir = searchParams.get('dir') || 'desc'
  const exportFormat = searchParams.get('export') || ''

  const model = getModel(type)
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const skip = (page - 1) * perPage
  const orderBy: WhereInput = { [sort]: dir }
  const where = buildWhere(type, source, search, tags, dateFrom, dateTo)

  // Export all matching records
  if (exportFormat === 'json' || exportFormat === 'csv') {
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

  const [items, total, sources] = await Promise.all([
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

  const formData = await request.formData()
  const action = formData.get('action') as string
  const type = formData.get('type') as string || 'images'

  if (!action) return NextResponse.json({ error: 'No action' }, { status: 400 })

  const model = getModel(type)
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  if (action === 'delete_image') {
    const pks = (formData.get('pks') as string || '').split(',').filter(Boolean)
    if (pks.length === 0) return NextResponse.json({ error: 'No IDs' }, { status: 400 })

    const ids = pks.map(Number).filter(n => !isNaN(n))

    await model.deleteMany({ where: { id: { in: ids } } })

    for (const id of ids) {
      await logAudit('delete', type, id, userId, `Deleted ${type} #${id}`)
    }

    return NextResponse.json({ success: true, deleted: ids.length })
  }

  if (action === 'delete_filtered') {
    const search = (formData.get('search') as string) || ''
    const source = (formData.get('source') as string) || ''
    const tags = (formData.get('tags') as string) || ''
    const dateFrom = (formData.get('dateFrom') as string) || ''
    const dateTo = (formData.get('dateTo') as string) || ''
    const where = buildWhere(type, source, search, tags, dateFrom, dateTo)

    const matching = await model.findMany({ where, select: { id: true } })
    const ids = matching.map((r: MediaItem) => r.id).filter((id: unknown): id is number => typeof id === 'number')

    if (ids.length === 0) return NextResponse.json({ success: true, deleted: 0 })

    await model.deleteMany({ where: { id: { in: ids } } })
    for (const id of ids) {
      await logAudit('delete', type, id, userId, `Deleted ${type} #${id} (filtered)` )
    }

    return NextResponse.json({ success: true, deleted: ids.length })
  }

  if (action === 'bulk_tag') {
    const pks = (formData.get('pks') as string || '').split(',').filter(Boolean).map(Number).filter(n => !isNaN(n))
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
    const pks = (formData.get('pks') as string || '').split(',').filter(Boolean).map(Number).filter(n => !isNaN(n))
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
    const existingUrls = new Set(existing.map((r: MediaItem) => r.url) as (string | undefined)[])

    let created = 0
    const seen = new Set<string>()
    let failed = 0
    for (const url of urls) {
      const key = url.toLowerCase()
      if (existingUrls.has(url) || seen.has(key)) continue
      seen.add(key)
      try {
        const data: DataInput = { url, source, collectedAt: new Date().toISOString() }
        if (query) data.query = query
        // best-effort title from filename for videos/news/audio
        if (type !== 'images') {
          const seg = url.split('/').filter(Boolean).pop() || ''
          const title = decodeURIComponent(seg.replace(/[-_]/g, ' ').replace(/\.[a-z0-9]{2,5}$/i, '')).trim()
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
      // Parse simple CSV (comma separated, optional quotes)
      const fields: string[] = []
      let cur = '', inQ = false
      for (const ch of line) {
        if (ch === '"') inQ = !inQ
        else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = '' }
        else cur += ch
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

    for (const [key, val] of formData.entries()) {
      if (key === 'action' || key === 'type' || key === 'file') continue
      if (typeof val === 'string') data[key] = val
    }
    if (mediaUrl) data.url = mediaUrl
    if (localPath) data.localPath = localPath
    data.collectedAt = new Date().toISOString()

    const item = await model.create({ data })
    await logAudit('create', type, item.id, userId, `Created ${type} #${item.id}`)

    return NextResponse.json({ success: true, item })
  }

  if (action === 'edit') {
    const id = parseInt(formData.get('id') as string || '')
    if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

    const data: DataInput = {}
    for (const [key, val] of formData.entries()) {
      if (typeof val !== 'string' || key === 'action' || key === 'type' || key === 'id') continue
      if (key === 'duration' || key === 'views' || key === 'faceDetected' || key === 'faceCount' || key === 'faceMatch') {
        data[key] = val === '' ? null : Number(val)
      } else if (key === 'faceMatchScore' || key === 'faceMatchDistance') {
        data[key] = val === '' ? null : Number(val)
      } else {
        data[key] = val
      }
    }

    const item = await model.update({ where: { id }, data })
    await logAudit('edit', type, id, userId, `Updated ${type} #${id}`)

    return NextResponse.json({ success: true, item })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
