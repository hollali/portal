import { describe, it, expect } from 'vitest'
import { ASK_SUGGESTIONS, queryTerms, termVariants } from '@/lib/askQuery'

describe('queryTerms', () => {
  it('reduces a natural-language question to discriminating terms', () => {
    expect(queryTerms('What has the Speaker said about democracy?')).toEqual(['democracy'])
  })

  it('never returns a term containing whitespace', () => {
    // The original bug: the whole sentence reached Prisma's `contains`, which
    // compiles to ILIKE '%entire question%' and matched nothing.
    for (const chip of ASK_SUGGESTIONS) {
      for (const term of queryTerms(chip)) {
        expect(term).not.toMatch(/\s/)
      }
    }
  })

  it('produces at least one usable term for every suggestion chip', () => {
    for (const chip of ASK_SUGGESTIONS) {
      expect(queryTerms(chip).length, `no terms for: ${chip}`).toBeGreaterThan(0)
    }
  })

  it('strips possessive suffixes so "Speaker\'s" is not a distinct term', () => {
    // "position" is now question framing rather than subject matter, so this
    // question reduces to nothing at all — see the framing-stopword tests below.
    expect(queryTerms("What is the Speaker's position?")).toEqual([])
    expect(queryTerms("What is the Speaker's position on digitalisation?")).toEqual(['digitalisation'])
  })

  it('drops question-framing words that would otherwise break a strict AND', () => {
    // Each of these used to survive stopwording and drag an otherwise good
    // question down the loose `any` path, producing a partial answer.
    expect(queryTerms('What is the Speaker position on digitalisation?')).toEqual(['digitalisation'])
    expect(queryTerms('What happened at the opening of Parliament?')).toEqual(['opening'])
    // A count question carries no content at all, which is why it is answered
    // from the corpus totals rather than by searching for "many".
    expect(queryTerms('How many speeches are there?')).toEqual([])
  })

  it('keeps genuine subject matter that merely looks like framing', () => {
    // "view" and "position" are framing in a question, but the corpus may still
    // discuss them; only the question-shaped usage is pruned, never mid-phrase
    // content that is itself the thing being asked about.
    expect(queryTerms('poverty reduction strategies')).toEqual(['poverty', 'reduction', 'strategies'])
  })

  it('drops stopwords that carry no discriminating power in this corpus', () => {
    const terms = queryTerms('Find the notice recalling Parliament')
    expect(terms).toEqual(['notice', 'recalling'])
    expect(terms).not.toContain('parliament')
  })

  it('normalises punctuation, curly quotes and case', () => {
    expect(queryTerms('“Education & the Youth”')).toEqual(['education', 'youth'])
  })

  it('de-duplicates repeated words and preserves first-seen order', () => {
    expect(queryTerms('poverty reduction poverty strategies poverty')).toEqual([
      'poverty',
      'reduction',
      'strategies',
    ])
  })

  it('ignores terms shorter than three characters', () => {
    expect(queryTerms('a an of to')).toEqual([])
  })

  it('returns an empty list for input with no searchable words', () => {
    expect(queryTerms('   ')).toEqual([])
    expect(queryTerms('!!! ??? ...')).toEqual([])
  })

  it('caps the number of terms so the generated query stays bounded', () => {
    expect(queryTerms('alpha bravo charlie delta echo foxtrot golf hotel')).toHaveLength(6)
    expect(queryTerms('alpha bravo charlie delta echo foxtrot golf hotel', 3)).toHaveLength(3)
  })
})

describe('termVariants', () => {
  it('folds simple plurals to their singular', () => {
    expect(termVariants('elections')).toContain('election')
    expect(termVariants('policies')).toContain('policy')
  })

  it('leaves singulars and -ss words alone', () => {
    expect(termVariants('democracy')).toEqual(['democracy'])
    expect(termVariants('address')).toEqual(['address'])
  })

  it('bridges vocabulary gaps via aliases', () => {
    expect(termVariants('digitalisation')).toContain('digital')
  })

  it('never returns duplicates', () => {
    for (const term of ['elections', 'digitalisation', 'democracy']) {
      const variants = termVariants(term)
      expect(new Set(variants).size).toBe(variants.length)
    }
  })
})
