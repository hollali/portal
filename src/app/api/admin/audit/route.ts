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
  const action = searchParams.get('action') || undefined
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : undefined
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

  const result = await getAuditLogs({ entityType, entityId, action, page, limit })
  return NextResponse.json(result)
}
