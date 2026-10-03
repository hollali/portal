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

  // Ordinals. A reader asking about "the Fourth Republic" is asking about
  // `video-fourth-republic`, whose title writes the ordinal as "4th" — and a
  // LIKE on the spelled form finds nothing, so the answer degraded to an
  // unrelated document rather than admitting the record was not found. Both
  // directions are needed: "4th Republic" in a question has to reach
  // "Fourth Republic" in a body just as often.
  fourth: ['4th'],
  '4th': ['fourth'],
  third: ['3rd'],
  '3rd': ['third'],
  second: ['2nd'],
  '2nd': ['second'],
  first: ['1st'],
  '1st': ['first'],
  fifth: ['5th'],
  '5th': ['fifth'],
  sixth: ['6th'],
  '6th': ['sixth'],
  seventh: ['7th'],
  '7th': ['seventh'],
  eighth: ['8th'],
  '8th': ['eighth'],
  ninth: ['9th'],
  '9th': ['ninth'],
  tenth: ['10th'],
  '10th': ['tenth'],
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

export type AskCollectionName = keyof typeof ASK_COLLECTION_LABELS

/** What each collection is called on the public site, and in an answer about it. */
export const ASK_COLLECTION_LABELS = {
  documents: 'Archive documents',
  photos: 'Photographs',
  videos: 'Videos',
  audio: 'Audio',
  news: 'News',
  milestones: 'Milestones',
  testimonials: 'Testimonials',
} as const

/**
 * Collections a reader can name by name, and the words that name them.
 *
 * This archive has pages called Milestones, Testimonials, News and Videos, and a
 * reader who types one of those words is pointing at a collection, not at a
 * subject to be found inside every collection. Treated as a subject instead, "what
 * are the milestones from the 1990s?" searched every record for the *word*
 * "milestones" — and the four milestones that decade actually holds do not contain
 * it, so the answer was empty.
 *
 * The list is deliberately short and consists of words that name a collection on
 * this site and are not ordinary subject matter. It is not a synonyms table:
 *
 *   - "speeches", "statements", "press", "recordings" are absent even though they
 *     sound like collections here. "Press" and "recordings" are ordinary English
 *     that a reader can mean as a subject — "what is his position on press
 *     freedom" is a real question — and filtering it away to clippings would
 *     answer a different question than the one asked.
 *   - "archive documents" is present because the page is called exactly that.
 *
 * Two collections can be named at once, and are then both searched: "any videos or
 * photographs of the swearing-in?".
 */
const COLLECTION_WORDS: Record<string, string> = {
  milestones: 'milestones',
  milestone: 'milestones',
  timeline: 'milestones',
  testimonials: 'testimonials',
  testimonial: 'testimonials',
  videos: 'videos',
  video: 'videos',
  audio: 'audio',
  news: 'news',
  clippings: 'news',
  'news clippings': 'news',
  documents: 'documents',
  'archive documents': 'documents',
  photos: 'photos',
  photographs: 'photos',
  photograph: 'photos',
}

/**
 * Split a question's terms into the collections it names and the rest.
 *
 * The named word is *removed*, not merely repeated: leaving "milestones" in the
 * terms would require every record returned to contain the word in its own text,
 * which is the behaviour that made the question return nothing.
 */
export function collectionFilter(terms: string[]): { collections: string[]; terms: string[] } {
  const collections: string[] = []
  const rest: string[] = []
  for (const term of terms) {
    const collection = COLLECTION_WORDS[term] ?? COLLECTION_WORDS[`${term}s`]
    if (collection) {
      if (!collections.includes(collection)) collections.push(collection)
      continue
    }
    rest.push(term)
  }
  return { collections, terms: rest }
}

/**
 * Why a collection cannot answer a question, in one sentence.
 *
 * The photograph library is browsable and searchable but is not an answer: all 283
 * rows are uncaptioned and undated, so the only text a match could come from is the
 * scrape query its own photographer's name was typed into, and the card would be
 * titled with a search string rather than with anything about the picture.
 */
export const NOT_ANSWERABLE_COLLECTIONS: Record<string, string> = {
  photos: 'every photograph is uncaptioned and undated, so it can only match its own scrape query',
}

/** Where a reader goes instead for a collection that cannot answer questions. */
export const COLLECTION_PAGES: Record<string, string> = {
  photos: '/archives/photos',
  videos: '/videos',
  audio: '/media?type=audio',
  news: '/news',
  documents: '/archives',
  milestones: '/archives/milestones',
  testimonials: '/archives/testimonials',
}

/**
 * The collections a question named, in the words a reader would recognise.
 *
 * Shown above the cards for the same reason the window is: every record below was
 * chosen under a filter, and a reader who cannot see the filter reads a narrowing
 * as the archive's whole contents.
 */
/**
 * The collections a reader named that cannot answer, said plainly.
 *
 * Wording shared with the client so the sentence above the cards and the sentence in
 * the summary cannot drift apart, which is the way an answer starts contradicting
 * itself.
 */
export function describeUnsearchable(collections: string[]): string {
  if (collections.length === 0) return ''
  const labels: Record<string, string> = ASK_COLLECTION_LABELS
  const names = collections.map(c => labels[c] ?? c)
  // "Photographs" is plural and "Archive documents" is not, so agreement follows the
  // label rather than the number of collections named.
  const plural = collections.length > 1 || /s$/.test(names[0])
  const reason = NOT_ANSWERABLE_COLLECTIONS[collections[0]]
  return (
    `${names.join(' and ')} ${plural ? 'are' : 'is'} held but not searched — ${reason}. ` +
    `${plural ? 'They are' : 'It is'} browsable at ${COLLECTION_PAGES[collections[0]]}.`
  )
}

export function describeCollections(collections: string[]): string {
  if (collections.length === 0) return ''
  const labels: Record<string, string> = ASK_COLLECTION_LABELS
  const names = collections.map(c => labels[c] ?? c)
  if (names.length === 1) return `Restricted to ${names[0]}.`
  return `Restricted to ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`
}

/**
 * Reduce a free-text question to the terms that carry meaning.
 *
 * Punctuation, stopwords and duplicates are removed; the order of first
 * appearance is preserved so the most meaningful words lead.
 *
 * A year the question names is not one of those terms. It is a filter on a date
 * column, applied by `collectCandidates`, and leaving it in made "what happened
 * in 2024?" depend on some record happening to spell that year in its own text —
 * a question about a window answered by a coincidence about a word. The years are
 * read off the same `parsePeriod` the search uses, so the terms and the filter can
 * never disagree about which years were asked for.
 */
export function queryTerms(input: string, max = ASK_MAX_TERMS): string[] {
  const words = input
    .toLowerCase()
    .replace(/['\u2019]s\b/g, '')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean)

  const period = parsePeriod(input)
  const years = new Set(periodYears(period))
  // The word that introduced the window is part of the window, not the question.
  // "since 2021" was searching the archive for the word "since".
  const periodWords = period
    ? new Set(['between', 'since', 'after', 'before', 'until', 'prior', 'from'])
    : new Set<string>()
  // A decade is written differently from the bounds it stands for: the question
  // says "1990s" and the window is 1990–1999, so comparing the words against
  // `periodYears` leaves "1990s" behind as a topic term and the decade search
  // quietly becomes a search for the word "1990s".
  //
  // Only a decade the window actually covers is consumed. A question that names
  // two — "the 1990s and the 1980s" — is answered for one of them, and dropping
  // both tokens would erase the one that is being ignored instead of showing it.
  const spanStart = period?.from ?? Number.NEGATIVE_INFINITY
  const spanEnd = period?.to ?? Number.POSITIVE_INFINITY
  const coveredDecade = (word: string): boolean => {
    const start = /^(\d{4})s$/.exec(word)
    if (!start) return false
    // The decade counts as covered when any part of it falls in the window,
    // which is what "since 1985" means of the 1980s.
    return Number(start[1]) <= spanEnd && Number(start[1]) + 9 >= spanStart
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const word of words) {
    if (word.length < 3) continue
    if (STOPWORDS.has(word)) continue
    if (years.has(word)) continue
    if (periodWords.has(word)) continue
    if (period && coveredDecade(word)) continue
    if (seen.has(word)) continue
    seen.add(word)
    out.push(word)
    if (out.length >= max) break
  }
  return out
}

/**
 * A period of time the reader asked about, resolved to years.
 *
 * `/ask` is deterministic: it can only show records it finds, so "what changed
 * between 2020 and 2023?" has to become a filter on a column rather than a
 * sentence about change. That means the period has to be read off the question
 * before the search runs, not inferred from what came back — a filter chosen
 * after the fact is a filter chosen to agree with the answer.
 *
 * Relative periods ("last year", "recently", "in recent years") are deliberately
 * not parsed. The archive stores the date a clipping was published, not the date
 * it describes, and "recently" resolved against the server's clock would silently
 * mean something different tomorrow. A question that says "recently" gets an
 * ordinary keyword search and an answer drawn from whatever the archive holds,
 * which is at least a fact about the archive rather than an invented window.
 */
export interface AskPeriod {
  /**
   * First year of the window, inclusive; `null` when the reader only gave an end
   * ("before 2015"). A sentinel like 1900 would be a claim about the archive's
   * oldest record, and the archive's oldest record is not the subject of the
   * question.
   */
  from: number | null
  /** Last year of the window, inclusive; `null` for an open end ("since 2020"). */
  to: number | null
  /** The words that produced this window, for the sentence that reports it. */
  label: string
}

/**
 * Plausible years, and the reason the range is narrow.
 *
 * A clipping of the Fourth Republic is recent, but the archive also holds the
 * years before it, so the window is wide enough for "in the nineties" and narrow
 * enough that "Article 24" is never read as a date. Reading 1965 as a year is
 * harmless; reading "24" as one would turn a question about Article 24 of the
 * Constitution into a search for the year 24.
 */
const EARLIEST_YEAR = 1900
const LATEST_YEAR = 2100

const DECADES: Array<[RegExp, number]> = [
  [/\b(19|20)20s\b/, 20],
  [/\b(19|20)30s\b/, 30],
  [/\b(19|20)40s\b/, 40],
  [/\b(19|20)50s\b/, 50],
  [/\b(19|20)60s\b/, 60],
  [/\b(19|20)70s\b/, 70],
  [/\b(19|20)80s\b/, 80],
  [/\b(19|20)90s\b/, 90],
  [/\b(19|20)00s\b/, 0],
  [/\b(19|20)10s\b/, 10],
]

/** A four-digit year, with the century the archive actually covers. */
function yearIn(raw: string): number | null {
  if (!/^\d{4}$/.test(raw)) return null
  const year = Number(raw)
  return year >= EARLIEST_YEAR && year <= LATEST_YEAR ? year : null
}

/**
 * The first year mentioned, so `between 2019 and 2021` and `since 2019` agree on
 * what "the year in question" is even when the reader wrote a second one.
 */
function firstYear(input: string): number | null {
  const match = input.match(/\b(\d{4})\b/)
  return match ? yearIn(match[1]) : null
}

const DECADE_WORDS: Array<[RegExp, number]> = [
  [/\b(?:the )?twenties\b/, 1920],
  [/\b(?:the )?thirties\b/, 1930],
  [/\b(?:the )?forties\b/, 1940],
  [/\b(?:the )?fifties\b/, 1950],
  [/\b(?:the )?sixties\b/, 1960],
  [/\b(?:the )?seventies\b/, 1970],
  [/\b(?:the )?eighties\b/, 1980],
  [/\b(?:the )?nineties\b/, 1990],
  [/\b(?:the )?two thousands\b/, 2000],
  [/\b(?:the )?twenty tens\b/, 2010],
]

/** A decade written as a word rather than digits: "the nineties". */
function decadeIn(input: string): { from: number; to: number; label: string } | null {
  for (const [pattern, from] of DECADE_WORDS) {
    if (pattern.test(input)) return { from, to: from + 9, label: `the ${from}s` }
  }
  for (const [pattern, offset] of DECADES) {
    const match = input.match(pattern)
    if (!match) continue
    const century = Number(match[1])
    const from = century * 100 + offset
    return { from, to: from + 9, label: `the ${from}s` }
  }
  return null
}

/**
 * Read a period off a question, or return null when it names none.
 *
 * The order of the checks is the order of specificity: a bounded window
 * ("between 2019 and 2021") beats an open one ("since 2019"), which beats a bare
 * year ("in 2024"), because a reader who gave two years meant both of them. A
 * question with no year in it is the common case and costs one regex that fails.
 */
export function parsePeriod(input: string): AskPeriod | null {
  const text = input.toLowerCase().trim()
  if (!text) return null

  // "between 2019 and 2021", "from 2019 to 2021", "2019-2021"
  const range = text.match(/\b(?:between|from)\s+(\d{4})\s*(?:and|to|–|-|—)\s*(\d{4})\b/)
  if (range) {
    const a = yearIn(range[1])
    const b = yearIn(range[2])
    if (a !== null && b !== null) {
      const [from, to] = a <= b ? [a, b] : [b, a]
      return { from, to, label: `${from}–${to}` }
    }
  }
  const hyphenRange = text.match(/\b(\d{4})\s*[–—-]\s*(\d{4})\b/)
  if (hyphenRange) {
    const a = yearIn(hyphenRange[1])
    const b = yearIn(hyphenRange[2])
    if (a !== null && b !== null) {
      const [from, to] = a <= b ? [a, b] : [b, a]
      return { from, to, label: `${from}–${to}` }
    }
  }

  // "since 2019", "after 2019", "from 2019 onwards"
  const since = text.match(/\b(?:since|after|from)\s+(\d{4})\b/)
  if (since) {
    const from = yearIn(since[1])
    if (from !== null) return { from, to: null, label: `since ${from}` }
  }

  // "before 2019", "up to 2019", "prior to 2019"
  const before = text.match(/\b(?:before|up to|prior to|until)\s+(\d{4})\b/)
  if (before) {
    const to = yearIn(before[1])
    if (to !== null) return { from: null, to: to - 1, label: `before ${to}` }
  }

  const decade = decadeIn(text)
  if (decade) return decade

  // A bare four-digit year, and only where it reads as a date. "2020" in a
  // question about elections is a year; the same digits inside a longer number
  // are not, which is why the boundary before and after are both required to be
  // non-digits — "\b" alone would match the tail of "12020".
  const bare = text.match(/(?:^|[^\d])(19\d{2}|20\d{2})(?:[^\d]|$)/)
  if (bare && firstYear(text) === Number(bare[1])) {
    return { from: Number(bare[1]), to: Number(bare[1]), label: String(bare[1]) }
  }

  return null
}

/**
 * The four-digit years a period consumed, so they can be kept out of the search
 * terms. A year is a filter on a column, not a topic to match against a title:
 * leaving "2024" in the terms made the archive answer "what happened in 2024?"
 * only if some record happened to spell that year in its own text.
 */
export function periodYears(period: AskPeriod | null): string[] {
  if (!period) return []
  // Only the bounds the reader wrote. A window is two centuries wide when one end
  // is open, and sweeping that into the search terms would bury the question
  // under years nobody asked about.
  // A single year is both bounds, and listing it twice would put it in the
  // dropped-term list twice for no gain.
  return [...new Set([period.from, period.to].filter((year): year is number => year !== null).map(String))]
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
  /**
   * The page this record was taken from, when the archive has one.
   *
   * An answer that sends a reader to our rendering of a clipping has taken the
   * evidence away from the party that published it. The archive's own page is
   * where a record *lives*; this is where it came *from*, and the reader is told
   * which is which.
   */
  url?: string | null
  /** The publication a clipping came from, shown beside the link to it. */
  sourceName?: string | null
  /**
   * The aggregator a clipping was found through, when the row names one instead
   * of a paper. Carried so the card can say "via Google News" — the difference
   * between the publisher and the way round to the publisher.
   */
  via?: string | null
  /**
   * Where the archive's own captured copy of the page can be read, when it holds
   * one. A scraper stored the HTML it fetched, which is the only version that
   * survives the paper changing or deleting the page later.
   */
  captureHref?: string
}

export interface AskTimelineEntry {
  year: string | null
  title: string
  /** Where the milestone sits in the archive, so the reader can go and read it. */
  href?: string
}

export interface AskTestimonial {
  quote: string
  author: string
  role: string | null
  /** Where the testimonial sits in the archive, for the same reason as a milestone. */
  href?: string
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
  /**
   * How this turn related to the turns before it, and the persona opening.
   *
   * Absent for answers that never reached a search — corpus counts, and turns
   * with no subject to resolve.
   */
  conversation?: AskConversation
  /**
   * The window of years this answer was restricted to, when the reader named one.
   *
   * The client shows it above the cards because every record below it was chosen
   * under a filter, and a reader who cannot see the filter will read a 2026
   * clipping as evidence about 2021.
   */
  period?: AskPeriod
  /**
   * Collection labels excluded from a dated answer because they store no date.
   *
   * Named rather than omitted: "nothing before 2020" and "684 recordings, none of
   * them dated" are different facts, and only one of them is what the archive can
   * actually support.
   */
  undated?: string[]
  /** Collections the question named, when it restricted the search to some. */
  collections?: string[]
  /** Named collections the archive holds but does not search for answers. */
  unsearchable?: string[]
  /**
   * A reading of the records, as distinct from the records themselves.
   *
   * Absent unless something generated it, and marked `generated: true` when
   * present so no reader or downstream client can mistake an interpretation for a
   * quotation. `/ask` builds every sentence it shows from stored text, so today
   * this is always absent — it exists so that adding a model later cannot quietly
   * change what an unlabelled field means.
   */
  reading?: AskReading
}

/**
 * The one sentence that says what a dated answer was filtered by.
 *
 * Shared with the client on purpose. If the server says "2021–2023" in the
 * summary and the client renders "since 2021" above the same cards, the reader is
 * being told two different things about the same ten records, and there is no way
 * to tell which one chose them.
 */
export type WindowMode = 'shown' | 'filtered' | 'empty'

/**
 * The one sentence that says what a dated answer was filtered by.
 *
 * Shared with the client on purpose. If the server says "2021–2023" in the
 * summary and the client renders "since 2021" above the same cards, the reader is
 * being told two different things about the same ten records, and there is no way
 * to tell which one chose them.
 *
 * The three modes are three different facts, and conflating any two of them states
 * something false. "Nothing about the economy since 2020" is not the same claim as
 * "nothing since 2020" — 148 records are dated since 2020, they are simply not about
 * the economy — so the subject sentence and the filter sentence are kept apart, and
 * only a question that *was* a window says the window itself is empty.
 */
export function describeWindow(period: AskPeriod, undated: string[] = [], mode: WindowMode = 'shown'): string {
  const dated =
    period.from !== null && period.to !== null
      ? period.from === period.to
        ? String(period.from)
        : `${period.from}–${period.to}`
      : period.from !== null
        ? `${period.from} or later`
        : period.to !== null
          ? `${period.to} or earlier`
          : ''
  if (!dated) return ''

  const filter =
    mode === 'shown'
      ? `Everything below was dated ${dated}.`
      : mode === 'filtered'
        ? `The search was restricted to records dated ${dated}.`
        : `No record in the archive is dated ${dated}.`

  // Naming the collections left out is the difference between "the archive is
  // silent before 2020" and "684 recordings exist and none of them is dated".
  const left =
    mode === 'shown' && undated.length > 0
      ? ` ${undated.length === 1 ? undated[0] : undated.join(' and ')} ${undated.length === 1 ? 'carries' : 'carry'} no date, so ${undated.length === 1 ? 'it is' : 'they are'} left out of this window.`
      : ''
  return `${filter}${left}`
}

/**
 * An interpretation of the cited records, never a quotation.
 *
 * The distinction the whole persona layer rests on: words inside `excerpt` and
 * `timeline` are the Speaker's, read from the archive, while anything in `reading`
 * is somebody's account of them. Keeping them in separate fields with an explicit
 * `generated` flag is what lets a model be added later without a reader — or a
 * scraper of this API — being able to tell the difference.
 */
export interface AskReading {
  text: string
  /** Always true. Present so it can be asserted on, not inferred from the field. */
  generated: true
  /** Ids of the records this reading was drawn from, so it can be checked. */
  basedOn: string[]
}

/** Verbatim passage plus the record it was taken from. */
export interface AskPersonaQuote {
  text: string
  title: string
  href: string
  year: number | null
  kindLabel: string
  collectionLabel: string
}

export interface AskConversation {
  kind: 'new' | 'followup' | 'unresolved'
  /** The opening line, in the Speaker's voice where that is possible. */
  lead: string
  /**
   * Passages quoted word for word. The first person only ever appears inside
   * these, never in `lead` on its own authority.
   */
  quotes: AskPersonaQuote[]
  /** True when the reply speaks in the first person at all. */
  firstPerson: boolean
  /** Earlier terms this turn was resolved against, for "carrying on from…". */
  anchor: string[]
}
