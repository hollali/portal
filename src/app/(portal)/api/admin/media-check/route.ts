import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import { prisma } from '@/lib/prisma'
import { requireRole, type Session } from '@/lib/auth'
import { createNotification } from '@/lib/notify'

interface MediaRow {
  id: number
  localPath: string | null
  url: string | null
}

interface MediaModel {
  findMany: (args: { select: { id: true; localPath: true; url: true }; orderBy: { id: 'desc' }; take: number }) => Promise<MediaRow[]>
}

function getModel(type: string): MediaModel | null {
  switch (type) {
    case 'images': return prisma.image
    case 'videos': return prisma.video
    case 'news': return prisma.news
    case 'audio': return prisma.audio
    default: return null
  }
}

export async function GET(request: NextRequest) {
  let session: Session
  try {
    session = await requireRole('admin', 'editor', 'viewer')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'images'
  const model = getModel(type)
  if (!model) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })

  const rows = await model.findMany({
    select: { id: true, localPath: true, url: true },
    orderBy: { id: 'desc' },
    take: 1000,
  })

  const missingLocal: { id: number; localPath: string }[] = []
  const noMedia: { id: number }[] = []
  let withLocal = 0

  for (const row of rows) {
    if (row.localPath) {
      withLocal++
      try {
        if (!fs.existsSync(row.localPath)) {
          missingLocal.push({ id: row.id, localPath: row.localPath })
        }
      } catch {
        missingLocal.push({ id: row.id, localPath: row.localPath })
      }
    }
    if (!row.localPath && !row.url) {
      noMedia.push({ id: row.id })
    }
  }

  if (missingLocal.length > 0) {
    await createNotification('warning', `${missingLocal.length} ${type} record(s) reference missing local files.`, session?.userId)
  }
  if (noMedia.length > 0) {
    await createNotification('warning', `${noMedia.length} ${type} record(s) have no media source at all.`, session?.userId)
  }

  return NextResponse.json({
    type,
    total: rows.length,
    withLocal,
    missingLocalCount: missingLocal.length,
    noMediaCount: noMedia.length,
    missingLocal,
    noMedia,
  })
}
