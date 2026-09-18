import fs from 'fs'
import { localToMediaUrl } from '@/lib/media'

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