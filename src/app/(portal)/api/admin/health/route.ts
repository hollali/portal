import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'

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

const MAX_WALKED_FILES = 20_000

async function walkMediaFiles(): Promise<{ localFileSize: number; localFileCount: number }> {
  const root = path.join(process.cwd(), 'public', 'media')
  let localFileCount = 0
  let localFileSize = 0
  const visited = new Set<string>()

  const walk = async (dir: string): Promise<void> => {
    if (localFileCount >= MAX_WALKED_FILES) return
    let entries: fs.Dirent[]
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (localFileCount >= MAX_WALKED_FILES) return
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        let realPath: string
        try {
          realPath = await fs.promises.realpath(full)
        } catch {
          continue
        }
        if (visited.has(realPath)) continue
        visited.add(realPath)
        await walk(full)
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(full)
          localFileSize += stat.size
          localFileCount++
        } catch {}
      }
    }
  }

  await walk(root)
  return { localFileSize, localFileCount }
}

export async function GET() {
  try {
    await requireRole('admin', 'editor')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const types = ['images', 'videos', 'news', 'audio']
  const results: TypeHealth[] = []

  for (const type of types) {
    const model = getModel(type)
    if (!model) continue
    const rows = await model.findMany({
      select: { id: true, localPath: true, url: true },
      orderBy: { id: 'desc' },
      take: 1000,
    })

    let withLocal = 0
    let withUrlOnly = 0
    const missingLocal: { id: number; localPath: string }[] = []
    const noMedia: { id: number }[] = []

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

  const { localFileSize, localFileCount } = await walkMediaFiles()

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
      publicDir: path.join(process.cwd(), 'public'),
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