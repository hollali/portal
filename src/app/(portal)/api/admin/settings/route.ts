import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole, type Session } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function GET() {
  try {
    await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } })
  const obj: Record<string, string> = {}
  for (const s of settings) obj[s.key] = s.value
  return NextResponse.json({ settings: obj })
}

export async function POST(request: Request) {
  let session: Session
  try {
    session = await requireRole('admin')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !body.settings || typeof body.settings !== 'object') {
    return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })
  }

  for (const [key, value] of Object.entries(body.settings)) {
    const stringValue = String(value)
    await prisma.setting.upsert({
      where: { key },
      update: { value: stringValue },
      create: { key, value: stringValue },
    })
  }

  await logAudit('edit', 'setting', 0, session.userId, `Updated ${Object.keys(body.settings).length} settings`)

  const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } })
  const obj: Record<string, string> = {}
  for (const s of settings) obj[s.key] = s.value
  return NextResponse.json({ success: true, settings: obj })
}
