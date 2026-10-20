import fs from 'fs'
import path from 'path'
import { MEDIA_ROOT } from '@/lib/media'

const PUBLIC_ROOT = path.join(process.cwd(), 'public')

/** Is `target` the same as, or contained by, `root`? Separator-safe. */
export function isPathInside(root: string, target: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(target))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/**
 * Resolve untrusted path segments under a fixed root.
 *
 * Returns null when the result escapes the root (including sibling directories
 * that merely share a name prefix) or when an in-root symlink resolves outside
 * it. Callers should treat null as forbidden.
 */
export function resolveWithin(root: string, segments: string[]): string | null {
  if (segments.some(segment => segment.includes('\0'))) return null
  const resolved = path.resolve(root, ...segments)
  if (!isPathInside(root, resolved)) return null

  try {
    const realRoot = fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root)
    if (fs.existsSync(resolved)) {
      if (!isPathInside(realRoot, fs.realpathSync(resolved))) return null
    }
  } catch {
    return null
  }

  return resolved
}

export function resolveStoredFile(stored: string | null | undefined): string | null {
  if (!stored) return null

  let abs: string | null
  if (stored.startsWith('/api/media/')) {
    const rel = stored.slice('/api/media/'.length).replace(/^\/+/, '').split('/').filter(Boolean)
    abs = resolveWithin(MEDIA_ROOT, rel)
  } else if (stored.startsWith('/media/')) {
    const rel = stored.slice('/media/'.length).replace(/^\/+/, '').split('/').filter(Boolean)
    abs = resolveWithin(PUBLIC_ROOT, rel)
  } else if (stored.startsWith(MEDIA_ROOT)) {
    abs = resolveWithin(MEDIA_ROOT, [stored])
  } else {
    return null
  }

  if (!abs) return null

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