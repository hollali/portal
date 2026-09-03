import fs from 'fs'
import path from 'path'

const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'media')

const ALLOWED_EXT: Record<string, string[]> = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif'],
  videos: ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.ogv'],
  news: ['.html', '.htm', '.txt', '.md', '.pdf'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
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

  const dir = path.join(UPLOAD_ROOT, type)
  fs.mkdirSync(dir, { recursive: true })

  const base = sanitizeName(path.basename(file.name, ext))
  const stamp = Date.now()
  const filename = `${base}-${stamp}${ext}`
  const localPath = path.join(dir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(localPath, buffer)

  const url = `/media/${type}/${filename}`
  return { localPath, url }
}
