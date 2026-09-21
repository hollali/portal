import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyPassword, signToken } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const attempts = new Map<string, number[]>()
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 5

function pruneKey(key: string): void {
  const now = Date.now()
  const list = attempts.get(key)
  if (!list) return
  const alive = list.filter(t => t > now - WINDOW_MS)
  if (alive.length === 0) attempts.delete(key)
  else attempts.set(key, alive)
}

function isRateLimited(key: string): boolean {
  pruneKey(key)
  return (attempts.get(key) || []).length >= MAX_ATTEMPTS
}

function recordFailure(key: string): void {
  pruneKey(key)
  const list = attempts.get(key) || []
  list.push(Date.now())
  attempts.set(key, list)
}

function clearKey(key: string): void {
  attempts.delete(key)
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

  if (isRateLimited(username) || isRateLimited(`${ip}:${username}`)) {
    return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
  }

  let user: { id: number; username: string; password: string; isAdmin: boolean; role: string } | null
  try {
    user = await prisma.user.findUnique({ where: { username } })
  } catch {
    return NextResponse.json({ error: 'Database unavailable, please retry' }, { status: 503 })
  }
  if (!user || !(await verifyPassword(password, user.password))) {
    recordFailure(username)
    recordFailure(`${ip}:${username}`)
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  clearKey(username)
  clearKey(`${ip}:${username}`)

  const token = signToken({ userId: user.id, username: user.username, isAdmin: user.isAdmin, role: user.role })
  const cookieStore = await cookies()
  cookieStore.set('session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })

  await logAudit('login', 'user', user.id, user.id, `User "${user.username}" logged in`)

  return NextResponse.json({ success: true, username: user.username, isAdmin: user.isAdmin, role: user.role })
}
