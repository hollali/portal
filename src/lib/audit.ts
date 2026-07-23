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

export async function getAuditLogs(entityType?: string, entityId?: number, limit = 50) {
  const conditions: string[] = []
  const params: any[] = []
  let idx = 1

  if (entityType) {
    conditions.push(`entity_type = $${idx++}`)
    params.push(entityType)
  }
  if (entityId) {
    conditions.push(`entity_id = $${idx++}`)
    params.push(entityId)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return prisma.$queryRawUnsafe(
    `SELECT id, action, entity_type as "entityType", entity_id as "entityId",
            user_id as "userId", details, created_at as "createdAt"
     FROM audit_logs ${where}
     ORDER BY created_at DESC
     LIMIT $${idx}`,
    ...params,
    limit
  )
}
