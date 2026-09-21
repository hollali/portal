import fs from 'fs'
import path from 'path'
import { MEDIA_ROOT, localToMediaUrl } from '@/lib/media'

const UPLOAD_ROOT = MEDIA_ROOT

const MAX_FILE_BYTES = 200 * 1024 * 1024

const ALLOWED_EXT: Record<string, string[]> = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif', '.heic'],
  videos: ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv'],
  news: ['.txt', '.md', '.pdf'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
  documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.ppt', '.pptx'],
}

function sanitizeName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_')
  return base || 'file'
}

export async function saveUploadedFile(file: File, type: string): Promise<{ localPath: string; url: string }> {
  const ext = path.extname(file.name).toLowerCase()
  const allowed = ALLOWED_EXT[type] || ALLOWED_EXT.images
  if (!allowed.includes(ext)) {
    throw new Error(`Unsupported file type: ${ext || '(none)'} for ${type}`)
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File too large (max ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB)`)
  }

  const dir = path.join(UPLOAD_ROOT, type)
  fs.mkdirSync(dir, { recursive: true })

  const base = sanitizeName(path.basename(file.name, ext))
  const stamp = Date.now()
  const filename = `${base}-${stamp}${ext}`
  const localPath = path.join(UPLOAD_ROOT, type, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(localPath, buffer)

  const url = localToMediaUrl(localPath) || `/api/media/${type}/${filename}`
  return { localPath, url }
}