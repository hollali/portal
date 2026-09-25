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
  'bagbin', 'parliament', 'speaker', 'speech', 'speeches', 'archive', 'library', 'document',
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

/** Every surface form worth trying in the database for a single query term. */
export function termVariants(term: string): string[] {
  const out = new Set<string>([term])
  const singular = foldPlural(term)
  if (singular) out.add(singular)
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
  title: string
  href: string
  year: number | null
  excerpt: string | null
  hasTranscript: boolean
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

export interface AskResult {
  summary: string
  terms: string[]
  match: AskMatchMode
  citations: AskCitation[]
  timeline: AskTimelineEntry[]
  testimonials: AskTestimonial[]
  suggested: string[]
}
