/**
 * Term highlighting for /ask.
 *
 * The archive answers by keyword match, so the most useful thing it can show a
 * reader is *which words in a citation actually did the matching*. Without
 * that, a result list is a black box: the reader has to guess why a photo about
 * an inauguration was returned for a question about the youth.
 *
 * The text is split into plain segments and rendered as `<mark>` elements by the
 * caller rather than injected as HTML. Titles and excerpts here are partly
 * scraped from news sites, so string-concatenated markup would be a hole.
 */

import { termVariants } from '@/lib/askQuery'

/** One run of text: `match` marks the runs the reader's terms landed on. */
export interface HighlightSegment {
  text: string
  match: boolean
}

/** A long title should not spend a whole line on repeated occurrences. */
const MAX_MATCHES = 12

/**
 * Terms are restricted to word characters. `queryTerms` already produces this
 * shape, but highlighting is also fed persisted history and future callers, and
 * a `\b` around a term ending in punctuation anchors to the wrong place — so
 * anything else is dropped rather than guessed at.
 */
function usableTerms(terms: string[]): string[] {
  const out = new Set<string>()
  for (const term of terms) {
    // Expanded, because the record matched the *variant*, not the term the
    // reader typed. Asking about "digitalisation" can surface a record that
    // only ever says "digital", and a chip reading `matched: digitalisation`
    // beside unhighlighted text is a claim the page cannot back up.
    for (const variant of termVariants(term)) {
      const clean = variant.trim().toLowerCase()
      if (/^[a-z0-9]+$/.test(clean)) out.add(clean)
    }
  }
  // Longest first so "digitalisation" consumes its span before the shorter
  // "digital" alias can split it into two overlapping highlights.
  return [...out].sort((a, b) => b.length - a.length || a.localeCompare(b))
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Split `text` into alternating plain and matched runs. Longest term wins a
 * contested span, and highlighting stops after `MAX_MATCHES` so a scraped
 * article that repeats a word thirty times does not render thirty marks.
 *
 * The pattern is anchored to a word *start* and deliberately has no trailing
 * boundary, which is the same rule `matchTerm` in askSearch applies when it
 * decides whether a record matched at all. Two consequences, both wanted:
 *
 *  - a record that matched "parliament" through "parliamentary" shows that word
 *    marked, so the chip beside it is not a claim the page cannot back up;
 *  - a term is never marked inside a longer word, so "art" stays unmarked in
 *    "Part" and "start" — the same rule that keeps those records out of the
 *    results in the first place.
 */
export function highlightTerms(text: string, terms: string[]): HighlightSegment[] {
  if (!text) return []

  const usable = usableTerms(terms)
  if (usable.length === 0) return [{ text, match: false }]

  // Lookbehind rather than a consumed boundary character: Postgres, which does
  // the same matching in `sqlPattern`, has no lookbehind and has to consume the
  // boundary, so a consumed form here would swallow the space in front of every
  // mark. Both forms accept exactly the same strings.
  const pattern = new RegExp(`(?<![a-zA-Z0-9])(?:${usable.map(escapeRe).join('|')})`, 'gi')

  const segments: HighlightSegment[] = []
  let cursor = 0
  let hits = 0
  let found: RegExpExecArray | null

  while ((found = pattern.exec(text)) !== null) {
    if (hits >= MAX_MATCHES) break
    if (found[0].length === 0) {
      pattern.lastIndex += 1
      continue
    }
    if (found.index > cursor) {
      segments.push({ text: text.slice(cursor, found.index), match: false })
    }
    segments.push({ text: found[0], match: true })
    cursor = found.index + found[0].length
    hits += 1
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false })
  return segments.length > 0 ? segments : [{ text, match: false }]
}

/** The matched runs only — used for the "why this matched" chips on a citation. */
export function matchedWords(text: string, terms: string[]): string[] {
  const seen = new Set<string>()
  for (const segment of highlightTerms(text, terms)) {
    if (segment.match) seen.add(segment.text.toLowerCase())
  }
  return [...seen]
}
