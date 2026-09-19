import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? '' : `dev-${crypto.randomUUID()}`)

if (!JWT_SECRET) {
  console.error('JWT_SECRET must be set in production (e.g. netlify env var)')
}

function secret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured; set JWT_SECRET env var (production)')
  }
  return JWT_SECRET
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export type Role = 'admin' | 'editor' | 'viewer'

export interface Session {
  userId: number
  username: string
  isAdmin: boolean
  role: string
}

export function canAccessAdmin(role?: string): boolean {
  return role === 'admin' || role === 'editor' || role === 'viewer'
}

export function canManageMedia(role?: string): boolean {
  return role === 'admin' || role === 'editor'
}

export function canManageSystem(role?: string): boolean {
  return role === 'admin'
}

export function signToken(payload: Session): string {
  return jwt.sign(payload, secret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): Session | null {
  try {
    return jwt.verify(token, secret()) as Session
  } catch {
    return null
  }
}

export async function requireRole(...allowed: string[]): Promise<Session> {
  const session = await requireAuth()
  if (!session.role || !allowed.includes(session.role)) {
    throw new Error('Forbidden')
  }
  return session
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, username: true, isAdmin: true, role: true },
    })
    if (!user) return null
    return { userId: user.id, username: user.username, isAdmin: user.isAdmin, role: user.role }
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}