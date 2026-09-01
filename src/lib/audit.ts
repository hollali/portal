import { prisma } from '@/lib/prisma'

export async function logAudit(action: string, entityType: string, entityId: number, userId?: number, details?: string) {
  try {
    await prisma.$executeRawUnsafe(
      'INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details) VALUES ($1, $2, $3, $4, $5)',
      action, entityType, entityId, userId ?? null, details ?? null
    )
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}

export interface AuditQuery {
  entityType?: string
  entityId?: number
  action?: string
  page?: number
  limit?: number
}

export async function getAuditLogs(query: AuditQuery = {}) {
  const { entityType, entityId, action } = query
  const page = Math.max(1, query.page || 1)
  const limit = Math.min(200, Math.max(1, query.limit || 50))

  const conditions: string[] = []
  const params: (string | number | boolean | null)[] = []
  let idx = 1

  if (entityType) {
    conditions.push(`a.entity_type = $${idx++}`)
    params.push(entityType)
  }
  if (entityId) {
    conditions.push(`a.entity_id = $${idx++}`)
    params.push(entityId)
  }
  if (action) {
    conditions.push(`a.action = $${idx++}`)
    params.push(action)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (page - 1) * limit

  const rows = await prisma.$queryRawUnsafe(
    `SELECT a.id, a.action, a.entity_type as "entityType", a.entity_id as "entityId",
            a.user_id as "userId", u.username, a.details, a.created_at as "createdAt"
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    ...params,
    limit,
    offset
  )

  const totalRows = await prisma.$queryRawUnsafe<{ c: string }[]>(
    `SELECT count(*)::int as c FROM audit_logs a ${where}`,
    ...params
  )
  const total = Number(totalRows[0]?.c || 0)

  return { logs: rows, total, page, perPage: limit }
}
