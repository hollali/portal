import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireRole, type Session } from '@/lib/auth'

export async function GET(request: Request) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === '1'
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '50') || 50)

  const where = unreadOnly ? { read: false } : {}

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { id: 'desc' },
      take: Math.min(100, limit),
      select: {
        id: true, type: true, message: true, read: true, createdAt: true,
      },
    }),
    prisma.notification.count({ where: { read: false } }),
  ])

  return NextResponse.json({ notifications, unreadCount: total })
}

export async function POST(request: Request) {
  let session: Session
  try {
    session = await requireRole('admin', 'editor')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const action = body.action

  if (action === 'mark_read') {
    const rawId = body.id
    try {
      if (rawId !== undefined && rawId !== null && rawId !== '') {
        const id = Number(rawId)
        if (!Number.isInteger(id) || id <= 0) {
          return NextResponse.json({ error: 'Invalid notification id' }, { status: 400 })
        }
        await prisma.notification.update({ where: { id }, data: { read: true } })
      } else {
        await prisma.notification.updateMany({ data: { read: true } })
      }
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2025') {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to mark notification read' }, { status: 500 })
    }
    const unread = await prisma.notification.count({ where: { read: false } })
    return NextResponse.json({ success: true, unreadCount: unread })
  }

  if (action === 'delete') {
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Notification id required' }, { status: 400 })
    }
    try {
      await prisma.notification.delete({ where: { id } })
    } catch (e: unknown) {
      if ((e as { code?: string }).code === 'P2025') {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
    }
    const unread = await prisma.notification.count({ where: { read: false } })
    return NextResponse.json({ success: true, unreadCount: unread })
  }

  if (action === 'clear_read') {
    await prisma.notification.deleteMany({ where: { read: true } })
    const unread = await prisma.notification.count({ where: { read: false } })
    return NextResponse.json({ success: true, unreadCount: unread })
  }

  if (action === 'create') {
    const type = String(body.type || 'info')
    const message = String(body.message || '').trim()
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })
    const notif = await prisma.notification.create({
      data: { type, message, userId: session.userId },
    })
    return NextResponse.json({ success: true, notification: notif })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}