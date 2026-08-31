import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getAuditLogs } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entityType') || undefined
  const entityId = searchParams.get('entityId') ? parseInt(searchParams.get('entityId')!) : undefined
  const limit = parseInt(searchParams.get('limit') || '50')

  const logs = await getAuditLogs(entityType, entityId, limit)
  return NextResponse.json({ logs })
}
