import { describe, it, expect } from 'vitest'
import {
  buildVoice,
  isFollowUpShape,
  resolveQuestion,
  suggestionsFromResult,
} from '@/lib/askConversation'
import { ASK_MAX_TERMS } from '@/lib/askQuery'
import type { ScoredCandidate, SearchCandidate } from '@/lib/askSearch'

/**
 * The conversational layer that /ask was missing.
 *
 * Before this, every question was resolved on its own: the route took
 * `body.messages`, used the last user turn and threw the rest away. So "More on
 * that?" reduced to no searchable terms and dead-ended into advice about asking a
 * better question, one turn after the reader had given a perfectly good subject.
 *
 * These tests pin the two decisions that are easy to get subtly wrong:
 *
 *   1. A turn that names a subject is searched for that subject, and a turn that
 *      names nothing inherits from the transcript. Merging the two — treating
 *      "and the debt?" as "debt and cedi" — turns an answerable question into a
 *      reported partial one.
 *   2. The first person is only ever reachable through a verbatim quotation.
 */

function candidate(over: Partial<SearchCandidate> = {}): SearchCandidate {
  return {
    collection: 'speeches',
    collectionLabel: 'Speeches',
    kind: 'speech',
    kindLabel: 'Speech',
    title: 'On the state of the nation',
    href: '/archives/speeches/on-the-state-of-the-nation',
    year: 2019,
    // Editorial copy about the record, in the third person — the shape every
    // real excerpt in the archive has.
    excerpt: 'The Speaker’s remarks on the cedi and the choices that weakened it.',
    // The record's own words, which is the only text allowed inside quotation marks.
    body:
      'The cedi did not weaken because of the choices of any one man. It weakened ' +
      'because we chose, year after year, to spend money we had not earned.',
    hasTranscript: true,
    fields: [{ weight: 5, text: 'cedi economy' }],
    matchTotal: 4,
    completeTotal: 1,
    ...over,
  }
}

function scored(over: Partial<SearchCandidate> = {}, matched = ['cedi']): ScoredCandidate {
  return { candidate: candidate(over), score: 10, matched: new Set(matched) }
}

describe('isFollowUpShape', () => {
  it('recognises a bare reference back to the conversation', () => {
    expect(isFollowUpShape('more on that')).toBe(true)
    expect(isFollowUpShape('tell me more')).toBe(true)
    expect(isFollowUpShape('and then?')).toBe(true)
    expect(isFollowUpShape('what did he say about it')).toBe(true)
  })

  it('does not treat a fresh question as a follow-up', () => {
    expect(isFollowUpShape('what is in the archive on corruption')).toBe(false)
    expect(isFollowUpShape('education and the youth')).toBe(false)
  })

  it('only reads an opener at the start of the turn', () => {
    // "more" mid-sentence is ordinary English, not a request to continue.
    expect(isFollowUpShape('what did the cedi do to more than inflation')).toBe(false)
  })
})

describe('resolveQuestion', () => {
  it('inherits the subject when a follow-up names nothing', () => {
    const resolved = resolveQuestion('more on that', ['what did he say about the cedi'])
    expect(resolved.kind).toBe('followup')
    expect(resolved.terms).toEqual(['cedi'])
    expect(resolved.anchor).toEqual(['cedi'])
  })

  it('carries the most recent subject, not the first one asked about', () => {
    const resolved = resolveQuestion('tell me more', [
      'what did he say about the cedi',
      'what did he say about corruption',
    ])
    expect(resolved.terms[0]).toBe('corruption')
  })

  it('searches only the new subject when the reader names one', () => {
    // The regression that matters most: merging history into the terms would
    // search "debt AND cedi" and report a partial answer to a fair question.
    const resolved = resolveQuestion('and the debt', ['what did he say about the cedi'])
    expect(resolved.kind).toBe('followup')
    expect(resolved.terms).toEqual(['debt'])
    // The earlier topic is a ranking preference, never a requirement.
    expect(resolved.context).toEqual(['cedi'])
  })

  it('does not widen a fresh question with earlier context', () => {
    const resolved = resolveQuestion('what is in the archive on education', [
      'what did he say about the cedi',
    ])
    expect(resolved.kind).toBe('new')
    expect(resolved.terms).toEqual(['education'])
    expect(resolved.context).toEqual([])
  })

  it('reports an identity question as unresolved rather than guessing', () => {
    // "Who was he?" has no subject of its own, so inheriting the previous turn
    // would answer a question nobody asked. It has to stay a route, not a search.
    const resolved = resolveQuestion('Who was he?', ['what did he say about the cedi'])
    expect(resolved.kind).toBe('unresolved')
    expect(resolved.terms).toEqual([])
  })

  it('reports a subjectless first turn as unresolved', () => {
    expect(resolveQuestion('more on that', []).kind).toBe('unresolved')
  })

  it('never returns more terms than the search will accept', () => {
    const resolved = resolveQuestion('tell me more', [
      'corruption accountability cedi debt education parliament',
    ])
    expect(resolved.terms.length).toBeLessThanOrEqual(ASK_MAX_TERMS)
  })

  it('ignores a transcript whose only turn is the question being answered', () => {
    // The client sends the whole transcript, so the current turn is still in the
    // array. Treating it as its own history makes every question self-referential.
    const resolved = resolveQuestion('more on that', ['more on that'])
    expect(resolved.kind).toBe('unresolved')
  })
})

describe('buildVoice', () => {
  it('puts the first person only inside a verbatim quotation', () => {
    const voice = buildVoice('new', [], [scored()])
    expect(voice.firstPerson).toBe(true)
    expect(voice.lead).toContain('In my own words')
    expect(voice.lead).toContain('On the state of the nation')
    expect(voice.quotes).toHaveLength(1)
    // The passage is the record's own text, not a paraphrase of it.
    expect(voice.quotes[0].text).toContain('The cedi did not weaken')
    expect(voice.quotes[0].href).toBe('/archives/speeches/on-the-state-of-the-nation')
  })

  it('never claims the first person for a record with nothing to quote', () => {
    // A photograph or a bare milestone has no prose. There is nothing to quote,
    // so the reply describes it instead of inventing a sentence for it.
    const voice = buildVoice('new', [], [
      scored({ excerpt: '', body: '', kindLabel: 'Photograph', collection: 'photos' }, ['portrait']),
    ])
    expect(voice.firstPerson).toBe(false)
    expect(voice.quotes).toEqual([])
    expect(voice.lead).toContain('closest record')
    expect(voice.lead).not.toContain('I ')
  })

  it('names the earlier subject when carrying a conversation forward', () => {
    const voice = buildVoice('followup', ['cedi'], [scored()])
    expect(voice.lead).toMatch(/^Carrying on from “cedi”\./)
  })

  it('does not claim continuity on a fresh question', () => {
    expect(buildVoice('new', ['cedi'], [scored()]).lead).not.toContain('Carrying on')
  })

  it('quotes at most three passages', () => {
    const many = [0, 1, 2, 3, 4].map(i =>
      scored({ title: `Speech number ${i}` }, ['cedi']),
    )
    expect(buildVoice('new', [], many).quotes).toHaveLength(3)
  })

  it('truncates a long passage on a word boundary', () => {
    // Fixed-width tokens, so a cut landing mid-word yields something like "t01"
    // that is not in the source and the assertion below can actually fail.
    const words = Array.from({ length: 200 }, (_, i) => `t${String(i).padStart(4, '0')}`)
    const voice = buildVoice('new', [], [scored({ body: words.join(' ') })])
    const text = voice.quotes[0].text
    expect(text.endsWith('…')).toBe(true)
    const lastToken = text.slice(0, -1).split(' ').pop()
    expect(words).toContain(lastToken)
  })

  it('prefers a sentence boundary when the passage has one', () => {
    const sentences = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} carries on.`)
    const voice = buildVoice('new', [], [scored({ body: sentences.join(' ') })])
    // A cut mid-sentence reads as damage to a quotation; this one should not.
    expect(voice.quotes[0].text.endsWith('.…')).toBe(true)
  })

  it('returns nothing to say when there are no results', () => {
    expect(buildVoice('followup', ['cedi'], [])).toEqual({
      lead: '',
      quotes: [],
      firstPerson: false,
    })
  })
})

describe('suggestionsFromResult', () => {
  it('builds follow-ups from the records that were returned', () => {
    const out = suggestionsFromResult([scored()], ['cedi', 'economy'], 'what about the cedi')
    expect(out.length).toBeGreaterThan(0)
    // Every suggestion is answerable from this answer, rather than being the
    // archive's four biggest themes again.
    expect(out.join(' ')).toContain('On the state of the nation')
  })

  it('never suggests the question just asked', () => {
    const out = suggestionsFromResult([scored()], ['cedi'], 'more on that')
    expect(out).not.toContain('more on that')
  })

  it('does not repeat itself', () => {
    const out = suggestionsFromResult([scored(), scored({ title: 'Second' })], ['cedi'], 'x')
    expect(new Set(out).size).toBe(out.length)
  })

  it('respects the limit', () => {
    const out = suggestionsFromResult([scored()], ['cedi', 'economy', 'debt'], 'x', 2)
    expect(out.length).toBeLessThanOrEqual(2)
  })
})

/* -------------------------------------------------------------------------- */

describe('quotation honesty', () => {
  // The archive stores two different things that look alike. `excerpt` is
  // editorial copy written about a record; `body` is the record itself. A test
  // that cannot tell them apart will pass on a fabricated quotation, so these
  // pin the difference down on its own.

  it('quotes the body, never the editorial excerpt', () => {
    const voice = buildVoice('new', [], [
      scored({
        excerpt: "The Speaker's remarks on the cedi, as summarised by the archivist.",
        body: 'The cedi did not weaken on its own. It weakened because we spent what we had not earned.',
      }),
    ])
    expect(voice.quotes[0].text).toContain('It weakened because we spent')
    expect(voice.quotes[0].text).not.toContain('as summarised by the archivist')
  })

  it('refuses to quote an editorial excerpt when there is no body', () => {
    // Long, fluent, in the first person, and entirely written by somebody else.
    const voice = buildVoice('new', [], [
      scored({
        excerpt:
          'I believed then, as I believe now, that the cedi did not weaken on its own but ' +
          'because we chose year after year to spend money we had not earned.',
        body: '',
      }),
    ])
    expect(voice.firstPerson).toBe(false)
    expect(voice.quotes).toEqual([])
    // The sentence above is the dangerous case: it must not reach the reader in
    // quotation marks, not even as the lead.
    expect(voice.lead).not.toContain('I believed then')
  })

  it('does not put an excerpt in quotation marks in the lead', () => {
    const voice = buildVoice('new', [], [
      scored({ excerpt: 'A public address on separation of powers.', body: '' }),
    ])
    // The lead may quote the record's *title* — that is a title, and titling a
    // record is not claiming its words. What it may not do is reproduce the
    // editorial excerpt, which is somebody else's sentence.
    expect(voice.lead).toContain('On the state of the nation')
    expect(voice.lead).not.toContain('A public address on separation of powers')
  })

  it('quotes an interview, because the transcript contains his answers', () => {
    const voice = buildVoice('new', [], [
      scored({
        collection: 'documents',
        kindLabel: 'Interview',
        excerpt: 'An interview touching on the duties of the Speaker.',
        body:
          'Interviewer: You have described the 8th Parliament as unique. Bagbin: The people ' +
          'elected us to sit as equals, and that is the duty this House now carries.',
      }),
    ])
    expect(voice.quotes[0].text).toContain('The people elected us to sit as equals')
  })
})

describe('a first question is not a follow-up', () => {
  it('treats a reference-shaped opening question as new', () => {
    // "What did he say about the cedi" is reference-shaped, but with no
    // transcript there is nothing for the "he" to point back at.
    const state = resolveQuestion('What did he say about the cedi', [])
    expect(state.kind).toBe('new')
    expect(state.terms).toEqual(['cedi'])
  })

  it('does treat it as a follow-up once there is a transcript', () => {
    const state = resolveQuestion('What did he say about the cedi', ['parliamentary independence'])
    expect(state.kind).toBe('followup')
  })
})

describe('suggested questions stay readable', () => {
  it('does not suggest a hundred-character scraped headline', () => {
    const long =
      'Bagbin elected President of African Anti-Corruption Network - CitiNewsroom.com - 9 Nov 2025'
    const [first] = suggestionsFromResult([scored({ title: long })], ['corruption'], 'x')
    expect(first.length).toBeLessThan(90)
    expect(first).toContain('Bagbin elected President')
  })

  it('leaves a short title alone', () => {
    const [first] = suggestionsFromResult([scored()], ['cedi'], 'x')
    expect(first).toBe('What else is in the archive on “On the state of the nation”?')
  })
})

describe('verbatim is not the same as his words', () => {
  it('does not voice a procedural notice, however genuine the text', () => {
    // Authenticated archive text, written by nobody in particular: the
    // Constitution's own words in a form letter. Quoting it is fine. Calling it
    // "in my own words" is not.
    const voice = buildVoice('new', [], [
      scored({
        kind: 'note',
        kindLabel: 'Note',
        title: 'Notice Recalling Parliament from Recess',
        body:
          'By this notice, the Rt. Hon. Speaker recalls the House of the 8th Parliament ' +
          'of the Fourth Republic of Ghana from its adjournment.',
      }),
    ])
    expect(voice.firstPerson).toBe(false)
    expect(voice.quotes).toEqual([])
    expect(voice.lead).not.toContain('In my own words')
  })

  it('still voices a letter, which he did write', () => {
    const voice = buildVoice('new', [], [
      scored({ kind: 'letter', kindLabel: 'Letter' }),
    ])
    expect(voice.firstPerson).toBe(true)
  })
})
