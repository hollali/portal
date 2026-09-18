import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyPassword, signToken } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST(request: Request) {
  let username = ''
  let password = ''
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
