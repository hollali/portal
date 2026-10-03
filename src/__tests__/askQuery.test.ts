import { describe, it, expect } from 'vitest'
import {
  ASK_SUGGESTIONS,
  collectionFilter,
  describeCollections,
  describeWindow,
  parsePeriod,
  periodYears,
  queryTerms,
  termVariants,
} from '@/lib/askQuery'

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

  /**
   * A reader asking about "the 4th Republic" and an archive row titled "Fourth
   * Republic" are the same place, and no stemming rule reaches across a numeral.
   * These are the ordinals that appear in the archive's own headlines, so each
   * pair is asserted in the direction a reader is likely to type it.
   */
  it('bridges written ordinals to their numerals and back', () => {
    for (const [written, numeral] of [
      ['first', '1st'],
      ['second', '2nd'],
      ['third', '3rd'],
      ['fourth', '4th'],
      ['fifth', '5th'],
      ['sixth', '6th'],
      ['seventh', '7th'],
      ['eighth', '8th'],
      ['ninth', '9th'],
      ['tenth', '10th'],
    ] as const) {
      expect(termVariants(written), `${written} -> ${numeral}`).toContain(numeral)
      expect(termVariants(numeral), `${numeral} -> ${written}`).toContain(written)
    }
  })

  it('never returns duplicates', () => {
    for (const term of ['elections', 'digitalisation', 'democracy']) {
      const variants = termVariants(term)
      expect(new Set(variants).size).toBe(variants.length)
    }
  })
})

describe('parsePeriod', () => {
  it('reads a single year named with a preposition', () => {
    expect(parsePeriod('What did he say about the economy in 2024?')).toEqual({
      from: 2024,
      to: 2024,
      label: '2024',
    })
  })

  it('reads a bounded window from either phrasing', () => {
    const expected = { from: 2019, to: 2021, label: '2019\u20132021' }
    expect(parsePeriod('What changed between 2019 and 2021?')).toEqual(expected)
    expect(parsePeriod('What changed from 2019 to 2021?')).toEqual(expected)
    expect(parsePeriod('What changed in 2019-2021?')).toEqual(expected)
  })

  it('orders a window the reader wrote backwards', () => {
    expect(parsePeriod('between 2021 and 2019')).toEqual({ from: 2019, to: 2021, label: '2019\u20132021' })
  })

  it('leaves an open end open rather than inventing a bound for it', () => {
    // An open end stays null. 2100 would be a claim about the archive's newest
    // record, and the newest record is not what the reader asked about.
    expect(parsePeriod('What has he said about the debt since 2020?')).toEqual({
      from: 2020,
      to: null,
      label: 'since 2020',
    })
    expect(parsePeriod('What did he say before 2015?')).toEqual({
      from: null,
      to: 2014,
      label: 'before 2015',
    })
  })

  it('reads a decade written as digits', () => {
    expect(parsePeriod('speeches from the 1990s')).toEqual({ from: 1990, to: 1999, label: 'the 1990s' })
    expect(parsePeriod('speeches in the 2010s')).toEqual({ from: 2010, to: 2019, label: 'the 2010s' })
  })

  it('reads a decade written as a word', () => {
    expect(parsePeriod('What did he say in the eighties?')).toEqual({
      from: 1980,
      to: 1989,
      label: 'the 1980s',
    })
  })

  /**
   * The failure this bounds. Article 24 of the Constitution is "Article 24",
   * not the year 24, and a bare number that is not four digits is not a date.
   */
  it('does not read a short number as a year', () => {
    expect(parsePeriod('What did he say about Article 24?')).toBeNull()
    expect(parsePeriod('What did he say about the 9th Parliament?')).toBeNull()
  })

  it('does not read digits inside a longer number as a year', () => {
    expect(parsePeriod('the 12020 record')).toBeNull()
  })

  it('returns null for a question with no time in it', () => {
    expect(parsePeriod('What did he say about the economy?')).toBeNull()
    expect(parsePeriod('')).toBeNull()
  })

  it('ignores a relative period rather than inventing a window', () => {
    // The archive stores when a clipping was published, not when it describes,
    // so a window guessed from the server clock would be a claim, not a filter.
    expect(parsePeriod('What has he said recently?')).toBeNull()
    expect(parsePeriod('What did he say last year?')).toBeNull()
  })

  it('names only the bounds the reader wrote, for the terms to drop', () => {
    expect(periodYears(parsePeriod('in 2024'))).toEqual(['2024'])
    expect(periodYears(parsePeriod('between 2019 and 2021'))).toEqual(['2019', '2021'])
    // An open window is two centuries wide; sweeping it into the search terms
    // would bury the question under years nobody asked about.
    expect(periodYears(parsePeriod('since 2020'))).toEqual(['2020'])
    expect(periodYears(null)).toEqual([])
  })
})

describe('queryTerms leaves the window to the window', () => {
  it('does not search for a year the period has claimed', () => {
    expect(queryTerms('What happened in 2026?')).toEqual([])
    expect(queryTerms('speeches in 2021 and 2022')).not.toContain('2021')
  })

  it('does not leave the word that introduced the window', () => {
    // "since 2020" was answering a question about the archive\'s opinion of the
    // word "since", which is how a dated search silently returns nothing.
    expect(queryTerms('What did he say about the economy since 2020?')).toEqual(['economy'])
    expect(queryTerms('letters before 2019 about education')).not.toContain('before')
    expect(queryTerms('statements between 2018 and 2019')).not.toContain('between')
  })

  it('leaves a year alone when it is not a window', () => {
    // "Ninth" is not a year, and neither is a number inside a word. Only a
    // standalone four-digit year standing in for a period is consumed.
    expect(queryTerms('the 4th Republic')).toContain('republic')
  })

  it('still returns nothing for a bare window, so the caller can tell', () => {
    expect(queryTerms('2021')).toEqual([])
    expect(queryTerms('in the 1990s')).toEqual([])
  })
})

describe('describeWindow', () => {
  it('states the filter over what was shown', () => {
    expect(describeWindow({ from: 2019, to: 2021, label: '2019–2021' })).toBe(
      'Everything below was dated 2019–2021.',
    )
    expect(describeWindow({ from: 2026, to: 2026, label: '2026' })).toBe(
      'Everything below was dated 2026.',
    )
    expect(describeWindow({ from: 2020, to: null, label: 'since 2020' })).toBe(
      'Everything below was dated 2020 or later.',
    )
    expect(describeWindow({ from: null, to: 1998, label: 'up to 1998' })).toBe(
      'Everything below was dated 1998 or earlier.',
    )
  })

  it('names the collections that store no date', () => {
    expect(describeWindow({ from: 2026, to: 2026, label: '2026' }, ['Videos', 'Audio'])).toBe(
      'Everything below was dated 2026. Videos and Audio carry no date, so they are left out of this window.',
    )
    expect(describeWindow({ from: 2026, to: 2026, label: '2026' }, ['Videos'])).toContain(
      'Videos carries no date',
    )
  })

  it('does not say "everything below" when nothing was shown', () => {
    // Nothing is below, and the archive holds 148 records dated since 2020 — a
    // sentence claiming otherwise would be simply false.
    expect(describeWindow({ from: 1994, to: 1994, label: '1994' }, [], 'empty')).toBe(
      'No record in the archive is dated 1994.',
    )
  })

  it('admits the filter separately when a subject was missed inside it', () => {
    expect(describeWindow({ from: 2020, to: null, label: 'since 2020' }, [], 'filtered')).toBe(
      'The search was restricted to records dated 2020 or later.',
    )
  })

  it('says nothing for a period with no bounds at all', () => {
    expect(describeWindow({ from: null, to: null, label: '' })).toBe('')
  })
})

describe('collectionFilter', () => {
  it('reads a collection named in the question as a filter and drops it from the terms', () => {
    // The failure this exists to fix: "milestones" stayed in the terms, so every
    // record returned had to contain the word "milestones" in its own text, and
    // the milestones of the 1990s — which do not — came back empty.
    expect(collectionFilter(['milestones'])).toEqual({ collections: ['milestones'], terms: [] })
    expect(collectionFilter(['milestones', 'poverty'])).toEqual({
      collections: ['milestones'],
      terms: ['poverty'],
    })
  })

  it('names a collection by any of the words the site calls it by', () => {
    for (const [word, collection] of [
      ['milestone', 'milestones'],
      ['timeline', 'milestones'],
      ['testimonials', 'testimonials'],
      ['videos', 'videos'],
      ['audio', 'audio'],
      ['clippings', 'news'],
      ['news', 'news'],
      ['documents', 'documents'],
      ['archive documents', 'documents'],
      ['photographs', 'photos'],
      ['photograph', 'photos'],
    ] as const) {
      expect(collectionFilter([word])).toEqual({ collections: [collection], terms: [] })
    }
  })

  it('searches both when a question names two', () => {
    expect(collectionFilter(['videos', 'photographs'])).toEqual({
      collections: ['videos', 'photos'],
      terms: [],
    })
  })

  it('reports the same collection once when both its words appear', () => {
    expect(collectionFilter(['timeline', 'milestones'])).toEqual({
      collections: ['milestones'],
      terms: [],
    })
  })

  it('leaves ordinary subject matter alone', () => {
    // "Press" and "recordings" sound like collections here and are not: a reader
    // can mean either as a subject, and filtering them away to clippings or to
    // audio would answer a different question than the one asked.
    for (const question of [
      'What is his position on press freedom?',
      'Are there recordings of the address?',
      'What did he say about statements and letters?',
      'How many speeches are there?',
    ]) {
      expect(collectionFilter(queryTerms(question)).collections).toEqual([])
    }
  })

  it('is idempotent, because the route and the search both see the terms', () => {
    const once = collectionFilter(['milestones', 'poverty'])
    expect(collectionFilter(once.terms)).toEqual({ collections: [], terms: ['poverty'] })
  })
})

describe('describeCollections', () => {
  it('names one collection in the reader\'s own words', () => {
    expect(describeCollections(['milestones'])).toBe('Restricted to Milestones.')
  })

  it('joins two', () => {
    expect(describeCollections(['videos', 'photos'])).toBe(
      'Restricted to Videos and Photographs.',
    )
  })

  it('says nothing when nothing was restricted', () => {
    expect(describeCollections([])).toBe('')
  })
})
