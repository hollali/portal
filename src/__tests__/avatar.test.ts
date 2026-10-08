import { describe, it, expect } from 'vitest'
import type { AskCitation, AskResult } from '@/lib/askQuery'
import {
  buildSpeakCitation,
  buildSpeakText,
  MAX_QUOTE_CHARS,
  speakableForResult,
  trimExcerpt,
} from '@/lib/speakText'
import { guideState, stateAllowsIdleMotion } from '@/lib/avatarState'
import { CAPTION_ATTRIBUTION, GUIDE_LINES, GUIDE_LABEL } from '@/lib/guideLines'

/** A citation with the minimum an answer must carry. */
const citation = (over: Partial<AskCitation> = {}): AskCitation => ({
  kind: 'document',
  kindLabel: 'Speech',
  collection: 'documents',
  collectionLabel: 'Speeches',
  title: 'Address on the state of the nation',
  href: '/archive/speeches/state-of-the-nation',
  year: 2021,
  excerpt: 'The budget is not a statement of what we intend to do, but of what we are able to do.',
  hasTranscript: true,
  matched: ['budget'],
  ...over,
})

const result = (over: Partial<AskResult> = {}): AskResult =>
  ({
    summary: 'One speech matches.',
    terms: ['budget'],
    match: 'all',
    citations: [citation()],
    timeline: [],
    testimonials: [],
    collectionCounts: [],
    matchedTerms: ['budget'],
    unmatched: [],
    totalMatched: 1,
    suggested: [],
    ...over,
  }) as AskResult

/** First-person pronouns, which may only ever appear inside a quote. */
const FIRST_PERSON = /\b(i|me|my|mine|myself|we|us|our|ours|ourselves|am|i'?m|i'?ve|i'?ll|i'?d)\b/i

describe('the guide only ever introduces a quotation', () => {
  it('reads the excerpt word for word, inside quotation marks', () => {
    const text = buildSpeakText(citation())
    expect(text).toContain(
      '"The budget is not a statement of what we intend to do, but of what we are able to do."',
    )
  })

  it('speaks in the third person in the part it wrote itself', () => {
    // The framing is the only sentence the guide owns. If a first-person pronoun
    // appears there, it is the guide talking as the Speaker.
    const built = buildSpeakCitation(citation())
    expect(built?.lead).toBeTruthy()
    expect(built!.lead).not.toMatch(FIRST_PERSON)
    expect(built!.lead).toContain('the Speaker is quoted')
  })

  it('never puts the record title into the spoken line', () => {
    // A speech can genuinely be titled "Why I Would Resign". Pasting that into
    // a sentence the guide speaks about himself is the exact ambiguity the
    // labels exist to prevent, so the title goes in the caption only.
    const built = buildSpeakCitation(citation({ title: 'Why I would resign' }))
    expect(buildSpeakText(citation({ title: 'Why I would resign' }))).not.toContain('Why I would resign')
    expect(built?.source).toBe('Why I would resign')
  })

  it('keeps a first-person pronoun that the record itself contains', () => {
    const text = buildSpeakText(citation({ excerpt: 'I believe the Assembly should sit in March.' }))
    expect(text).toContain('I believe the Assembly should sit in March.')
  })

  it('scrubs a first-person pronoun out of a label, which is ours and not the record', () => {
    const built = buildSpeakCitation(citation({ kindLabel: 'My speech' }))
    expect(built?.lead).not.toContain('My')
    expect(built?.lead).toContain('a speech record')
    expect(built?.lead).not.toMatch(FIRST_PERSON)
  })

  it('reads cleanly whether or not there is a year or a kind', () => {
    expect(buildSpeakCitation(citation())?.lead).toBe('From a speech record dated 2021, the Speaker is quoted:')
    expect(buildSpeakCitation(citation({ year: null }))?.lead).toBe('From a speech record, the Speaker is quoted:')
    expect(buildSpeakCitation(citation({ kindLabel: '', collectionLabel: '' }))?.lead).toBe(
      'From a record dated 2021, the Speaker is quoted:',
    )
  })

  it('names the year when the record has one and omits it when it does not', () => {
    expect(buildSpeakCitation(citation({ year: 2019 }))?.lead).toContain('2019')
    expect(buildSpeakCitation(citation({ year: null }))?.lead).not.toMatch(/\d/)
  })

  it('says nothing at all for a record with no text to quote', () => {
    // A photograph or an untranscribed video is shown or played. Describing it
    // in the Speaker's voice would be inventing a quotation.
    const photo = citation({ kindLabel: 'Photograph', excerpt: null })
    expect(buildSpeakText(photo)).toBe('')
    expect(buildSpeakCitation(photo)?.quote).toBeNull()
    // The record is still identified, so the caption can name it.
    expect(buildSpeakCitation(photo)?.source).toBe('Address on the state of the nation')
  })

  it('says nothing when there is no citation', () => {
    expect(buildSpeakText(null)).toBe('')
    expect(buildSpeakText(undefined)).toBe('')
    expect(buildSpeakCitation(null)).toBeNull()
  })
})

describe('a truncated quotation is never passed off as the whole of it', () => {
  const long = 'The Assembly must be respected. '.repeat(40)

  /** The quotation with the ellipsis taken off, for checking against the source. */
  const body = (out: string) => out.replace(/…$/, '')

  it('cuts at a sentence end where one is close enough to be worth waiting for', () => {
    const source = 'A first sentence here. ' + long
    const out = trimExcerpt(source)
    expect(out.length).toBeLessThanOrEqual(MAX_QUOTE_CHARS + 1)
    expect(out.endsWith('…')).toBe(true)
    // A whole sentence, then the mark that says more was cut.
    expect(body(out).endsWith('.')).toBe(true)
    expect(source.startsWith(body(out))).toBe(true)
  })

  it('falls back to a word boundary, never mid-word', () => {
    // No sentence ends to wait for, so the cut has to land on a space instead.
    const words = 'parliamentary democracy and the rights of every citizen '.repeat(20)
    const out = trimExcerpt(words, 80)
    expect(out.length).toBeLessThanOrEqual(81)
    expect(out.endsWith('…')).toBe(true)
    // Whatever was dropped starts at a space, which is what "word boundary" means.
    expect(words[body(out).length]).toBe(' ')
  })

  it('leaves a short excerpt alone, with no ellipsis to imply more', () => {
    expect(trimExcerpt('Short enough.')).toBe('Short enough.')
  })

  it('collapses the whitespace that survives a scraped row', () => {
    expect(trimExcerpt('a\n\n  b   c')).toBe('a b c')
  })
})

describe('the guide cannot be made to read something generated', () => {
  it('ignores a generated reading even when the API starts sending one', () => {
    const withReading = result({
      reading: { text: 'Taken together, these records suggest a shift.', generated: true, basedOn: ['1'] },
    })
    const line = buildSpeakText(withReading.citations[0])
    expect(line).not.toContain('Taken together')
    expect(speakableForResult(withReading)?.quote).toBe(
      'The budget is not a statement of what we intend to do, but of what we are able to do.',
    )
  })

  it('reads the strongest citation of an answer', () => {
    const many = result({
      citations: [citation(), citation({ title: 'Second', excerpt: 'The second record.' })],
    })
    expect(speakableForResult(many)?.quote).toBe(
      'The budget is not a statement of what we intend to do, but of what we are able to do.',
    )
  })

  it('stays silent when the top result is media rather than a quotable text', () => {
    // The guide shows or plays a photograph and keeps quiet. Reading the second
    // record instead would put words in the Speaker's mouth that answer a
    // different question from the one the visitor asked.
    const photoFirst = result({
      citations: [citation({ kindLabel: 'Photograph', excerpt: null }), citation({ excerpt: 'The second record.' })],
    })
    expect(speakableForResult(photoFirst)?.quote).toBeNull()
  })

  it('has nothing to say about an answer with no citations', () => {
    expect(speakableForResult(result({ citations: [] }))).toBeNull()
    expect(speakableForResult(null)).toBeNull()
  })
})

describe('the guide poses itself from what the page is doing', () => {
  it('waits, before anything has been asked', () => {
    expect(guideState()).toBe('idle')
    expect(guideState({})).toBe('idle')
  })

  it('is not apologetic about a page nobody has searched yet', () => {
    // A dead end is a search that came back empty, not a blank page.
    expect(guideState({ searched: false, hasResult: false })).toBe('idle')
  })

  it('says so when a search has finished with nothing', () => {
    expect(guideState({ searched: true, hasResult: false })).toBe('no-result')
  })

  it('does not claim a dead end while the search is still running', () => {
    expect(guideState({ searched: true, hasResult: false, searching: true })).toBe('thinking')
  })

  it('keeps reading aloud while a follow-up is being searched', () => {
    // The visitor is watching. Flipping to a thinking pose mid-sentence reads as
    // the page losing its place, not as a new question starting.
    expect(guideState({ speaking: true, searching: true, composing: true })).toBe('speaking')
  })

  it('stops talking when a real recording is playing', () => {
    expect(guideState({ speaking: true, mediaPlaying: true })).toBe('media')
    expect(guideState({ mediaPlaying: true })).toBe('media')
  })

  it('turns to the composer while a question is being typed', () => {
    expect(guideState({ composing: true })).toBe('listening')
    // ...but not if a search has already overtaken it.
    expect(guideState({ composing: true, searching: true })).toBe('thinking')
  })

  it('stays still unless it is idle or listening', () => {
    expect(stateAllowsIdleMotion('idle')).toBe(true)
    expect(stateAllowsIdleMotion('listening')).toBe(true)
    // A guide that drifts and blinks over a playing recording competes with the
    // thing the visitor asked to see.
    expect(stateAllowsIdleMotion('media')).toBe(false)
    expect(stateAllowsIdleMotion('speaking')).toBe(false)
    expect(stateAllowsIdleMotion('thinking')).toBe(false)
  })
})

describe('the labelling is not optional', () => {
  it('says what the guide is not', () => {
    expect(GUIDE_LABEL).toBe('Animated guide. This is not a recording of the Speaker.')
  })

  it('tells the two voices apart in the caption', () => {
    expect(CAPTION_ATTRIBUTION.guide).toBe('Guide')
    expect(CAPTION_ATTRIBUTION.speaker).toBe('The Speaker, quoted')
  })

  it('keeps every guide line short enough to be read before a visitor looks away', () => {
    for (const [key, line] of Object.entries(GUIDE_LINES)) {
      expect(line.length, `${key} is ${line.length} characters`).toBeLessThan(90)
    }
  })

  it('never answers for him when explaining a gap', () => {
    // A guide line may be first person about itself. What it must not do is
    // answer for him.
    expect(GUIDE_LINES.noResult).toContain('I could not find a record')
    expect(GUIDE_LINES.noResult).not.toMatch(/\bmy\b|\bour\b/i)
    expect(GUIDE_LINES.introducing).not.toMatch(FIRST_PERSON)
  })
})