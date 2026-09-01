import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function POST() {
  const session = await getSession()
  if (session) {
    await logAudit('logout', 'user', session.userId, session.userId, `User "${session.username}" logged out`)
  }
  const cookieStore = await cookies()
  cookieStore.delete('session')
  return NextResponse.json({ success: true })
}
