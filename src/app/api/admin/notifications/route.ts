import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function GET(request: Request) {
  let session: any
  try {
    session = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === '1'
  const limit = parseInt(searchParams.get('limit') || '50')

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
  let session: any
  try {
    session = await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const action = body.action

  if (action === 'mark_read') {
    const id = parseInt(body.id)
    if (id) {
      await prisma.notification.update({ where: { id }, data: { read: true } })
    } else {
      await prisma.notification.updateMany({ data: { read: true } })
    }
    const unread = await prisma.notification.count({ where: { read: false } })
    return NextResponse.json({ success: true, unreadCount: unread })
  }

  if (action === 'delete') {
    const id = parseInt(body.id)
    if (id) {
      await prisma.notification.delete({ where: { id } })
    } else {
      await prisma.notification.deleteMany()
    }
    const unread = await prisma.notification.count({ where: { read: false } })
    return NextResponse.json({ success: true, unreadCount: unread })
  }

  if (action === 'create') {
    const type = body.type || 'info'
    const message = body.message || ''
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 })
    const notif = await prisma.notification.create({
      data: { type, message, userId: session.userId ?? null },
    })
    return NextResponse.json({ success: true, notification: notif })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
