import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyPassword, signToken } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const attempts = new Map<string, { count: number; until: number }>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (entry && entry.until > now) return true
  if (!entry || entry.until <= now) {
    attempts.set(key, { count: 1, until: now + 60_000 })
    return false
  }
  entry.count += 1
  if (entry.count >= 5) {
    entry.until = now + 60_000
  }
  return false
}

export async function POST(request: Request) {
  let username = ''
  let password = ''
  let ip = ''
  try {
    const body = await request.json()
    username = body?.username ?? ''
    password = body?.password ?? ''
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 })
  }

  const forwarded = request.headers.get('x-forwarded-for')
  ip = (forwarded?.split(',')[0] || 'local').trim()

  if (rateLimited(username) || rateLimited(`${ip}:${username}`)) {
    return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
  }

  let user: { id: number; username: string; password: string; isAdmin: boolean; role: string } | null
  try {
    user = await prisma.user.findUnique({ where: { username } })
  } catch {
    return NextResponse.json({ error: 'Database unavailable, please retry' }, { status: 503 })
  }
  if (!user || !(await verifyPassword(password, user.password))) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = signToken({ userId: user.id, username: user.username, isAdmin: user.isAdmin, role: user.role })
  const cookieStore = await cookies()
  cookieStore.set('session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })

  await logAudit('login', 'user', user.id, user.id, `User "${user.username}" logged in`)

  return NextResponse.json({ success: true, username: user.username, isAdmin: user.isAdmin, role: user.role })
}
