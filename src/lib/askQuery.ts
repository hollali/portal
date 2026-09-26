/**
 * Query parsing for the /ask archive search.
 *
 * The archive used to be searched with a single `contains` filter against the
 * whole user sentence, which is an `ILIKE '%entire question%'` and therefore
 * matched almost nothing. These helpers reduce a natural-language question to
 * the terms that actually discriminate, so the caller can build an AND-of-ORs
 * clause and fall back to a looser OR when nothing satisfies every term.
 */

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'find', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'key',
  'me', 'more', 'most', 'my',
  'no', 'nor', 'not', 'now',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'out', 'over', 'own',
  'please', 'same', 'say', 'said', 'says', 'she', 'should', 'show', 'so', 'some', 'such',
  'tell', 'than', 'that', 'the', 'their', 'theirs', 'them', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'upon', 'us',
  'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'will', 'with', 'would', 'you', 'your', 'yours',
  // Near-universal within this corpus: present in almost every record, so they
  // add no discriminating power and would break a strict AND.
  //
  // The subject's full name belongs here too, and measurably so: every one of
  // the 430 published videos, 254 audio rows and 134 news clippings carries
  // "Alban Sumana Kingsford Bagbin" in its title, and all 283 photographs carry
  // nothing but that name in their scrape query. Searching any of those tokens
  // returned ~250 "matches" that were really just the subject's own name, and
  // the top of the list was scraper noise. A name question now reduces to no
  // searchable terms, which the page answers by routing to /the-man — a better
  // answer than ten headline cards that all contain the same three words.
  'bagbin', 'alban', 'sumana', 'kingsford',
  'parliament', 'parliamentary', 'speaker', 'speech', 'speeches', 'archive', 'library', 'document',
  // Question framing rather than subject matter. These survive ordinary
  // stopwording and were being treated as search terms, which forced an AND
  // down to the loose `any` path — e.g. "the Speaker's position on X" matched
  // the word "position" and reported a partial answer for a good question.
  'happen', 'happens', 'happened', 'position', 'positions', 'view', 'views', 'opinion',
  'opinions', 'much', 'many', 'lot', 'lots', 'currently', 'today', 'recently', 'recent',
  'tells', 'told', 'give', 'gives', 'given', 'want', 'wants', 'need', 'needs', 'know',
])

/** Words that should also be tried when a term appears, to bridge vocabulary gaps. */
const ALIASES: Record<string, string[]> = {
  digitalisation: ['digital'],
  digitization: ['digital'],
  digitalised: ['digital'],
  computerized: ['digital'],
  computerisation: ['digital'],
}

export const ASK_MAX_TERMS = 6

function foldPlural(term: string): string | null {
  if (term.length > 4 && term.endsWith('ies')) return `${term.slice(0, -3)}y`
  if (term.length > 4 && term.endsWith('es') && !term.endsWith('ses')) return term.slice(0, -2)
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1)
  return null
}

/**
 * Suffixes worth folding, longest first so `ations` is not eaten as `ation`.
 *
 * Deliberately conservative: no `ly`, no `tional`/`ational` (which would over-stem
 * already-equivalent forms), and nothing that can turn a stem into a different
 * word. The result is only ever used as a *prefix*, so the risk of a short stem
 * is bounded — see `matchTerm` in askSearch.
 */
const SUFFIXES = [
  'ations', 'ation', 'ments', 'ment', 'nesses', 'ness', 'ities', 'ity',
  'ances', 'ance', 'ences', 'ence', 'ions', 'ion', 'ings', 'ing', 'ers', 'ed',
]

/** A folded stem has to stay long enough to stay specific. */
const MIN_STEM = 4

/**
 * Collapse a regular English suffix to the shared root, e.g.
 * `independence` -> `independ` (so `independent` is also found) and
 * `corruption` -> `corrupt` (so `corrupt` and `corruption` share a term).
 *
 * Returns null when the word is too short to fold safely.
 */
export function foldSuffix(term: string): string | null {
  for (const suffix of SUFFIXES) {
    if (!term.endsWith(suffix) || term.length - suffix.length < MIN_STEM) continue
    const stem = term.slice(0, -suffix.length)
    // Never fold to something that isn't a prefix of the original: the stem is
    // matched as a prefix, so "ed" on "united" giving "unit" is fine, but a fold
    // that changes the first letter would silently match unrelated words.
    if (stem !== term && term.startsWith(stem)) return stem
  }
  return null
}

/** Every surface form worth trying in the database for a single query term. */
export function termVariants(term: string): string[] {
  const out = new Set<string>([term])
  const singular = foldPlural(term)
  if (singular) out.add(singular)
  const folded = foldSuffix(term)
  if (folded) out.add(folded)
  for (const alias of ALIASES[term] ?? []) out.add(alias)
  return [...out]
}

/**
 * Reduce a free-text question to the terms that carry meaning.
 * Punctuation, stopwords and duplicates are removed; the order of first
 * appearance is preserved so the most meaningful words lead.
 */
export function queryTerms(input: string, max = ASK_MAX_TERMS): string[] {
  const words = input
    .toLowerCase()
    .replace(/['\u2019]s\b/g, '')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)

  const out: string[] = []
  const seen = new Set<string>()
  for (const word of words) {
    if (word.length < 3) continue
    if (STOPWORDS.has(word)) continue
    if (seen.has(word)) continue
    seen.add(word)
    out.push(word)
    if (out.length >= max) break
  }
  return out
}

export const ASK_SUGGESTIONS = [
  'What has the Speaker said about democracy?',
  'What are the key speeches on parliamentary independence?',
  'Find the notice recalling Parliament',
  'What has been said about education and the youth?',
  'Speeches on health and social protection',
  "What is the Speaker's position on digitalisation?",
]

export interface AskCitation {
  kind: string
  kindLabel: string
  /** Which collection the record came from, e.g. `documents`, `videos`. */
  collection: string
  collectionLabel: string
  title: string
  href: string
  year: number | null
  excerpt: string | null
  hasTranscript: boolean
  /**
   * The query terms this record actually matched. Absent from the answer means
   * the ranking is a black box, so it travels with every citation.
   */
  matched: string[]
}

export interface AskTimelineEntry {
  year: string | null
  title: string
}

export interface AskTestimonial {
  quote: string
  author: string
  role: string | null
}

/** `all` = every term matched; `any` = the AND pass found nothing, relaxed to OR. */
export type AskMatchMode = 'all' | 'any' | 'none'

/** How many matches a single collection contributed to one answer. */
export interface AskCollectionCount {
  collection: string
  label: string
  /**
   * Records in this collection that satisfy the same bar the results were
   * selected under — every term, or at least one, depending on the mode. Counted
   * by the database, not by the rows that happened to be fetched.
   */
  count: number
  /**
   * Records matching at least one term, reported only when it is the larger
   * number. 3 records covering your whole question and 1,340 that each mention
   * a piece of it are not the same claim, and the count should not blur them.
   */
  broader?: number
}

export interface AskResult {
  summary: string
  terms: string[]
  match: AskMatchMode
  citations: AskCitation[]
  timeline: AskTimelineEntry[]
  testimonials: AskTestimonial[]
  /** Breadth of the answer: which collections it drew on, and how often. */
  collectionCounts: AskCollectionCount[]
  /**
   * Every term that matched something anywhere in the archive, deduplicated
   * across all records. The client highlights against this rather than
   * against `terms`, so a term that found nothing is never marked as if it had.
   */
  matchedTerms: string[]
  /** Terms no published record covers — the honest limit of a partial answer. */
  unmatched: string[]
  /**
   * How many records the search reached, counted in the database rather than
   * from the rows we happened to fetch. Used for "N more not shown", so it has
   * to be the real total and not the size of the candidate pool.
   */
  totalMatched: number
  /**
   * How many records mention at least one term, when that is more than
   * `totalMatched`. Present only for a partial answer, where the gap between the
   * two is the honest limit of what the archive can say.
   */
  broaderMatched?: number
  suggested: string[]
}
