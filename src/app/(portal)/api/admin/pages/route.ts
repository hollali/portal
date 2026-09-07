import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, type Session } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { normalizeSlug } from '@/lib/content'

export async function GET() {
  try {
    await requireRole('admin', 'editor')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const pages = await prisma.contentPage.findMany({ orderBy: { updatedAt: 'desc' } })
  return NextResponse.json({ pages })
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

  if (action === 'create') {
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const slug = normalizeSlug(body.slug ?? title)
    const existing = await prisma.contentPage.findUnique({ where: { slug } })
    if (existing) return NextResponse.json({ error: `A page with slug "/${slug}" already exists` }, { status: 409 })

    const page = await prisma.contentPage.create({
      data: {
        title,
        slug,
        body: body.body != null ? String(body.body) : '',
        status: body.status === 'published' ? 'published' : 'draft',
        publishedAt: body.status === 'published' ? new Date() : null,
      },
    })
    await logAudit('create', 'page', page.id, session.userId, `Created page "${title}" (/${slug})`)
    return NextResponse.json({ success: true, page })
  }

  if (action === 'update') {
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'Page id is required' }, { status: 400 })

    const existing = await prisma.contentPage.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Page not found' }, { status: 404 })

    const payload: Record<string, unknown> = {}
    if (body.title != null) {
      const title = String(body.title).trim()
      if (!title) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      payload.title = title
    }
    if (body.slug != null) {
      const slug = normalizeSlug(body.slug)
      const clash = await prisma.contentPage.findFirst({ where: { slug, id: { not: id } } })
      if (clash) return NextResponse.json({ error: `A page with slug "/${slug}" already exists` }, { status: 409 })
      payload.slug = slug
    }
    if (body.body != null) payload.body = String(body.body)

    const page = await prisma.contentPage.update({ where: { id }, data: payload })
    await logAudit('edit', 'page', page.id, session.userId, `Updated page "${page.title}" (/${page.slug})`)
    return NextResponse.json({ success: true, page })
  }

  if (action === 'set_status') {
    const id = Number(body.id)
    const status = body.status
    if (!id || (status !== 'draft' && status !== 'published')) {
      return NextResponse.json({ error: 'Invalid status or id' }, { status: 400 })
    }
    const page = await prisma.contentPage.update({
      where: { id },
      data: { status, publishedAt: status === 'published' ? new Date() : null },
    })
    await logAudit('edit', 'page', page.id, session.userId, `Page "(${page.slug})" -> ${status}`)
    return NextResponse.json({ success: true, page })
  }

  if (action === 'delete') {
    const id = Number(body.id)
    if (!id) return NextResponse.json({ error: 'Page id is required' }, { status: 400 })
    const existing = await prisma.contentPage.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
    await prisma.contentPage.delete({ where: { id } })
    await logAudit('delete', 'page', id, session.userId, `Deleted page "(${existing.slug})"`)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}