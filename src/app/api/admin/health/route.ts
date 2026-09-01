import { NextResponse } from 'next/server'
import fs from 'fs'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

function getModel(type: string): any {
  switch (type) {
    case 'images': return prisma.image
    case 'videos': return prisma.video
    case 'news': return prisma.news
    case 'audio': return prisma.audio
    default: return null
  }
}

interface TypeHealth {
  type: string
  total: number
  withLocal: number
  withUrlOnly: number
  noMediaCount: number
  missingLocalCount: number
  missingLocal: { id: number; localPath: string }[]
  noMedia: { id: number }[]
}

export async function GET() {
  try {
    await requireRole('admin', 'editor', 'viewer')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const types = ['images', 'videos', 'news', 'audio']
  const results: TypeHealth[] = []

  for (const type of types) {
    const model = getModel(type)
    const rows = await model.findMany({
      select: { id: true, localPath: true, url: true },
      orderBy: { id: 'desc' },
      take: 1000,
    })

    let withLocal = 0
    let withUrlOnly = 0
    const missingLocal: any[] = []
    const noMedia: any[] = []

    for (const row of rows) {
      if (row.localPath) {
        withLocal++
        if (!fs.existsSync(row.localPath)) {
          missingLocal.push({ id: row.id, localPath: row.localPath })
        }
      } else if (row.url) {
        withUrlOnly++
      } else {
        noMedia.push({ id: row.id })
      }
    }

    results.push({
      type,
      total: rows.length,
      withLocal,
      withUrlOnly,
      noMediaCount: noMedia.length,
      missingLocalCount: missingLocal.length,
      missingLocal,
      noMedia,
    })
  }

  // Storage usage for local media
  let localFileSize = 0
  let localFileCount = 0
  const publicDir = process.env.PUBLIC_DIR || '/home/hollali/Projects/portal/public'
  const walk = (dir: string) => {
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        walk(full)
      } else {
        try {
          const stat = fs.statSync(full)
          localFileSize += stat.size
          localFileCount++
        } catch {}
      }
    }
  }
  walk(publicDir)

  // Database record counts
  const [imageCount, videoCount, newsCount, audioCount, userCount, auditCount] = await Promise.all([
    prisma.image.count(),
    prisma.video.count(),
    prisma.news.count(),
    prisma.audio.count(),
    prisma.user.count(),
    prisma.auditLog.count(),
  ])

  const dbStats = {
    images: imageCount,
    videos: videoCount,
    news: newsCount,
    audio: audioCount,
    users: userCount,
    auditLogs: auditCount,
    total: imageCount + videoCount + newsCount + audioCount,
  }

  // Overall problems
  const totalIssues = results.reduce((acc, r) => acc + r.missingLocalCount + r.noMediaCount, 0)

  return NextResponse.json({
    types: results,
    storage: {
      localFileCount,
      localFileSize,
      localFileSizeFormatted: formatBytes(localFileSize),
      publicDir,
    },
    dbStats,
    totalIssues,
    generatedAt: new Date().toISOString(),
  })
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}
