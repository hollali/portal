import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * What the route tells a reader when it shows no cards.
 *
 * Both sentences begin the same way to the reader — a summary and no results —
 * and only one of them is true. A record can mention a word of the question and
 * still be dropped for not answering it, and an archive that answers "nothing was
 * ever published on this" to a question it plainly holds records for is an
 * archive nobody believes. These assertions are on the sentence, because the
 * sentence is the claim.
 */

const searchArchive = vi.fn()
const getLibraryCounts = vi.fn()

vi.mock('@/lib/askSearch', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/askSearch')>()
  return { ...actual, searchArchive: (...args: unknown[]) => searchArchive(...args) }
})

vi.mock('@/lib/libraryQueries', () => ({
  getLibraryCounts: () => getLibraryCounts(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { POST } from '@/app/(public)/api/ask/route'

const ask = async (question: string) => {
  const response = await POST(
    new Request('https://example.test/api/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question }),
    }) as never,
  )
  return response.json()
}

const noResults = (over: { totalMatched?: number; broaderMatched?: number } = {}) => {
  searchArchive.mockResolvedValue({
    mode: 'none',
    terms: ['quantum', 'computing'],
    results: [],
    collectionCounts: [],
    totalMatched: over.totalMatched ?? 0,
    broaderMatched: over.broaderMatched,
  })
}

describe('POST /api/ask, with nothing to show', () => {
  beforeEach(() => {
    searchArchive.mockReset()
    getLibraryCounts.mockReset()
    getLibraryCounts.mockResolvedValue({ total: 0, speeches: 0, papers: 0 })
  })

  it('says the archive holds nothing when nothing mentions the question', async () => {
    noResults()
    const body = await ask('quantum computing policy')
    expect(body.summary).toContain('Nothing published in the archive mentions')
    expect(body.citations).toEqual([])
  })

  it('admits what was found when records matched a word but none answered', async () => {
    // The relevance floor dropped every one of these: they mention a word of the
    // question and are not about it. "Nothing published" would be a lie about
    // 12 records the archive is holding.
    noResults({ totalMatched: 0, broaderMatched: 12 })
    const body = await ask('quantum computing policy')
    expect(body.summary).toContain('in 12 records')
    expect(body.summary).toContain('none of them answers the question as asked')
    expect(body.summary).not.toContain('Nothing published in the archive')
    expect(body.citations).toEqual([])
  })

  it('uses the singular for one record rather than "1 records"', async () => {
    noResults({ broaderMatched: 1 })
    const body = await ask('quantum computing policy')
    expect(body.summary).toContain('in 1 record,')
    expect(body.summary).not.toContain('1 records')
  })

  it('counts what the archive holds even when nothing matched every term', async () => {
    // `broaderMatched` is the claim being made, so it wins over the narrower
    // count of records that matched all of them.
    noResults({ totalMatched: 2, broaderMatched: 30 })
    const body = await ask('quantum computing policy')
    expect(body.summary).toContain('in 30 records')
  })
})

describe('POST /api/ask, with a window of years', () => {
  beforeEach(() => {
    searchArchive.mockReset()
    getLibraryCounts.mockReset()
    getLibraryCounts.mockResolvedValue({ total: 0, speeches: 0, papers: 0 })
  })

  it('passes the window it read from the question to the search', async () => {
    searchArchive.mockResolvedValue({
      mode: 'all',
      terms: [],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
      undated: ['Videos', 'Audio'],
    })
    const body = await ask('What happened in 2026?')
    expect(searchArchive.mock.calls[0][2]).toEqual({ from: 2026, to: 2026, label: '2026' })
    expect(body.period).toEqual({ from: 2026, to: 2026, label: '2026' })
    expect(body.undated).toEqual(['Videos', 'Audio'])
  })

  it('does not search for the year as a word', async () => {
    // The question is "what happened in 2026?" — searching for "2026" as a term
    // answers a question nobody asked.
    searchArchive.mockResolvedValue({
      mode: 'all',
      terms: [],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
    })
    const body = await ask('What happened in 2026?')
    expect(searchArchive.mock.calls[0][0]).toEqual([])
    expect(body.terms).toEqual([])
  })

  it('does not turn a window into a request for a subject', async () => {
    // The terms-length check used to fire first and answered "ask me about a
    // speech, a letter, a theme" to a question that had already named a year.
    searchArchive.mockResolvedValue({
      mode: 'all',
      terms: [],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
    })
    const body = await ask('What happened in 2026?')
    expect(body.summary).not.toMatch(/ask me about/i)
  })

  it('says nothing was published in that window, not in the archive', async () => {
    searchArchive.mockResolvedValue({
      mode: 'any',
      terms: [],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
    })
    const body = await ask('What did he say in 1994?')
    expect(body.summary).toContain('No record in the archive is dated 1994')
    expect(body.summary).not.toMatch(/Nothing published in the archive mentions that/)
  })

  it('admits the filter when the subject was missed inside the window', async () => {
    // "Nothing about the economy since 2020" and "nothing since 2020" are
    // different claims, and 148 records are dated since 2020.
    searchArchive.mockResolvedValue({
      mode: 'any',
      terms: ['economy'],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
    })
    const body = await ask('What did he say about the economy since 2020?')
    expect(body.summary).toContain('mentions “economy”')
    expect(body.summary).toContain('restricted to records dated 2020 or later')
    expect(body.summary).not.toContain('No record in the archive')
  })

  it('names the window and the undated collections when it shows cards', async () => {
    searchArchive.mockResolvedValue({
      mode: 'all',
      terms: [],
      results: [
        {
          candidate: {
            collection: 'news',
            collectionLabel: 'News clippings',
            kind: 'news',
            kindLabel: 'News clipping',
            title: 'Speaker Endorses UBIDS Bid',
            href: '/news/12',
            year: 2026,
            excerpt: 'The Speaker urged the university to sustain the programme.',
            body: '',
            hasTranscript: false,
            url: 'https://example.test/paper/story',
            sourceName: 'Example Daily',
            fields: [{ weight: 3, text: 'Speaker Endorses UBIDS Bid' }],
            matchTotal: 1,
            completeTotal: 1,
          },
          matched: new Set<string>(),
        },
      ],
      collectionCounts: [{ collection: 'news', label: 'News clippings', count: 119 }],
      totalMatched: 119,
      undated: ['Videos', 'Audio'],
    })
    const body = await ask('What happened in 2026?')
    expect(body.summary).toContain('Everything below was dated 2026')
    expect(body.summary).toContain('Videos and Audio carry no date')
    expect(body.period).toEqual({ from: 2026, to: 2026, label: '2026' })
  })
})

describe('POST /api/ask, with a collection named in the question', () => {
  beforeEach(() => {
    searchArchive.mockReset()
    getLibraryCounts.mockReset()
    getLibraryCounts.mockResolvedValue({ total: 0, speeches: 0, papers: 0 })
  })

  const oneResult = (over: Record<string, unknown> = {}) => ({
    mode: 'all',
    terms: [],
    results: [
      {
        candidate: {
          collection: 'milestones',
          collectionLabel: 'Milestones',
          kind: 'milestone',
          kindLabel: 'Milestone',
          title: 'Addresses the nation on the economy',
          href: '/timeline/3',
          year: 1994,
          excerpt: 'He described the state of the economy.',
          body: '',
          hasTranscript: false,
          fields: [{ weight: 3, text: 'Addresses the nation on the economy' }],
          matchTotal: 1,
          completeTotal: 1,
          ...over,
        },
        matched: new Set<string>(),
      },
    ],
    collectionCounts: [{ collection: 'milestones', label: 'Milestones', count: 41 }],
    totalMatched: 1,
  })

  it('searches the collection it names and drops the word from the search', async () => {
    // The bug: "milestones" stayed in the terms, so every record returned had to
    // contain the word "milestones" — and the answer was empty.
    searchArchive.mockResolvedValue(oneResult())
    const body = await ask('What are the milestones from the 1990s?')
    expect(searchArchive.mock.calls[0][0]).toEqual([])
    expect(searchArchive.mock.calls[0][3]).toEqual(['milestones'])
    expect(body.collections).toEqual(['milestones'])
    expect(body.terms).toEqual([])
  })

  it('searches the milestones and the window, not the word', async () => {
    searchArchive.mockResolvedValue(oneResult())
    await ask('What are the milestones from the 1990s?')
    expect(searchArchive.mock.calls[0][0]).toEqual([])
    expect(searchArchive.mock.calls[0][2]).toEqual({ from: 1990, to: 1999, label: 'the 1990s' })
  })

  it('keeps the other words of the question as the search', async () => {
    searchArchive.mockResolvedValue(oneResult())
    await ask('What are the milestones about poverty?')
    expect(searchArchive.mock.calls[0][0]).toEqual(['poverty'])
    expect(searchArchive.mock.calls[0][3]).toEqual(['milestones'])
  })

  it('does not report the collection name as an uncovered word', async () => {
    // The word was used as a filter, so it was covered by being applied — listing
    // it as uncovered would tell the reader the archive could not satisfy a word
    // they never asked it to search for.
    searchArchive.mockResolvedValue(oneResult())
    const body = await ask('What are the milestones from the 1990s?')
    expect(body.unmatched).toEqual([])
    expect(body.matchedTerms).toEqual([])
  })

  it('names the restriction in the summary, outside the persona sentence', async () => {
    searchArchive.mockResolvedValue(oneResult())
    const body = await ask('What are the milestones?')
    expect(body.summary).toContain('Restricted to Milestones.')
  })

  it('names two collections when the question does', async () => {
    searchArchive.mockResolvedValue(oneResult())
    const body = await ask('Any videos or photographs of the inauguration?')
    // Photographs cannot answer questions, so they come out of the search — and
    // the reader is told where to find them instead, in the reader's own plural.
    expect(searchArchive.mock.calls[0][3]).toEqual(['videos'])
    expect(body.collections).toEqual(['videos'])
    expect(body.unsearchable).toEqual(['photos'])
    expect(body.summary).toContain('Photographs are held but not searched')
    expect(body.summary).toContain('/archives/photos')
  })

  it('refuses the photograph library with a reason and a place to look', async () => {
    // Every photograph is uncaptioned and undated, so there is nothing to answer
    // from; "no published records" would read as though the library were empty.
    const body = await ask('Show me any photographs of him')
    expect(body.summary).toContain('I cannot answer from the photographs')
    expect(body.summary).toContain('/archives/photos')
    expect(body.summary).not.toMatch(/ask me about/i)
    expect(body.citations).toEqual([])
  })

  it('still searches the other collections when a photograph is named alongside a subject', async () => {
    searchArchive.mockResolvedValue(oneResult())
    const body = await ask('Photographs of the swearing-in')
    expect(searchArchive.mock.calls[0][0]).toEqual(['swearing'])
    expect(body.unsearchable).toEqual(['photos'])
  })

  it('does not claim the archive is empty when a named collection holds nothing', async () => {
    searchArchive.mockResolvedValue({
      mode: 'none',
      terms: [],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
    })
    const body = await ask('Any testimonials?')
    expect(body.summary).toContain('Restricted to Testimonials')
    expect(body.summary).toContain('holds no published records')
    expect(body.summary).not.toContain('Nothing published in the archive mentions')
    expect(body.collections).toEqual(['testimonials'])
  })

  it('names the collection in a refusal about a subject, not just in a card answer', async () => {
    searchArchive.mockResolvedValue({
      mode: 'any',
      terms: ['photosynthesis'],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
      broaderMatched: 3,
    })
    const body = await ask('What did he say about photosynthesis in the news?')
    expect(body.summary).toContain('Restricted to News.')
    expect(body.summary).toContain('mentions “photosynthesis”')
  })

  it('names the restriction in a plain refusal about a subject', async () => {
    // "Nothing published in the archive mentions X" is a claim about the whole
    // archive; under a collection filter it is a claim about one page of it, and
    // the sentence has to say which.
    searchArchive.mockResolvedValue({
      mode: 'any',
      terms: ['humility'],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
    })
    const body = await ask('What are the testimonials about his humility?')
    expect(body.summary).toContain('Restricted to Testimonials.')
    expect(body.summary).toContain('Nothing published in the archive mentions “humility”')
  })

  it('carries both restrictions when a question named a collection and a window', async () => {
    searchArchive.mockResolvedValue({
      mode: 'any',
      terms: ['economy'],
      results: [],
      collectionCounts: [],
      totalMatched: 0,
    })
    const body = await ask('What did he say about the economy since 2020 in the news?')
    expect(body.summary).toContain('restricted to records dated 2020 or later')
    expect(body.summary).toContain('Restricted to News.')
  })

  it('does not claim the cards are the strongest when nothing was ranked', async () => {
    // "The 2 strongest shown" is a claim about a ranking. A question that named only
    // a collection has nothing to rank by — the records are in the order the
    // collection holds them — so the sentence must not invent a judgement.
    searchArchive.mockResolvedValue({
      mode: 'all',
      terms: [],
      results: [oneResult().results[0]],
      collectionCounts: [{ collection: 'milestones', label: 'Milestones', count: 4 }],
      totalMatched: 4,
    })
    const body = await ask('Any milestones?')
    expect(body.summary).toContain('4 records matched in milestones, the first 1 in the collection shown')
    expect(body.summary).not.toContain('strongest')
  })

  it('calls a window listing the earliest records rather than the strongest', async () => {
    searchArchive.mockResolvedValue({
      mode: 'all',
      terms: [],
      results: [oneResult().results[0]],
      collectionCounts: [{ collection: 'milestones', label: 'Milestones', count: 4 }],
      totalMatched: 4,
      undated: [],
    })
    const body = await ask('What happened in the 1990s?')
    expect(body.summary).toContain('the earliest 1 shown')
    expect(body.summary).not.toContain('strongest')
  })

  it('says a collection-only question is a listing, not a missing subject', async () => {
    searchArchive.mockResolvedValue(oneResult())
    const body = await ask('Any videos?')
    expect(body.summary).not.toMatch(/ask me about/i)
    expect(searchArchive.mock.calls[0][0]).toEqual([])
    expect(searchArchive.mock.calls[0][3]).toEqual(['videos'])
  })
})
