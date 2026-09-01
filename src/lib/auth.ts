import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): Session | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Session
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
  return verifyToken(token)
}

export async function requireAuth(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}
