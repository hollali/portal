import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, type Session } from '@/lib/auth'

export async function GET(request: Request) {
  let session: Session
  try {
    session = await requireRole('admin', 'editor')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === '1'
  const limit = Math.max(1, parseInt(searchParams.get('limit') || '50') || 50)

  const where = { userId: session.userId, ...(unreadOnly ? { read: false } : {}) }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { id: 'desc' },
      take: Math.min(100, limit),
      select: {
        id: true, type: true, message: true, read: true, createdAt: true,
      },
    }),
    prisma.notification.count({ where: { userId: session.userId, read: false } }),
  ])

  return NextResponse.json({ notifications, unreadCount })
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

  const unreadCount = () => prisma.notification.count({ where: { userId: session.userId, read: false } })

  if (action === 'mark_read') {
    const rawId = body.id
    try {
      if (rawId !== undefined && rawId !== null && rawId !== '') {
        const id = Number(rawId)
        if (!Number.isInteger(id) || id <= 0) {
          return NextResponse.json({ error: 'Invalid notification id' }, { status: 400 })
        }
        const res = await prisma.notification.updateMany({ where: { id, userId: session.userId }, data: { read: true } })
        if (res.count === 0) {
          return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
        }
      } else {
        await prisma.notification.updateMany({ where: { userId: session.userId, read: false }, data: { read: true } })
      }
    } catch {
      return NextResponse.json({ error: 'Failed to mark notification read' }, { status: 500 })
    }
    return NextResponse.json({ success: true, unreadCount: await unreadCount() })
  }

  if (action === 'delete') {
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Notification id required' }, { status: 400 })
    }
    try {
      const res = await prisma.notification.deleteMany({ where: { id, userId: session.userId } })
      if (res.count === 0) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
      }
    } catch {
      return NextResponse.json({ error: 'Failed to delete notification' }, { status: 500 })
    }
    return NextResponse.json({ success: true, unreadCount: await unreadCount() })
  }

  if (action === 'clear_read') {
    await prisma.notification.deleteMany({ where: { userId: session.userId, read: true } })
    return NextResponse.json({ success: true, unreadCount: await unreadCount() })
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