import { describe, expect, it, vi, beforeEach } from 'vitest'
import { knowledgeProfile } from './fixtures/knowledgeProfile'

const searchArchive = vi.fn()
const loadKnowledgeProfile = vi.fn()
const getLibraryCounts = vi.fn()

vi.mock('@/lib/askProfile', () => ({
  loadKnowledgeProfile: () => loadKnowledgeProfile(),
}))

vi.mock('@/lib/askSearch', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/askSearch')>()
  return { ...actual, searchArchive: (...args: unknown[]) => searchArchive(...args) }
})

vi.mock('@/lib/libraryQueries', () => ({
  getLibraryCounts: () => getLibraryCounts(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { GET, POST } from '@/app/(public)/api/ask/route'

const ask = async (question: string) =>
  (
    await POST(
      new Request('https://example.test/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
      }) as never,
    )
  ).json()

beforeEach(() => {
  searchArchive.mockReset()
  loadKnowledgeProfile.mockReset()
  getLibraryCounts.mockReset()
  getLibraryCounts.mockResolvedValue({ total: 0, speeches: 0, papers: 0 })
  loadKnowledgeProfile.mockResolvedValue(knowledgeProfile)
})

describe('POST /api/ask, person knowledge from the database', () => {
  it('answers an identity question from the profile instead of searching', async () => {
    const body = await ask('Who is he?')
    expect(body.match).toBe('all')
    expect(body.conversation.kind).toBe('profile')
    expect(body.summary).toContain('Alban Bagbin')
    expect(body.citations.map((c: { href: string }) => c.href)).toContain('/the-man')
    expect(searchArchive).not.toHaveBeenCalled()
  })

  it('answers a birth question from the biography rows', async () => {
    const body = await ask('Where was he born?')
    expect(body.conversation.kind).toBe('profile')
    expect(body.summary).toContain('24 September 1957')
    expect(body.summary).toContain('Sombo')
    expect(searchArchive).not.toHaveBeenCalled()
  })

  it('still sends what-he-said questions to the archive', async () => {
    searchArchive.mockResolvedValue({
      mode: 'none',
      terms: ['education'],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
    })
    const body = await ask('What did he say about education?')
    expect(searchArchive).toHaveBeenCalled()
    expect(body.conversation?.kind).not.toBe('profile')
    expect(loadKnowledgeProfile).not.toHaveBeenCalled()
  })

  it('falls back to the archive if the database profile cannot be loaded', async () => {
    loadKnowledgeProfile.mockRejectedValue(new Error('database unavailable'))
    searchArchive.mockResolvedValue({
      mode: 'none',
      terms: ['education'],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
    })
    const body = await ask('Tell me about his education')
    expect(searchArchive).toHaveBeenCalled()
    expect(body.conversation?.kind).not.toBe('profile')
  })
})

describe('GET /api/ask', () => {
  it('opens with life questions rather than archive searches', async () => {
    const body = await (await GET()).json()
    expect(body.suggested[0]).toContain('Who is Alban Bagbin')
    expect(body.suggested.some((question: string) => /Where was he born/.test(question))).toBe(true)
  })
})
