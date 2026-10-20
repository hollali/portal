import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { isPathInside, resolveWithin } from '@/lib/mediaFiles'

const roots: string[] = []

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-media-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('isPathInside', () => {
  it('accepts the root itself and children', () => {
    expect(isPathInside('/srv/media', '/srv/media')).toBe(true)
    expect(isPathInside('/srv/media', '/srv/media/audio/a.mp3')).toBe(true)
  })

  it('rejects siblings that merely share a prefix', () => {
    expect(isPathInside('/srv/media', '/srv/media-private/secret.txt')).toBe(false)
  })
})

describe('resolveWithin', () => {
  it('resolves a normal child path', () => {
    const root = tempRoot()
    expect(resolveWithin(root, ['audio', 'a.mp3'])).toBe(path.join(root, 'audio', 'a.mp3'))
  })

  it('rejects traversal and sibling-prefix escapes', () => {
    const root = tempRoot()
    const sibling = `${root}-secret`
    fs.mkdirSync(sibling)
    fs.writeFileSync(path.join(sibling, 'secret.txt'), 'secret')

    expect(resolveWithin(root, ['..', path.basename(sibling), 'secret.txt'])).toBeNull()
    expect(resolveWithin(root, ['..', 'escape.txt'])).toBeNull()
  })

  it('rejects null bytes', () => {
    expect(resolveWithin(tempRoot(), ['audio\0.mp3'])).toBeNull()
  })

  it('rejects a symlink that points outside the root', () => {
    const root = tempRoot()
    const outside = tempRoot()
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret')
    fs.symlinkSync(outside, path.join(root, 'link'))

    expect(resolveWithin(root, ['link', 'secret.txt'])).toBeNull()
  })
})
