const MEDIA_ROOT = '/home/hollali/Projects/WebScrapper/osint_bagbin_enhanced'

export function localToMediaUrl(localPath: string | null | undefined): string | null {
  if (!localPath) return null
  if (localPath.startsWith(MEDIA_ROOT)) {
    const rel = localPath.slice(MEDIA_ROOT.length).replace(/^\//, '')
    return `/api/media/${rel}`
  }
  return null
}

export function getMediaUrl(item: { localPath?: string | null; url?: string | null }): string | null {
  const local = localToMediaUrl(item.localPath)
  if (local) return local
  return item.url || null
}

export function isYouTubeUrl(url: string): boolean {
  return /(youtube\.com|youtu\.be)/i.test(url)
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}
