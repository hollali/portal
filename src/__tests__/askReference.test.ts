import { describe, expect, it } from 'vitest'
import { buildLinkAnswer, chatMessageResult, resolveCardReference } from '@/lib/askReference'
import type { AskResult } from '@/lib/askQuery'

function result(over: Partial<AskResult> = {}): AskResult {
  return {
    summary: 'Three records on education.',
    terms: ['education'],
    match: 'all',
    citations: [
      {
        kind: 'speech',
        kindLabel: 'Speech',
        collection: 'documents',
        collectionLabel: 'Archive documents',
        title: 'Education and the youth',
        href: '/archives/speeches/education-and-the-youth',
        year: 2019,
        excerpt: 'The Speaker on education.',
        hasTranscript: true,
        matched: ['education'],
      },
      {
        kind: 'research',
        kindLabel: 'Research source',
        collection: 'research',
        collectionLabel: 'Research sources',
        title: 'Education financing in Ghana',
        href: '/speaker-record#source-SRC-001',
        year: 2024,
        excerpt: 'A budget analysis.',
        hasTranscript: false,
        matched: ['education'],
        note: 'It sets out the funding gap the Speaker later addressed.',
      },
      {
        kind: 'news',
        kindLabel: 'News clipping',
        collection: 'news',
        collectionLabel: 'News',
        title: 'Education review announced',
        href: '/news/42',
        year: 2025,
        excerpt: 'A report on the announcement.',
        hasTranscript: false,
        matched: ['education'],
      },
    ],
    timeline: [],
    testimonials: [],
    collectionCounts: [{ collection: 'documents', label: 'Archive documents', count: 1 }],
    matchedTerms: ['education'],
    unmatched: [],
    totalMatched: 3,
    suggested: ['What else is in the archive on education?', 'What did he say about youth?', 'What is on the timeline?'],
    ...over,
  }
}

describe('resolveCardReference', () => {
  it('opens the second card when the reader says “the second one”', () => {
    const out = resolveCardReference('tell me more about the second one', result())
    expect(out?.citations).toHaveLength(1)
    expect(out?.citations[0].href).toBe('/speaker-record#source-SRC-001')
    expect(out?.summary).toContain('second record')
    expect(out?.summary).toContain('funding gap')
  })

  it('resolves “that source” to the first card without searching for the word source', () => {
    const out = resolveCardReference('why does that source matter?', result())
    expect(out?.citations[0].href).toBe('/archives/speeches/education-and-the-youth')
    expect(out?.match).toBe('all')
  })

  it('explains the research note when asked why it matters', () => {
    const out = resolveCardReference('why does the second one matter?', result())
    expect(out?.summary).toContain('funding gap')
  })

  it('leaves ordinary new questions to the archive', () => {
    expect(resolveCardReference('what did he say about health?', result())).toBeNull()
    expect(resolveCardReference('tell me more', result())).toBeNull()
  })

  it('does nothing when the previous answer has no cards', () => {
    expect(resolveCardReference('the second one', result({ citations: [] }))).toBeNull()
  })
})


describe('link answers', () => {
  it('labels a pasted page as outside the archive and keeps its URL', () => {
    const out = buildLinkAnswer(
      {
        title: 'Budget statement',
        url: 'https://example.com/budget',
        siteName: 'Example',
        description: null,
        excerpt: 'Education spending rose.',
        matched: ['education'],
        retrievedAt: '2026-10-20T00:00:00.000Z',
      },
      'what does it say about education',
    )
    expect(out.citations[0].collection).toBe('web')
    expect(out.citations[0].href).toBe('https://example.com/budget')
    expect(out.summary).toContain('Budget statement')
    expect(out.limitations?.[0]).toContain('outside the archive')
  })

  it('can say a greeting without pretending it searched', () => {
    const out = chatMessageResult('Hello.', ['What can you do?'])
    expect(out.citations).toEqual([])
    expect(out.match).toBe('all')
    expect(out.conversation?.kind).toBe('chat')
  })
})
