import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

export async function GET() {
  try {
    await requireRole('admin', 'editor', 'viewer')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ status: 'ok' })
}