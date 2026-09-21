import fs from 'fs'
import path from 'path'
import { MEDIA_ROOT } from '@/lib/media'

const PUBLIC_ROOT = path.join(process.cwd(), 'public')

export function resolveStoredFile(stored: string | null | undefined): string | null {
  if (!stored) return null

  let abs: string
  if (stored.startsWith('/api/media/')) {
    const rel = stored.slice('/api/media/'.length).replace(/^\/+/, '').split('/')
    abs = path.resolve(MEDIA_ROOT, ...rel)
    if (!abs.startsWith(MEDIA_ROOT)) return null
  } else if (stored.startsWith('/media/')) {
    const rel = stored.slice('/media/'.length).replace(/^\/+/, '').split('/')
    abs = path.resolve(PUBLIC_ROOT, ...rel)
    if (!abs.startsWith(PUBLIC_ROOT)) return null
  } else if (stored.startsWith(MEDIA_ROOT)) {
    abs = stored
  } else {
    return null
  }

  try {
    return fs.existsSync(abs) && fs.statSync(abs).isFile() ? abs : null
  } catch {
    return null
  }
}

export function deleteStoredFile(stored: string | null | undefined): boolean {
  const abs = resolveStoredFile(stored)
  if (!abs) return false
  try {
    fs.rmSync(abs)
    return true
  } catch {
    return false
  }
}