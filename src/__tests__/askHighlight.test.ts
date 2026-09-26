import { describe, it, expect } from 'vitest'
import { highlightTerms, matchedWords } from '@/lib/askHighlight'

/** Reassemble a segmented string so a test can assert on the whole result. */
const flat = (segments: { text: string }[]) => segments.map(s => s.text).join('')

describe('highlightTerms', () => {
  it('marks a term and preserves every character around it', () => {
    const segments = highlightTerms('A speech on youth and the youth of Ghana', ['youth'])
    expect(flat(segments)).toBe('A speech on youth and the youth of Ghana')
    expect(segments.filter(s => s.match).map(s => s.text)).toEqual(['youth', 'youth'])
  })

  it('is case-insensitive but returns the original casing', () => {
    const segments = highlightTerms('Bagbin on CORRUPTION', ['corruption'])
    expect(segments.filter(s => s.match).map(s => s.text)).toEqual(['CORRUPTION'])
  })

  it('returns a single unmatched segment when nothing matches', () => {
    expect(highlightTerms('nothing in common', ['democracy'])).toEqual([
      { text: 'nothing in common', match: false },
    ])
  })

  it('returns a single unmatched segment when given no terms', () => {
    expect(highlightTerms('untouched', [])).toEqual([{ text: 'untouched', match: false }])
  })

  it('marks a term at the start of a word, including inside its longer forms', () => {
    // Highlighting has to agree with the matching that put the record on the
    // page. `matchTerm` in askSearch anchors a term to a word start and lets it
    // run into the word, so a record found through "parliamentary" while the
    // reader asked about "parliament" has to show that word marked — otherwise
    // the "matched: parliament" chip claims something the visible text does not
    // support.
    // The mark covers the characters that matched, not the whole word, so a
    // reader still reads "youthful" and "Parliamentary" rather than a
    // highlighted fragment that has changed the word.
    expect(highlightTerms('the youthful delegation', ['youth']).filter(s => s.match).map(s => s.text)).toEqual([
      'youth',
    ])
    expect(highlightTerms('Parliamentary Prayers', ['parliament']).filter(s => s.match).map(s => s.text)).toEqual([
      'Parliament',
    ])
  })

  it('never marks a term that only appears inside a longer word', () => {
    // The other half of the same rule, and the reason anchoring moved: a term
    // has to begin a word to count. This is what keeps "art" out of "Part" and
    // "min" out of "administration" — the substring search that marked (and
    // matched) those reported 18 records about art, none of which were.
    expect(highlightTerms('a Part of the start line', ['art'])).toEqual([
      { text: 'a Part of the start line', match: false },
    ])
    expect(highlightTerms('the administration budget', ['min'])).toEqual([
      { text: 'the administration budget', match: false },
    ])
  })

  it('marks a term that starts a word but is followed by punctuation', () => {
    expect(highlightTerms('youth, and then youth.', ['youth']).filter(s => s.match).map(s => s.text)).toEqual([
      'youth',
      'youth',
    ])
  })

  it('gives the longest term a contested span rather than splitting it', () => {
    // "digitalisation" and its alias "digital" both match here. Left to a naive
    // alternation the shorter term would split the longer one in half.
    const segments = highlightTerms('digitalisation of parliament', ['digital', 'digitalisation'])
    expect(segments.filter(s => s.match).map(s => s.text)).toEqual(['digitalisation'])
  })

  it('highlights a record that matched through an alias, not the term itself', () => {
    // This is the case that made the "matched: digitalisation" chip an
    // unbacked claim: the record only ever says "digital", and it was returned
    // for a search on "digitalisation". Highlighting the literal query term
    // would mark nothing at all.
    const segments = highlightTerms('Reflections on digital tools', ['digitalisation'])
    expect(segments.filter(s => s.match).map(s => s.text)).toEqual(['digital'])
    expect(flat(segments)).toBe('Reflections on digital tools')
  })

  it('highlights a plural that was folded to a singular during matching', () => {
    const segments = highlightTerms('Two elections were contested', ['elections'])
    expect(segments.filter(s => s.match).map(s => s.text)).toEqual(['elections'])
    const singular = highlightTerms('One election was contested', ['elections'])
    expect(singular.filter(s => s.match).map(s => s.text)).toEqual(['election'])
  })

  it('caps how many times a repeated term is marked', () => {
    const text = Array.from({ length: 40 }, () => 'youth').join(' ')
    const segments = highlightTerms(text, ['youth'])
    expect(flat(segments)).toBe(text)
    expect(segments.filter(s => s.match).length).toBeLessThanOrEqual(12)
  })

  it('ignores terms that are not plain words', () => {
    // A `\b` anchored around punctuation anchors to the wrong offset, so
    // anything that is not word characters is dropped rather than guessed at.
    const segments = highlightTerms('a b c', ['a b', 'c.d', '!'])
    expect(segments.every(s => !s.match)).toBe(true)
  })

  it('handles empty input', () => {
    expect(highlightTerms('', ['youth'])).toEqual([])
  })

  it('de-duplicates and lower-cases terms before matching', () => {
    const segments = highlightTerms('Youth', ['youth', 'YOUTH', 'youth'])
    expect(segments.filter(s => s.match).map(s => s.text)).toEqual(['Youth'])
  })
})

describe('matchedWords', () => {
  it('lists the distinct matched words, lower-cased', () => {
    expect(matchedWords('Youth and more YOUTH and democracy', ['youth', 'democracy'])).toEqual([
      'youth',
      'democracy',
    ])
  })

  it('is empty when nothing matched', () => {
    expect(matchedWords('nothing here', ['democracy'])).toEqual([])
  })
})
