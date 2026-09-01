import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({})
  return NextResponse.json({ userId: session.userId, username: session.username, isAdmin: session.isAdmin, role: session.role })
}
