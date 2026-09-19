import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, hashPassword, type Session } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET() {
  try {
    await requireRole('admin')
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
  let session: Session
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
  const role = ALLOWED_ROLES.includes(body.role) ? body.role : (isAdmin ? 'admin' : 'viewer')

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) return NextResponse.json({ error: 'Username already exists' }, { status: 400 })

  try {
    const user = await prisma.user.create({
      data: { username, password: await hashPassword(password), email, isAdmin, role },
    })
    await logAudit('create', 'user', user.id, session.userId, `Created user "${username}" (${role})`)
    return NextResponse.json({ success: true, user: { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin, role: user.role } })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

const ALLOWED_ROLES = ['admin', 'editor', 'viewer']

export async function PATCH(request: Request) {
  let session: Session
  try {
    session = await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const id = Number(body.id)
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  const data: Record<string, unknown> = {}
  if (typeof body.email === 'string') data.email = body.email.trim() || null
  if (typeof body.isAdmin === 'boolean') data.isAdmin = body.isAdmin
  if (typeof body.role === 'string') {
    if (!ALLOWED_ROLES.includes(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    data.role = body.role
  }
  if (typeof body.password === 'string' && body.password.length > 0) {
    if (body.password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    data.password = await hashPassword(body.password)
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const newRole = typeof body.role === 'string' ? body.role : undefined
  const newIsAdmin = typeof body.isAdmin === 'boolean' ? body.isAdmin : undefined
  const demotingToNonAdmin = newRole !== undefined && newRole !== 'admin'
  const isSelf = id === session.userId
  if (isSelf && (demotingToNonAdmin || newIsAdmin === false)) {
    return NextResponse.json({ error: 'You cannot remove your own admin access' }, { status: 400 })
  }

  if ((demotingToNonAdmin && target.role === 'admin') || (target.role === 'admin' && newIsAdmin === false)) {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } })
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 })
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, email: true, isAdmin: true, role: true },
    })
    await logAudit('edit', 'user', id, session.userId, `Updated user "${user.username}"`)
    return NextResponse.json({ success: true, user })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Username or email already exists' }, { status: 409 })
    }
    if ((e as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  let session: Session
  try {
    session = await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = Number(searchParams.get('id') || '')
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })

  if (id === session.userId) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, role: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (user.role === 'admin') {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } })
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin' }, { status: 400 })
    }
  }

  await prisma.user.delete({ where: { id } })
  await logAudit('delete', 'user', id, session.userId, `Deleted user "${user.username}"`)

  return NextResponse.json({ success: true })
}
