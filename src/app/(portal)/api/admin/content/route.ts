import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, type Session } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET() {
  try {
    await requireRole('admin', 'editor')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sections = await prisma.contentSection.findMany({ orderBy: { key: 'asc' } })
  return NextResponse.json({ sections })
}

export async function POST(request: Request) {
  let session: Session
  try {
    session = await requireRole('admin', 'editor')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const action = body.action

  if (action === 'save') {
    const key = String(body.key || '').trim()
    if (!key) return NextResponse.json({ error: 'Section key is required' }, { status: 400 })

    const payload: Record<string, unknown> = {}
    if (body.title != null) payload.title = String(body.title)
    if (body.body != null) payload.body = String(body.body)
    if (body.data != null) payload.data = typeof body.data === 'string' ? body.data : JSON.stringify(body.data)
    if (body.status === 'draft' || body.status === 'published') payload.status = body.status

    const existing = await prisma.contentSection.findUnique({ where: { key } })
    let section
    if (existing) {
      section = await prisma.contentSection.update({ where: { key }, data: payload })
      await logAudit('edit', 'content', section.id, session.userId, `Saved section "${key}"`)
    } else {
      section = await prisma.contentSection.create({
        data: { key, title: body.title != null ? String(body.title) : key, status: 'draft', ...payload },
      })
      await logAudit('create', 'content', section.id, session.userId, `Created section "${key}"`)
    }
    return NextResponse.json({ success: true, section })
  }

  if (action === 'set_status') {
    const key = String(body.key || '').trim()
    const status = body.status
    if (!key || (status !== 'draft' && status !== 'published')) {
      return NextResponse.json({ error: 'Invalid status or key' }, { status: 400 })
    }
    const section = await prisma.contentSection.update({ where: { key }, data: { status } })
    await logAudit('edit', 'content', section.id, session.userId, `Section "${key}" -> ${status}`)
    return NextResponse.json({ success: true, section })
  }

  if (action === 'delete') {
    const key = String(body.key || '').trim()
    if (!key) return NextResponse.json({ error: 'Section key is required' }, { status: 400 })
    const existing = await prisma.contentSection.findUnique({ where: { key } })
    if (!existing) return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    await prisma.contentSection.delete({ where: { key } })
    await logAudit('delete', 'content', existing.id, session.userId, `Deleted section "${key}"`)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}