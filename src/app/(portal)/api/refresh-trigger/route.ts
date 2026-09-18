import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

const status = { running: false, lastRun: null as string | null, lastError: null as string | null, output: '' }

export async function GET() {
  try {
    await requireRole('admin', 'editor', 'viewer')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(status)
}

export async function POST() {
  try {
    await requireRole('admin')
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'Unauthorized' }, { status: 401 })
  }
  if (status.running) return NextResponse.json({ status: 'already_running' })
  status.running = true
  status.lastError = null
  status.output = ''
  return NextResponse.json({ status: 'started' })
}