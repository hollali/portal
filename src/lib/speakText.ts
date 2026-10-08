import type { AskCitation, AskResult } from './askQuery'

/**
 * Turning an answer into something the guide may say out loud.
 *
 * The rule this file exists to enforce: the guide only ever voices a *verbatim
 * excerpt from a stored record*, introduced in the third person, or one of the
 * short guide lines in `guideLines.ts`. It never answers a question in the
 * Speaker's voice, never speaks in the first person on its own authority, and
 * never reads anything generated.
 *
 * That is why this is a function of one `AskCitation` and nothing else. It has
 * no access to `AskResult.reading` — the field reserved for a model's own
 * interpretation of records — so generated text cannot reach the guide's mouth
 * even if the API starts populating it. Adding a model to /ask later is not
 * allowed to change what this function can say.
 */

/**
 * Longest excerpt the guide will read before the visitor loses the thread.
 *
 * Roughly twenty seconds of speech. A full paragraph read at conversational
 * pace is past the point where a visitor still remembers which record they were
 * being shown, and the citation card is always on screen underneath anyway —
 * the guide is a narrator, not a replacement for the text.
 */
export const MAX_QUOTE_CHARS = 260

/**
 * First-person pronouns, which may only ever appear inside a verbatim quote.
 *
 * Also used as a scrubber on the *labels* that build the introduction: those
 * come out of the database, so a stray or poisoned row could otherwise put
 * "I" into a sentence the guide speaks as its own.
 */
const FIRST_PERSON = /\b(i|me|my|mine|myself|we|us|our|ours|ourselves|am|i'?m|i'?ve|i'?ll|i'?d)\b/gi

/**
 * Removes first-person pronouns from a label.
 *
 * Only ever applied to taxonomy we control (`kindLabel`, `collectionLabel`).
 * Titles are *not* scrubbed: a title is a quotation of a bibliographic record,
 * and silently editing it would be a worse lie than the one it prevents.
 * Titles never enter the spoken lead at all — see `buildSpeakCitation`.
 */
function scrubFirstPerson(label: string): string {
  return label.replace(FIRST_PERSON, '').replace(/\s{2,}/g, ' ').trim()
}

/** Collapses the whitespace that survives `plainText()` on some rows. */
function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Cuts an excerpt at a sentence end where one is close enough to be worth
 * waiting for, and at a word boundary otherwise.
 *
 * The trailing ellipsis is not decoration. A truncated quotation that ran out
 * mid-sentence without one would read as the whole of what he said.
 */
export function trimExcerpt(excerpt: string, limit = MAX_QUOTE_CHARS): string {
  const text = tidy(excerpt)
  if (text.length <= limit) return text

  const cut = text.slice(0, limit)

  // Prefer closing a sentence we can actually finish, but only if doing so does
  // not throw away most of what we have room for.
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  if (lastStop > limit * 0.6) return `${cut.slice(0, lastStop + 1).trim()}…`

  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

export interface SpeakCitation {
  /** The introduction, spoken in the third person. Never contains a title. */
  lead: string
  /** The verbatim excerpt, introduced as a quotation. `null` if there is none. */
  quote: string | null
  /** The record the excerpt came from. Shown as a caption, never spoken. */
  source: string | null
  href: string | null
  year: number | null
}

/**
 * The guide's introduction for one citation, built only from words we wrote.
 *
 * The record's *title* is deliberately kept out of the spoken line. It is the
 * one field free to contain a first-person phrase — a speech genuinely titled
 * "Why I Would Resign" exists — and pasting that into a sentence the guide
 * speaks about himself is exactly the ambiguity the labelling rules exist to
 * prevent. The title goes in the caption instead, where quotation marks make it
 * unambiguous.
 */
export function buildSpeakCitation(citation: AskCitation | null | undefined): SpeakCitation | null {
  if (!citation) return null

  const excerpt = citation.excerpt ? trimExcerpt(citation.excerpt) : ''
  const year = typeof citation.year === 'number' && Number.isFinite(citation.year) ? citation.year : null

  if (!excerpt) {
    // A record with no text to read — a photograph, a video with no transcript —
    // is played or shown, never paraphrased by the guide. Returning null is what
    // keeps the guide silent over it.
    return { lead: '', quote: null, source: citation.title || null, href: citation.href || null, year }
  }

  const kind = scrubFirstPerson(citation.kindLabel || citation.collectionLabel || '')
  const what = kind ? ` ${kind.toLowerCase()} record` : ' record'
  const when = year === null ? '' : ` dated ${year}`

  return {
    lead: `From a${what}${when}, the Speaker is quoted:`,
    quote: excerpt,
    source: citation.title || null,
    href: citation.href || null,
    year,
  }
}

/**
 * The one line the guide reads for a citation, or `''` when it should say
 * nothing at all.
 *
 * Assembled here rather than in the component so the sentence can be asserted
 * on directly: a test that the guide never speaks in the first person on its own
 * authority is only meaningful if the whole line is one function's return value.
 */
export function buildSpeakText(citation: AskCitation | null | undefined): string {
  const built = buildSpeakCitation(citation)
  if (!built || !built.quote) return ''
  return `${built.lead} "${built.quote}"`
}

/**
 * The line for an answer's strongest citation.
 *
 * `reading` is not consulted and cannot be. See the note at the top of this file:
 * the guide is a presenter, and the only words it may present are the ones a
 * record already contains.
 */
export function speakableForResult(result: AskResult | null | undefined): SpeakCitation | null {
  return buildSpeakCitation(result?.citations?.[0])
}