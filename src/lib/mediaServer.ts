import fs from 'fs'
import { isYouTubeUrl, localToMediaUrl } from '@/lib/media'

export function localMediaExists(localPath: string | null | undefined): boolean {
  if (!localPath) return false
  try {
    return fs.existsSync(localPath) && fs.statSync(localPath).isFile()
  } catch {
    return false
  }
}

export function resolveMediaSrc(item: { localPath?: string | null; url?: string | null }): string | null {
  if (item.localPath && localMediaExists(item.localPath)) {
    const local = localToMediaUrl(item.localPath)
    if (local) return local
  }
  return item.url || null
}

const VIDEO_FILE = /\.(?:mp4|m4v|webm|ogv|ogg|mov)$/i
const AUDIO_FILE = /\.(?:mp3|m4a|aac|wav|oga|ogg|opus|flac)$/i

/**
 * A source a browser can actually play, rather than the page that contains it.
 *
 * Most video rows point at YouTube watch pages; handing those to a `<video>` tag
 * gives a broken player. A stored local file wins, because the archive owns it.
 * A remote address is only returned when its path looks like a media file.
 */
export function resolvePlayableMediaSrc(
  item: { localPath?: string | null; url?: string | null },
  kind: 'video' | 'audio',
): string | null {
  if (item.localPath && localMediaExists(item.localPath)) {
    const local = localToMediaUrl(item.localPath)
    if (local) return local
  }
  if (!item.url || isYouTubeUrl(item.url)) return null
  let parsed: URL
  try {
    parsed = new URL(item.url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  return (kind === 'video' ? VIDEO_FILE : AUDIO_FILE).test(parsed.pathname) ? item.url : null
}

/** A photographic source, local or remote, but never a non-http URL. */
export function resolveImageSrc(item: { localPath?: string | null; url?: string | null }): string | null {
  if (item.localPath && localMediaExists(item.localPath)) {
    const local = localToMediaUrl(item.localPath)
    if (local) return local
  }
  if (!item.url) return null
  try {
    const parsed = new URL(item.url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? item.url : null
  } catch {
    return null
  }
}
