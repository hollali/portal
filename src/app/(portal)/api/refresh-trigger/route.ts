import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

const status = { running: false, lastRun: null as string | null, lastError: null as string | null, output: '' }

export async function GET() {
  await requireRole('admin', 'editor', 'viewer')
  return NextResponse.json(status)
}

export async function POST() {
  await requireRole('admin')
  if (status.running) return NextResponse.json({ status: 'already_running' })
  status.running = true
  status.lastError = null
  status.output = ''
  return NextResponse.json({ status: 'started' })
}