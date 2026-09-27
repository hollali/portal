/**
 * Conversational resolution and persona composition for /ask.
 *
 * The search itself is stateless: `searchArchive(terms)` takes terms and returns
 * ranked records, and every question used to be resolved on its own. So "And the
 * debt?" searched for `debt` with no memory of the cedi question before it, and
 * "More on that?" reduced to no terms at all and dead-ended into advice about
 * asking a better question — when the reader had given a perfectly good subject
 * one turn earlier.
 *
 * This module supplies the missing layer, and it is deliberately the only place
 * that decides what a turn *meant*:
 *
 *   - `resolveQuestion` turns a turn plus the turns before it into a standalone
 *     set of terms, or reports that the turn has no subject of its own.
 *   - `buildVoice` composes the reply's opening line. The brief was a digital
 *     version of the Speaker of Parliament, and the only honest way to speak in
 *     his first person is to make that first person a *quotation*: the framing
 *     sentence asserts nothing, and the words after it are verbatim from a
 *     published record. A synthesised "I believe the cedi policy was a mistake"
 *     would be a sentence nobody ever said, attributed to a living person.
 *
 * Nothing here calls a model, and nothing here invents content. Every term comes
 * from `queryTerms`, every quotation from a record the search actually returned.
 */

import { queryTerms, ASK_MAX_TERMS } from './askQuery'
import type { ScoredCandidate } from './askSearch'

/** How a turn relates to what came before it. */
export type ConversationKind =
  /** A question with a subject of its own. */
  | 'new'
  /** A question about something already under discussion. */
  | 'followup'
  /** No subject at all — "who was he?". Needs a route, not a search. */
  | 'unresolved'

export interface ConversationState {
  kind: ConversationKind
  /** The terms actually searched. */
  terms: string[]
  /** Terms carried over from earlier turns, so the UI can name the subject. */
  anchor: string[]
  /**
   * Earlier terms offered to the ranker as a *preference*. Never a requirement:
   * a reader who names a new subject gets a search of that subject, with the
   * previous topic only breaking ties between equally relevant records.
   */
  context: string[]
}

/**
 * Openers that mean "continue", not "start something new".
 *
 * Matched against the start of the turn only. "More" mid-sentence is not a
 * follow-up signal — "what did the cedi do to more than inflation?" is a real
 * question about the cedi.
 */
const FOLLOWUP_OPENERS = [
  'and', 'also', 'then', 'so', 'ok', 'okay',
  'more', 'more on', 'more about', 'tell me more', 'say more', 'go on', 'continue',
  'what about', 'how about', 'what else', 'and what', 'and how',
  'anything on', 'anything about', 'anything else', 'any more',
  'why', 'when', 'where', 'who else', 'which',
  'expand', 'expand on', 'elaborate', 'elaborate on', 'elaborate further',
]

/**
 * Words that point back at something already said.
 *
 * All of these are already stopwords, so none of them can survive into a search
 * on their own — which is exactly what makes them useful as a signal. A turn
 * containing one of these is leaning on the transcript for its subject.
 */
const REFERENCE_TOKENS = new Set([
  'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its',
  'that', 'this', 'these', 'those', 'they', 'them', 'their',
  'there', 'then', 'same', 'again', 'one', 'such',
])

/**
 * Questions about the person rather than about the material.
 *
 * These contain reference words — "who was **he**?" — so the follow-up detector
 * below would otherwise treat them as a request to carry the previous subject
 * forward, and "Who was he?" in the middle of a conversation about the cedi would
 * come back with an answer about the cedi. They are checked first and are never
 * resolved from history: they are a route to /the-man, not a search.
 */
const IDENTITY_QUESTION = [
  /\bwho\s+(?:is|was|are|were)\b/,
  /\bwho'?s\b/,
  /\bbiograph/,
  /\b(?:his|her|their)\s+life\b/,
  /\b(?:his|her|their)\s+(?:background|career|record|legacy)\b/,
  /\b(?:tell|teach)\s+me\s+about\s+(?:him|her|them|you|the\s+speaker)\b/,
  /\bwhat\s+is\s+he\s+like\b/,
  /\bwhere\s+is\s+he\s+from\b/,
]

function isIdentityQuestion(question: string): boolean {
  const flat = normalise(question)
  return IDENTITY_QUESTION.some(pattern => pattern.test(flat))
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Does this turn look like it is referring backwards?
 *
 * True for "more on that", "and then?", "what did he say about it" — and also for
 * "and education?", which is a topic switch rather than a follow-up. The caller
 * separates the two by whether the turn carries any terms of its own, because a
 * reader who names a subject means that subject.
 */
export function isFollowUpShape(question: string): boolean {
  const flat = normalise(question)
  if (!flat) return false
  if (FOLLOWUP_OPENERS.some(opener => flat === opener || flat.startsWith(`${opener} `))) {
    return true
  }
  return flat.split(' ').some(word => REFERENCE_TOKENS.has(word))
}

/**
 * Resolve a turn into a standalone search, using the turns before it.
 *
 * Two cases matter, and they are not the same case:
 *
 *   1. The turn names no subject of its own. "More on that?" carries no
 *      searchable term, so the subject has to come from the transcript. This is
 *      the case the page used to get wrong.
 *   2. The turn names a subject. "And the debt?" is searched for the debt. The
 *      earlier topic is carried as ranking context, not merged into the terms —
 *      merging would quietly turn a question about debt into a question about
 *      debt *and cedi*, and report a partial answer to a question that was
 *      perfectly answerable.
 *
 * A turn with no subject and no usable transcript is reported `unresolved` rather
 * than guessed at, so "who was he?" still routes to /the-man instead of
 * answering a question the reader did not ask.
 */
export function resolveQuestion(
  question: string,
  priorQuestions: string[] = [],
): ConversationState {
  const own = queryTerms(question.slice(0, 500))

  // Earlier turns, most recent first, so the subject in play is the one just
  // discussed rather than the first thing ever asked.
  const prior: string[] = []
  for (let i = priorQuestions.length - 1; i >= 0 && prior.length < ASK_MAX_TERMS; i--) {
    for (const term of queryTerms(priorQuestions[i].slice(0, 500))) {
      if (!prior.includes(term)) prior.push(term)
    }
  }

  const followUpShape = isFollowUpShape(question)

  if (own.length === 0) {
    // An identity question is about the subject, not the material, and inherits
    // nothing — checked before the follow-up path because it looks exactly like
    // one ("who was *he*?").
    if (prior.length > 0 && followUpShape && !isIdentityQuestion(question)) {
      return { kind: 'followup', terms: prior.slice(0, ASK_MAX_TERMS), anchor: prior, context: [] }
    }
    return { kind: 'unresolved', terms: [], anchor: [], context: [] }
  }

  return {
    // "more on that" asked as the very first question is not a follow-up to
    // anything — there is no conversation yet to continue.
    kind: followUpShape && prior.length > 0 ? 'followup' : 'new',
    terms: own,
    anchor: prior,
    context: followUpShape ? prior.filter(term => !own.includes(term)) : [],
  }
}

/** One verbatim passage, with the record it came from. */
export interface PersonaQuote {
  text: string
  title: string
  href: string
  year: number | null
  kindLabel: string
  collectionLabel: string
}

export interface PersonaVoice {
  /** The opening line of the reply. */
  lead: string
  /** Verbatim passages, in rank order. Never synthesised. */
  quotes: PersonaQuote[]
  /** True when the first person appears at all. */
  firstPerson: boolean
}

/**
 * Collections whose text is the subject's own composition, and so can be framed
 * as something he wrote or said.
 *
 * A record can be verbatim and still not be his words. A notice recalling
 * Parliament from recess is authentic archive text, but it is constitutional
 * boilerplate rather than anything the Speaker composed, and putting it under
 * "in my own words" claims an authorship it does not have. So the first-person
 * frame is reserved for address — speeches, papers, interviews, letters — and
 * anything else is described rather than voiced.
 */
const PERSON_KINDS = new Set(['speech', 'paper', 'interview', 'letter'])

/**
 * Records that can be quoted: they carry the subject's own words.
 *
 * `body`, never `excerpt`. An excerpt is editorial copy written *about* a record —
 * "The Speaker's opening remarks on the independence of Parliament", "An
 * interview touching on the duties of the Speaker" — and putting that inside
 * quotation marks under the phrase "in my own words" attributes an archivist's
 * sentence to a living person. Only `body` is verbatim source text, and only a
 * collection that actually stores it is ever eligible.
 */
function quotable(candidate: ScoredCandidate): boolean {
  const { kind, body } = candidate.candidate
  if (!PERSON_KINDS.has(kind.toLowerCase())) return false
  return body.trim().length > 40
}

function describeRecord(candidate: ScoredCandidate): string {
  const { kindLabel, year, title } = candidate.candidate
  const where = year ? ` (${year})` : ''
  return `“${title}”${where}, ${kindLabel.toLowerCase()}`
}

function trimQuote(text: string, max = 260): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  // Prefer a sentence boundary; fall back to a word boundary so a quote is never
  // cut mid-word, which is the one truncation a reader cannot fail to notice.
  const body = lastStop > 60 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, '')
  return `${body}…`
}

/**
 * Compose the opening of a reply, in the Speaker's voice where that is possible
 * without inventing anything.
 *
 * The rule this function exists to enforce: **the first person is always inside
 * quotation marks.** "In my own words, from *Title* (2019), a speech:" makes no
 * claim of its own — it points at a record — and everything after the colon is
 * verbatim. If the best record has no quotable prose (a photograph, a milestone
 * with only a title), the reply drops the first person entirely and describes the
 * record instead, because there is nothing to quote.
 */
export function buildVoice(
  kind: ConversationKind,
  anchor: string[],
  results: ScoredCandidate[],
): PersonaVoice {
  if (results.length === 0) return { lead: '', quotes: [], firstPerson: false }

  const carry =
    kind === 'followup' && anchor.length > 0
      ? `Carrying on from ${anchor.slice(0, 3).map(t => `“${t}”`).join(', ')}. `
      : ''

  const quotable_ = results.filter(quotable)
  const lead = results[0]

  // No quotable prose anywhere: describe the record rather than put words in it.
  if (quotable_.length === 0) {
    return {
      lead: `${carry}The archive's closest record is ${describeRecord(lead)}.`,
      quotes: [],
      firstPerson: false,
    }
  }

  const quotes: PersonaQuote[] = quotable_.slice(0, 3).map(r => ({
    text: trimQuote(r.candidate.body.trim()),
    title: r.candidate.title,
    href: r.candidate.href,
    year: r.candidate.year,
    kindLabel: r.candidate.kindLabel,
    collectionLabel: r.candidate.collectionLabel,
  }))

  const first = quotes[0]
  const firstWhere = first.year ? ` (${first.year})` : ''
  let opening = `${carry}In my own words, from “${first.title}”${firstWhere}, ${first.kindLabel.toLowerCase()}:`

  // Two or more real passages: the second is signposted so the reply reads as a
  // considered position across records rather than one quote with an appendix.
  if (quotes.length > 1) {
    opening += ` And again in “${quotes[1].title}”:`
  }

  return { lead: opening, quotes, firstPerson: true }
}

/**
 * A record title short enough to read inside a suggested question.
 *
 * Scraper headlines run long and often end in a site name and a date — "Bagbin
 * elected President of African Anti-Corruption Network - CitiNewsroom.com - 9
 * Nov 2025". That trailing clause carries no subject matter, so it goes first;
 * anything still over length is cut on a word boundary rather than mid-word.
 */
function shortTitle(title: string, limit = 50): string {
  const clean = title.trim()
  if (clean.length <= limit) return clean
  const head = clean.split(/\s[-,;:—–]\s| - /)[0].trim()
  if (head.length <= limit) return head
  const cut = clean.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, '')}…`
}

/**
 * Follow-up questions built from the records that were actually returned.
 *
 * The previous suggestions were ranked from the archive's global themes, so they
 * were the same four chips on every single answer — which teaches the reader that
 * they are a fixed menu rather than a next step. A suggestion derived from the
 * result is a question this answer has actually made possible.
 */
export function suggestionsFromResult(
  results: ScoredCandidate[],
  matchedTerms: string[],
  asked: string,
  limit = 3,
): string[] {
  const out: string[] = []
  const push = (q: string) => {
    const clean = q.trim()
    if (!clean) return
    if (clean.toLowerCase() === asked.trim().toLowerCase()) return
    if (out.some(existing => existing.toLowerCase() === clean.toLowerCase())) return
    out.push(clean)
  }

  const top = results[0]?.candidate
  const topic = matchedTerms[0]

  // The record that led is the most likely thing to want more of.
  if (top) {
    push(`What else is in the archive on “${shortTitle(top.title)}”?`)
  }

  // A second term that matched something is a real, answerable branch.
  const other = matchedTerms[1]
  if (other && other !== topic) {
    push(`What did he say about “${other}”?`)
  }

  // Narrow back down to the collection the answer came from.
  if (top && !out.length) {
    push(`More from the ${top.collectionLabel.toLowerCase()}`)
  }

  // The two adjacent shapes of question this corpus can answer well.
  if (results.length > 0) {
    push('What is on the timeline around this?')
  }
  if (top && /speech|paper|interview|note/i.test(top.kindLabel)) {
    push('What have others said about this?')
  }

  return out.slice(0, limit)
}
