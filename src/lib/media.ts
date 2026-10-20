export const MEDIA_ROOT =
  process.env.MEDIA_ROOT || '/home/hollali/Projects/WebScrapper/osint_bagbin_enhanced'

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

/** The eleven-character video id, wherever YouTube put it in the address. */
export function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/)
  return match ? match[1] : null
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = getYouTubeId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}

/**
 * The privacy-preserving player. Used inside /ask because an embedded video
 * should not set YouTube's advertising cookies before the reader presses play.
 */
export function getYouTubeNoCookieEmbedUrl(url: string): string | null {
  const id = getYouTubeId(url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null
}

export function getYouTubeThumbUrl(url: string): string | null {
  const id = getYouTubeId(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}
