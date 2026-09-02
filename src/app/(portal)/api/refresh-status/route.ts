import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'

export async function GET() {
  await requireRole('admin', 'editor', 'viewer')
  return NextResponse.json({ status: 'ok' })
}