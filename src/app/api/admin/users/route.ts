import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, hashPassword } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET() {
  let session: any
  try {
    session = await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    select: { id: true, username: true, email: true, isAdmin: true, role: true, createdAt: true },
  })
  return NextResponse.json({ users })
}

export async function POST(request: Request) {
  let session: any
  try {
    session = await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const username = (body.username || '').trim()
  const password = body.password || ''
  const email = (body.email || '').trim() || null
  const isAdmin = !!body.isAdmin
  const role = body.role || (isAdmin ? 'admin' : 'viewer')

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 400 })

  const user = await prisma.user.create({
    data: { username, password: await hashPassword(password), email, isAdmin, role },
  })
  await logAudit('create', 'user', user.id, session.userId, `Created user "${username}" (${role})`)

  return NextResponse.json({ success: true, user: { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin, role: user.role } })
}

export async function PATCH(request: Request) {
  let session: any
  try {
    session = await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const id = parseInt(body.id)
  if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (typeof body.email === 'string') data.email = body.email.trim() || null
  if (typeof body.isAdmin === 'boolean') data.isAdmin = body.isAdmin
  if (typeof body.role === 'string') data.role = body.role
  if (typeof body.password === 'string' && body.password.length > 0 && body.password !== '') {
    data.password = await hashPassword(body.password)
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, email: true, isAdmin: true, role: true },
  })
  await logAudit('edit', 'user', id, session.userId, `Updated user "${user.username}"`)

  return NextResponse.json({ success: true, user })
}

export async function DELETE(request: Request) {
  let session: any
  try {
    session = await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = parseInt(searchParams.get('id') || '')
  if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  if (id === session.userId) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await prisma.user.delete({ where: { id } })
  await logAudit('delete', 'user', id, session.userId, `Deleted user "${user.username}"`)

  return NextResponse.json({ success: true })
}
