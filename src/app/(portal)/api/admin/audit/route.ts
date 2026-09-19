import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getAuditLogs } from '@/lib/audit'

export async function GET(request: NextRequest) {
  try {
    await requireRole('admin', 'editor')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entityType') || undefined
  const entityId = searchParams.get('entityId') ? parseInt(searchParams.get('entityId')!) : undefined
  const action = searchParams.get('action') || undefined
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

  const result = await getAuditLogs({ entityType, entityId, action, page, limit })
  return NextResponse.json(result)
}
