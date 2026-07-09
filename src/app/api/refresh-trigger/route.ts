import { NextResponse } from 'next/server'

const status = { running: false, lastRun: null as string | null, lastError: null as string | null, output: '' }

export async function GET() {
  return NextResponse.json(status)
}

export async function POST() {
  if (status.running) return NextResponse.json({ status: 'already_running' })
  status.running = true
  status.lastError = null
  status.output = ''
  return NextResponse.json({ status: 'started' })
}
