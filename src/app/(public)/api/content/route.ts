import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const raw = await prisma.contentSection.findMany({
    where: { status: 'published' },
    orderBy: { key: 'asc' },
  })

  const sections: Record<string, { id: number; title: string | null; body: string | null; data: unknown; updatedAt: Date }> = {}
  for (const s of raw) {
    let data: unknown = null
    if (s.data) {
      try {
        data = JSON.parse(s.data)
      } catch {
        data = null
      }
    }
    sections[s.key] = { id: s.id, title: s.title, body: s.body, data, updatedAt: s.updatedAt }
  }

  return NextResponse.json({ sections })
}