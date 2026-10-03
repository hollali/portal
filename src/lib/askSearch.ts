/**
 * Multi-collection search behind /ask.
 *
 * The assistant originally searched `archiveItem` only — eight curated
 * documents — while the archive actually holds over a thousand published
 * records across photographs, videos, audio, news, milestones and
 * testimonials. This module queries every collection and ranks the results
 * together so a question can be answered from anything the archive holds.
 *
 * Four things stop the extra volume from making answers worse.
 *
 *  - **One definition of "match".** The database candidate query and the
 *    JavaScript scorer use the same rule — a term matches at the start of a
 *    word, and may continue into that word — so `parliament` finds
 *    "parliamentary" but never "part". An earlier substring search failed this
 *    test in the other direction: `art` matched 18 rows via "Part", none of
 *    which were about art, and `min` matched 29 rows via "administration".
 *  - **Relevance-ordered candidates.** Each collection is asked for its best
 *    60 records rather than its newest 60. Ordering purely by year meant a
 *    question about independence was decided by upload date, and the 421
 *    matching videos all collapsed to the same 60 headline cards.
 *  - **Counts from the database.** `count(*) OVER ()` rides along with the
 *    candidate rows, so "N more not shown" and the per-collection chips are the
 *    real totals. Counting them from the fetched pool instead made the page
 *    report "60 news" for a collection holding 134.
 *  - **Per-collection caps and a priority multiplier.** Curated prose outranks
 *    scraped media when scores are close, without ever letting a weak document
 *    outrank a strong media hit outright.
 */

import { prisma } from '@/lib/prisma'
import { archiveRouteForKind, KIND_CONFIG, type ArchiveKind } from '@/lib/library'
import { ASK_COLLECTION_LABELS, NOT_ANSWERABLE_COLLECTIONS, termVariants, type AskMatchMode, type AskPeriod } from '@/lib/askQuery'

/** A normalised row from any collection, ready to be scored. */
export interface SearchCandidate {
  collection: string
  collectionLabel: string
  kind: string
  kindLabel: string
  title: string
  href: string
  year: number | null
  excerpt: string
  /**
   * The record's own words, as plain text — verbatim source text, never a
   * curator's description of it.
   *
   * This is the distinction the whole persona layer turns on. `excerpt` for a
   * speech is editorial copy written about the speech ("The Speaker's opening
   * remarks on the independence of Parliament…"); `body` is the speech. Quoting
   * the first inside quotation marks and attributing it to a living person is
   * the exact failure this field exists to prevent, so only `body` may be quoted.
   *
   * Empty for every collection that has no verbatim text — a photograph, a
   * milestone or a scraped video row has none, and inventing one is not an option.
   */
  body: string
  hasTranscript: boolean
  /** Testimonial author role, where the collection has one. */
  role?: string | null
  /**
   * Where the record came from originally — the newspaper's page for a clipping,
   * the broadcaster's for a video.
   *
   * Null is the honest answer for a milestone, a testimonial and most archive
   * documents: there is no "original" to open, only this library's own record of
   * it. The route never invents one, because a link that resolves to a
   * different article is worse than no link at all.
   */
  url: string | null
  /**
   * Who published it, where the archive recorded that: a newspaper for a
   * clipping, a channel for a video. Shown beside the record rather than in
   * place of a description of it.
   */
  sourceName: string | null
  /** Whether the archive kept a captured copy of the page this record came from. */
  hasCapture?: boolean
  /**
   * The aggregator this record was found through, when that is all the row can
   * honestly name. Never a substitute for `url`: it says how we found the
   * clipping, which is a fact about the archive rather than about the speech.
   */
  via?: string | null
  /**
   * The record's own id, needed to address a row rather than describe it.
   *
   * Everything else the reader sees can be derived from the row that was fetched,
   * but a route that serves that row's stored page has to be told which row, and
   * parsing the id back out of `href` would make a link's format load-bearing.
   */
  id?: number
  /** Weighted haystacks: the value a term can match, and how much it counts. */
  fields: Array<{ weight: number; text: string }>
  /**
   * How many records this collection matched, and how many of them cover every
   * term. Collection-level facts rather than per-row ones, denormalised onto the
   * candidate so `rankCandidates` needs only the rows it was given.
   */
  matchTotal: number
  completeTotal: number
}

export interface ScoredCandidate {
  candidate: SearchCandidate
  score: number
  matched: Set<string>
}

export interface CollectionTotal {
  collection: string
  label: string
  /** Records mentioning at least one term. Counted by the database. */
  matchTotal: number
  /** Records mentioning every term. Counted by the database. */
  completeTotal: number
}

export interface CollectionCount {
  collection: string
  label: string
  /**
   * Records in this collection that satisfied the same bar the results were
   * selected under: every term, or — for a partial answer — enough of them to be
   * worth showing at all.
   *
   * Counted from the surviving pool in the partial case rather than in the
   * database, because this is the number the page prints as "N records matched"
   * and the reader has to be able to find N of them on screen.
   */
  count: number
  /**
   * Every record mentioning at least one term, counted in the database. Reported
   * only when it is the larger number, because "these words appear elsewhere in
   * the archive" is a true and useful thing to say about a partial answer.
   */
  broader?: number
}

export interface ArchiveSearchResult {
  mode: AskMatchMode
  terms: string[]
  results: ScoredCandidate[]
  /** How many records each collection matched, by the bar the results were picked under. */
  collectionCounts: CollectionCount[]
  totalMatched: number
  /** Records matching any term, when that is more than `totalMatched`. */
  broaderMatched?: number
  /** The window the search was restricted to, when the reader named one. */
  period?: AskPeriod
  /** Collection labels left out of a dated search because they store no date. */
  undated?: string[]
  /** Collections the question named, when it restricted the search to some. */
  collections?: string[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
/**
 * The year a record is dated to, read the same way the period filter reads it.
 *
 * A clipping's `date` is ISO on some rows and RFC 2822 on others — "2026-07-09" and
 * "Wed, 08 Jul 2026 03:31:20 GMT" — so a year is the first four-digit run in the
 * string rather than its first four characters. Anything that disagrees with the
 * SQL would put a card in a window under a year the card does not show.
 */
const yearOf = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const run = v.match(/\d{4}/)
    if (!run) return null
    const year = Number(run[0])
    return year >= 1000 && year <= 9999 ? year : null
  }
  return null
}

/**
 * Per-collection weight sets, keyed by the same `collection` identifier that
 * ends up on every `SearchCandidate` — so a weight spec and the collection it
 * describes can never drift apart, which is how a spec for one table ended up
 * being applied to another.
 */
export const W = {
  documents: { title: 6, theme: 4, event: 3, occasion: 3, location: 3, parliament: 2, excerpt: 2, body: 1 },
  photos: { caption: 5, person: 4, theme: 3, event: 3, location: 3, query: 2, notes: 1, source: 1 },
  // The video table is 430 scraped rows carrying a title, a category and a
  // channel — and nothing else. Naming a column the model does not have is not
  // a compile error here, it makes the query fail, and the `.catch` in
  // `safeCollection` turns that into a silent empty result. So this set lists
  // only real columns, and a test checks that against the schema.
  videos: { title: 5, category: 3, channel: 2, source: 1, platform: 1 },
  audio: { title: 5, caption: 4, artist: 3, event: 3, theme: 3, location: 3, category: 2, notes: 1 },
  news: { title: 5, snippet: 4, sourceName: 2, notes: 2, query: 2 },
  milestones: { title: 5, description: 4, category: 2 },
  testimonials: { quote: 5, author: 3, role: 2 },
} as const

export type CollectionName = keyof typeof W

const fields = (row: Record<string, unknown>, spec: Record<string, number>) =>
  Object.entries(spec).map(([field, weight]) => ({ weight, text: str(row[field]).toLowerCase() }))

/**
 * How many citations a collection may contribute. Without this the largest
 * scraped collection decides every answer.
 */
const CAPS: Record<string, number> = {
  documents: 6,
  milestones: 2,
  testimonials: 2,
  news: 3,
  photos: 3,
  videos: 3,
  audio: 3,
}

/** Curated prose outranks scraped media at equal relevance. */
const PRIORITY: Record<string, number> = {
  documents: 3,
  milestones: 2,
  testimonials: 2,
  news: 1,
  photos: 1,
  videos: 1,
  audio: 1,
}

const TOTAL_TAKE = 10
/** Rows pulled per collection before ranking. */
const CANDIDATE_TAKE = 60

/**
 * A record that names every term in one strong field is the answer, not a
 * result set: for "parliamentary independence", one headline saying both beats
 * two headlines each saying one.
 */
const PHRASE_BONUS = 3
/** A phrase only counts in a field meaningful enough to be a title or summary. */
const PHRASE_MIN_WEIGHT = 3

/**
 * Collections that cannot answer a question, and why they are not searched.
 *
 * Measured across all 283 rows: `curated` is false on every one; `caption`,
 * `person`, `theme`, `event`, `location`, `notes` and `tags` are empty; `year`
 * is null. The only populated fields are `query` and `source` — five distinct
 * scrape queries in total, every one of them the subject's own name. A
 * photograph could therefore only ever match on that name, and its result card
 * would be titled with the search string used to collect it rather than with
 * anything about the picture. They stay browsable at /archives/photos and
 * searchable at /search; they are simply not answers.
 */
export const NOT_ANSWERABLE: Record<string, string> = NOT_ANSWERABLE_COLLECTIONS

const SEARCHED: CollectionName[] = (Object.keys(W) as CollectionName[]).filter(c => !(c in NOT_ANSWERABLE))

/* -------------------------------------------------------------------------- */
/* Candidate query                                                            */
/* -------------------------------------------------------------------------- */

interface SqlSpec {
  /** Real table name, which is not always the model name: `audio`, not `audios`. */
  table: string
  /**
   * Columns a result card needs, as Prisma field names. The searched columns
   * from `W` are always included by the query builder.
   */
  pick: string[]
  /**
   * Extra SELECT expressions for values a spec needs but does not search on.
   *
   * Written by hand in `SQL_SPECS` and never derived from a reader's words, so
   * this is the one place a raw expression may enter the query — which is why it
   * exists as a named field instead of being folded into `pick`, where the column
   * guard would have to trust it.
   */
  extraPicks?: string[]
  /** Static filter, i.e. published-only. */
  where?: string
  /** Deterministic tie-break, applied after relevance. */
  order: string
  /** Prisma field names whose `@map` renames the SQL column. */
  renamed?: Record<string, string>
  /**
   * How this collection's date is stored, or `null` for a collection that cannot
   * be placed in a window at all.
   *
   * A period question can only be answered honestly over records that carry a
   * date. Videos and audio have a `year` column and not one row in it, so
   * including them in "between 2020 and 2023" would mean answering a dated
   * question with undated records, and excluding them silently would look like
   * the archive holds nothing on the subject. They are left out and the answer
   * says so.
   */
  dateSource: DateSource | null
}

/**
 * The three shapes a date is stored in across this schema, so the period
 * predicate can be built from a validated column name rather than from SQL text
 * supplied by a caller.
 *
 * `news.date` needs the third shape because the two scrapers that filled it
 * disagreed: 46 rows are ISO ("2026-07-09T13:19:47Z") and the rest are RFC 822
 * ("Wed, 08 Jul 2026 03:31:20 GMT"). A four-digit year appears in both, so the
 * first one in the string is the year. Rows with neither are excluded from a
 * window rather than assumed to be in it.
 */
type DateSource =
  | { column: string; kind: 'int-year' }
  | { column: string; kind: 'text-year' }
  | { column: string; kind: 'loose-date' }

/** An SQL expression yielding the record's year as an integer, or null. */
function yearExpr(spec: SqlSpec): string | null {
  const source = spec.dateSource
  if (!source) return null
  if (source.kind === 'int-year') return sqlColumn(spec, source.column)
  if (source.kind === 'text-year') {
    // Guarded like the loose date below. Every milestone year in the table is
    // four digits today, and an unguarded cast would throw on the first row that
    // is not — taking the whole collection's answer with it.
    const column = sqlColumn(spec, source.column)
    return `CASE WHEN ${column} ~ '\\d{4}' THEN ${column}::int END`
  }
  // A row with no recognisable date yields null, and a null fails every
  // comparison below, so it drops out of the window instead of landing in it.
  return (
    `CASE WHEN ${sqlColumn(spec, source.column)} ~ '\\d{4}' ` +
    `THEN substring(${sqlColumn(spec, source.column)} from '\\d{4}')::int END`
  )
}

const SQL_SPECS: Record<string, SqlSpec> = {
  documents: {
    table: 'archive_items',
    pick: ['kind', 'title', 'slug', 'year', 'excerpt', 'body', 'sourceUrl'],
    where: `status = 'published'`,
    order: 'year DESC NULLS LAST, id DESC',
    // The one camelCase column in the schema, quoted on purpose.
    renamed: { sourceUrl: '"sourceUrl"' },
    dateSource: { column: 'year', kind: 'int-year' },
  },
  videos: {
    table: 'videos',
    pick: ['title', 'category', 'channel', 'source', 'platform', 'year', 'url'],
    where: `status = 'published'`,
    order: 'year DESC NULLS LAST, id DESC',
    // Every one of the 430 rows has a null year, so a dated question cannot be
    // answered from this collection at all.
    dateSource: null,
  },
  audio: {
    table: 'audio',
    pick: ['title', 'caption', 'artist', 'event', 'theme', 'location', 'category', 'notes', 'query', 'year', 'url'],
    where: `status = 'published'`,
    order: 'year DESC NULLS LAST, id DESC',
    // As videos: a `year` column with nothing in it.
    dateSource: null,
  },
  news: {
    // `News` has no status column; every row is a published clipping.
    table: 'news',
    pick: ['title', 'snippet', 'sourceName', 'date', 'notes', 'query', 'url'],
    order: 'id DESC',
    renamed: { sourceName: 'source_name' },
    dateSource: { column: 'date', kind: 'loose-date' },
    // Whether the scraper kept the page it fetched, not the page itself: a
    // clipping's original HTML can be a megabyte of markup, and ten of them in an
    // answer would be fetched to answer a question about one line of it. The
    // reader is told the copy exists and goes to a route that serves one page.
    extraPicks: ['(raw_html IS NOT NULL) AS "hasCapture"'],
  },
  milestones: {
    table: 'milestones',
    pick: ['year', 'title', 'description', 'category'],
    where: `status = 'published'`,
    order: 'year ASC, id ASC',
    // `Milestone.year` is text ("1993"), not an integer.
    dateSource: { column: 'year', kind: 'text-year' },
  },
  testimonials: {
    table: 'testimonials',
    pick: ['author', 'role', 'quote', 'year', 'sortOrder'],
    where: `status = 'published'`,
    order: 'sort_order ASC, id ASC',
    renamed: { sortOrder: 'sort_order' },
    dateSource: { column: 'year', kind: 'int-year' },
  },
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/
/**
 * A physical column that really is camelCase in Postgres. `ArchiveItem.sourceUrl`
 * carries no `@map`, so its column is `sourceUrl` while every mapped field is
 * snake_case — and because the unquoted guard below is deliberately snake_case
 * only, writing it out in quotes is what stops a Prisma *field* name from being
 * mistaken for a *column* name again. Quoting is the assertion that this one is
 * the column the database actually has.
 */
const QUOTED_IDENTIFIER = /^"[A-Za-z_][A-Za-z0-9_]*"$/
/** Query terms are `[a-z0-9]`-only by the time they reach here, and stay that way. */
const PATTERN_TERM = /^[a-z0-9]{1,32}$/

function sqlColumn(spec: SqlSpec, field: string): string {
  const column = spec.renamed?.[field] ?? field
  if (!IDENTIFIER.test(column) && !QUOTED_IDENTIFIER.test(column)) {
    throw new Error(`[ask] refusing to build SQL: unsafe column "${column}"`)
  }
  return column
}

/**
 * A word-start prefix match, as a Postgres regex.
 *
 * The leading `[^a-z0-9]` is what makes this a word boundary rather than a
 * substring search; there is deliberately no trailing boundary, because a term
 * should also find its own longer forms — `parliament` in "parliamentary",
 * `educ` in "educational".
 *
 * Patterns are inlined rather than bound, because Neon's serverless driver
 * binds a single parameter and this query needs none. That is only safe because
 * every value interpolated into the SQL goes through this check, which is why it
 * throws instead of escaping: a pattern that is not plain lowercase alphanumerics
 * means something upstream stopped sanitising the question, and that should stop
 * the request rather than become SQL.
 */
function sqlPattern(terms: string[]): string {
  const variants = [...new Set(terms.flatMap(termVariants))]
  for (const variant of variants) {
    if (!PATTERN_TERM.test(variant)) {
      throw new Error(`[ask] refusing to build SQL: unsafe term "${variant}"`)
    }
  }
  return `(^|[^a-z0-9])(${variants.join('|')})`
}

/**
 * Sum of the weights of the fields matching these terms. The database ranks on
 * exactly the weights the JavaScript scorer does, so the 60 rows it hands back
 * are the 60 rows worth scoring.
 */
function weightedExpr(collection: string, spec: SqlSpec, terms: string[]): string {
  const pattern = sqlPattern(terms)
  return Object.entries(W[collection as CollectionName])
    .map(([field, weight]) => `(CASE WHEN ${sqlColumn(spec, field)} ~* '${pattern}' THEN ${weight} ELSE 0 END)`)
    .join(' + ')
}

/** Every term matched by at least one field. */
function strictExpr(collection: string, spec: SqlSpec, terms: string[]): string {
  return terms.map(term => `(${weightedExpr(collection, spec, [term])} > 0)`).join(' AND ')
}

/**
 * One candidate query per collection: the best rows, plus both totals, in a
 * single round trip.
 */
/**
 * The `WHERE` fragment restricting rows to the years the reader named.
 *
 * Both bounds are optional because a window can be open at either end, and the
 * bounds are validated as integers before they get here rather than being
 * escaped: they come from `parsePeriod`, which only ever produces a number or
 * null, and this throws rather than interpolate anything else. A collection with
 * no date column yields null and the caller leaves it out of the search instead
 * of pretending it was searched.
 */
function periodPredicate(
  spec: SqlSpec,
  period: AskPeriod,
  collection: string,
): { where: string; year: string } | null {
  const year = yearExpr(spec)
  if (!year) {
    // Refused rather than ignored. A query that silently drops the window it was
    // handed returns a 2023 recording for a question about 2019–2021, and the
    // `.catch` in `safeCollection` would hide even that. `collectCandidates`
    // skips these collections before it gets here; this is the guard for any
    // caller that does not.
    throw new Error(
      `collection "${collection}" stores no date, so it cannot answer a dated search`,
    )
  }
  const bounds: string[] = []
  if (period.from !== null) bounds.push(`(${year}) >= ${period.from}`)
  if (period.to !== null) bounds.push(`(${year}) <= ${period.to}`)
  return bounds.length > 0 ? { where: bounds.join(' AND '), year } : null
}

function buildCandidateSql(
  collection: string,
  terms: string[],
  period?: AskPeriod | null,
  listing = false,
): string {
  const spec = SQL_SPECS[collection]
  if (!spec) throw new Error(`[ask] no SQL spec for collection "${collection}"`)
  if (!IDENTIFIER.test(spec.table)) throw new Error(`[ask] refusing to build SQL: unsafe table "${spec.table}"`)
  // A period on its own is a real question — "what happened in 2024?" — and so is a
  // named collection on its own — "any photographs?" — so in both cases the term
  // filter is dropped rather than refused. Without a term there is nothing to match
  // on and the window or the collection is the whole of the predicate.
  if (terms.length === 0 && !period && !listing)
    throw new Error('[ask] refusing to build SQL: no terms, no period and no collection')

  for (const bound of [period?.from, period?.to]) {
    if (bound !== null && bound !== undefined && !Number.isInteger(bound)) {
      throw new Error(`[ask] refusing to build SQL: unsafe year "${bound}"`)
    }
  }

  const searched = Object.keys(W[collection as CollectionName])
  const columns = [...new Set(['id', ...searched, ...spec.pick])]
  const select = [
    ...columns.map(field => {
      const column = sqlColumn(spec, field)
      return column === field ? column : `${column} AS "${field}"`
    }),
    ...(spec.extraPicks ?? []),
  ].join(', ')

  const window = period ? periodPredicate(spec, period, collection) : null
  const loose = terms.length > 0 ? weightedExpr(collection, spec, terms) : null
  const strict = terms.length > 0 ? strictExpr(collection, spec, terms) : null

  // Every clause the row must satisfy, ANDed. A period-only question has no term
  // clause at all, which is what lets "what happened in 2024?" return the year.
  const filters = [spec.where, loose ? `((${loose}) > 0)` : null, window?.where].filter(
    (clause): clause is string => typeof clause === 'string' && clause.length > 0,
  )

  return [
    `SELECT ${select},`,
    `  count(*) OVER ()::int AS "match_total",`,
    `  count(*) FILTER (WHERE ${strict ?? 'true'}) OVER ()::int AS "strict_total"`,
    `FROM ${spec.table}`,
    // A listing has nothing to filter on — `news` is the one spec with no `where`
    // clause of its own — and `WHERE` with nothing after it is a syntax error, so
    // the clause is left off rather than emitted empty.
    ...(filters.length > 0 ? [`WHERE ${filters.join(' AND ')}`] : []),
    // Complete matches first, so the take can never drop them in favour of
    // records that only cover part of the question.
    strict
      ? `ORDER BY (CASE WHEN ${strict} THEN 1 ELSE 0 END) DESC, ${loose} DESC, ${spec.order}`
      : // A window with no topic is a chronology, so the take has to keep the
        // earliest records in it or "the 1990s" returns only the latest years.
        // `news` orders by id, which is not the date, so the year has to be the
        // sort key here rather than inherited from the spec.
        window
          ? `ORDER BY (${window.year}) ASC NULLS LAST, ${spec.order}`
          : // A bare listing takes the collection's own order — the order its
            // archive page lists it in — rather than inventing a chronology the
            // reader did not ask for.
            `ORDER BY ${spec.order}`,
    `LIMIT ${CANDIDATE_TAKE}`,
  ].join('\n')
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const matcherCache = new Map<string, RegExp>()

/**
 * Word-start prefix match, the JavaScript half of the same rule the candidate
 * query applies. Kept in step with `sqlPattern` deliberately: if the two
 * disagree, the counts the database reports stop describing the results it
 * selected.
 */
export function matchTerm(text: string, variant: string): boolean {
  if (!text || !variant) return false
  let re = matcherCache.get(variant)
  if (!re) {
    re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(variant)}`, 'i')
    matcherCache.set(variant, re)
  }
  return re.test(text)
}

function coversAllTerms(text: string, terms: string[]): boolean {
  return terms.every(term => termVariants(term).some(variant => matchTerm(text, variant)))
}

function label(kind: string): string {
  return KIND_CONFIG[kind as ArchiveKind]?.label || kind
}

/** Strip markdown so a quoted answer reads as prose, not as source syntax. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // A heading is document structure, not a sentence. Left in, it runs straight
    // into the passage and reads as though the Speaker opened by saying
    // "Financing the legislature A legislature that depends on…" — which
    // matters, because these passages are quoted to the reader as his words.
    .replace(/^\s{0,3}#{1,6}\s+.*$/gm, ' ')
    // Emphasis wraps a word, so it leaves no space of its own: `*Mr. Speaker*`
    // has to become "Mr. Speaker" and not "Mr. Speaker ", which would put a gap
    // before the following comma.
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '$2')
    .replace(/(^|[\s(])[*_](?=\S)([^*_]*?\S)[*_]/g, '$1$2')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/\s+/g, ' ')
    // Punctuation orphaned by stripped markup.
    .replace(/\s+([,.;:!?%])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
}

/**
 * The part of a record that actually matched, pulled out of the surrounding text.
 *
 * A citation card shows a hundred and fifty characters of a document. For a
 * long speech, that is almost never the hundred and fifty characters the reader
 * asked about — it is whatever came first in the file. The reader gets a card
 * that says "speech on parliamentary independence" above a paragraph about
 * committee procedure, and concludes the archive does not cover the subject.
 *
 * So the window follows the match. This is not summarisation: it is the record's
 * own words, verbatim, cut at sentence boundaries where one is near.
 */
export function bestPassage(candidate: SearchCandidate, terms: string[], max = 180): string {
  // The body is the record's own words and the likeliest place for the phrase the
  // reader typed, so it is searched first. The excerpt is the fallback: for
  // scraped media it is usually the only prose the row carries.
  const variants = [...new Set(terms.flatMap(t => termVariants(t)).filter(Boolean))]
  // Word-start match, the same rule `matchTerm` applies, so the window centres on
  // a word the record actually matched rather than one buried inside another.
  const patternFor = (list: string[]) =>
    new RegExp(`(?<![a-zA-Z0-9])(?:${list.map(escapeRegExp).join('|')})`, 'i')

  /**
   * First hit in the text, preferring the reader's own words over the stems they
   * expand to. Asking about "independence" and being shown the first sentence
   * containing "independent" is a worse answer than the sentence that says
   * "independence" fifty words later.
   */
  const hit = (text: string): { at: number } | null => {
    if (!text || variants.length === 0) return null
    for (const group of [terms, variants]) {
      const usable = group.filter(t => /^[a-z0-9]+$/i.test(t))
      if (usable.length === 0) continue
      const found = patternFor(usable).exec(text)
      if (found) return { at: found.index }
    }
    return null
  }

  const body = plainText(candidate.body ?? '')
  const excerpt = candidate.excerpt ?? ''
  const inBody = hit(body)
  const found = inBody ?? hit(excerpt)
  const text = inBody ? body : excerpt
  if (!found) return clip(excerpt, max)

  // Bias the window to the text *before* the match: a reader scanning for a phrase
  // wants the sentence that introduces it, not the one that resumes after it.
  const start = wordStart(text, Math.max(0, found.at - Math.min(40, Math.floor(max / 4))))
  const end = windowEnd(text, start, max)

  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

/** Back up to the beginning of the word containing `at`, never past the text. */
function wordStart(text: string, at: number): number {
  const space = text.lastIndexOf(' ', at)
  return space > 0 ? space + 1 : 0
}

/**
 * Close a window at a sentence boundary if one falls in its second half, so the
 * passage reads as a complete thought. Otherwise cut at the last space, because
 * ending mid-word ("the Committe") reads as a rendering fault rather than as an
 * excerpt.
 */
function windowEnd(text: string, start: number, max: number): number {
  const hard = Math.min(text.length, start + max)
  if (hard >= text.length) return text.length
  const stop = text.lastIndexOf('. ', hard)
  if (stop > start + Math.floor(max / 2)) return stop + 1
  const space = text.lastIndexOf(' ', hard)
  return space > start ? space : hard
}

/** Leading `max` characters, cut at a word boundary. Used when nothing matched. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text.trim()
  const cut = text.lastIndexOf(' ', max)
  return `${text.slice(0, cut > 0 ? cut : max).trim()}…`
}

/**
 * Longest title a candidate may carry.
 *
 * Scraper headlines run to 150 characters and more with their source and
 * timestamp appended. Exported because the retrieval eval has to cap its
 * expectations identically: it identifies records the way the reader sees them,
 * and a title the reader never sees cannot be an expectation.
 */
export const CANDIDATE_TITLE_MAX = 120

function fallbackTitle(parts: Array<[string, string | null | undefined]>, id: number, noun: string): string {
  for (const [, v] of parts) if (v && String(v).trim()) return String(v).trim().slice(0, CANDIDATE_TITLE_MAX)
  return `${noun} #${id}`
}

/**
 * One collection failing must not take down the whole answer, but it must not
 * be silent either. A query naming a column the table does not have is rejected
 * outright, and swallowing that here is how 430 videos went missing from every
 * answer without a single visible symptom.
 */
async function safeCollection<T>(name: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    console.error(`[ask] collection "${name}" could not be searched:`, err)
    throw err
  }
}

/* -------------------------------------------------------------------------- */
/* Row → candidate                                                            */
/* -------------------------------------------------------------------------- */

type Row = Record<string, unknown>

function toCandidate(collection: string, r: Row, totals: { matchTotal: number; completeTotal: number }): SearchCandidate | null {
  const id = num(r.id) ?? 0
  const recordId = num(r.id)
  const base = {
    matchTotal: totals.matchTotal,
    completeTotal: totals.completeTotal,
  }
  const withFields = (head: Omit<SearchCandidate, 'fields' | 'matchTotal' | 'completeTotal'>) => ({
    ...head,
    ...base,
    ...(recordId !== null ? { id: recordId } : {}),
    fields: fields(r, W[collection as CollectionName]),
  })

  switch (collection) {
    case 'documents': {
      const kind = str(r.kind)
      const slug = str(r.slug)
      if (!slug) return null
      const body = str(r.body)
      return withFields({
        collection: 'documents',
        collectionLabel: ASK_COLLECTION_LABELS.documents,
        kind,
        kindLabel: label(kind),
        title: str(r.title),
        href: `/archives/${archiveRouteForKind(kind)}/${slug}`,
        year: yearOf(r.year),
        excerpt: str(r.excerpt) || plainText(body) || str(r.title),
        // Verbatim, and kept separate from `excerpt` above even when the two are
        // the same string: the excerpt may have been typed by an editor, and only
        // this one is safe to put in quotation marks.
        body: body ? plainText(body) : '',
        hasTranscript: Boolean(body),
        url: str(r.sourceUrl) || null,
        sourceName: str(r.source) || null,
      })
    }
    case 'videos':
      return withFields({
        collection: 'videos',
        collectionLabel: ASK_COLLECTION_LABELS.videos,
        kind: 'video',
        kindLabel: 'Video',
        title: fallbackTitle([['title', str(r.title)], ['category', str(r.category)], ['channel', str(r.channel)]], id, 'Video'),
        href: `/videos/${id}`,
        year: yearOf(r.year),
        // A video row has no caption or notes, so the category and channel are
        // the only honest context a result card can offer.
        excerpt: [str(r.category), str(r.channel)].filter(Boolean).join(' · '),
        // A scraped video row is a title, a category and a channel. There is no
        // transcript, so there is nothing here that may be quoted.
        body: '',
        hasTranscript: false,
        ...sourceAccess(str(r.url) || null, str(r.channel) || str(r.source) || null),
      })
    case 'audio':
      return withFields({
        collection: 'audio',
        collectionLabel: ASK_COLLECTION_LABELS.audio,
        kind: 'audio',
        kindLabel: 'Audio',
        title: fallbackTitle([['title', str(r.title)], ['caption', str(r.caption)], ['query', str(r.query)]], id, 'Audio recording'),
        href: `/audio/${id}`,
        year: yearOf(r.year),
        excerpt: str(r.caption) || str(r.notes) || [str(r.artist), str(r.event)].filter(Boolean).join(' · '),
        body: '',
        hasTranscript: false,
        ...sourceAccess(str(r.url) || null, str(r.source) || str(r.artist) || null),
      })
    case 'news':
      return withFields({
        collection: 'news',
        collectionLabel: ASK_COLLECTION_LABELS.news,
        kind: 'news',
        kindLabel: 'News clipping',
        title: fallbackTitle([['title', str(r.title)], ['snippet', str(r.snippet)]], id, 'News clipping'),
        href: `/news/${id}`,
        // `date` holds ISO dates on some rows and RFC-2822 on others, so only a
        // leading four-digit year is trustworthy.
        year: yearOf(r.date),
        // A news snippet is a journalist's sentence about what was said, not
        // what was said. Quoting it in the Speaker's voice would attribute a
        // reporter's words to him, so it is never eligible.
        //
        // `sourceName` used to close this fallback chain, which rendered "Ghanaian
        // Times" under a clipping that had no snippet as though it described the
        // story. The publication is now shown as the publication, beside the
        // record, and a clipping with nothing to say says nothing.
        excerpt: str(r.snippet) || str(r.notes),
        body: '',
        hasTranscript: false,
        ...sourceAccess(str(r.url) || null, str(r.sourceName) || null),
        hasCapture: r.hasCapture === true,
      })
    case 'milestones':
      return withFields({
        collection: 'milestones',
        collectionLabel: ASK_COLLECTION_LABELS.milestones,
        kind: 'milestone',
        kindLabel: 'Milestone',
        title: str(r.title),
        href: '/archives/milestones',
        year: yearOf(r.year),
        excerpt: str(r.description),
        body: '',
        hasTranscript: false,
        url: null,
        sourceName: null,
      })
    case 'testimonials':
      return withFields({
        collection: 'testimonials',
        collectionLabel: ASK_COLLECTION_LABELS.testimonials,
        kind: 'testimonial',
        kindLabel: 'Testimonial',
        title: str(r.author),
        href: '/archives/testimonials',
        year: yearOf(r.year),
        // A testimonial is somebody else speaking about him. It is a quotation,
        // but not his, and the persona layer must not present it as his.
        excerpt: str(r.quote),
        body: '',
        hasTranscript: false,
        url: null,
        sourceName: str(r.source) || null,
        role: str(r.role) || null,
      })
    default:
      return null
  }
}

/**
 * Key used to collapse records that would render as the same card.
 *
 * The scrapers ran the same subject through several searches, and each pass
 * stored its own row, so one clipping can exist four times: 19 of the 134 news
 * rows are duplicates of another headline, 3 of the 430 videos are, and many a
 * speech was captured as both audio and a video under one title. The counts the
 * database reports stay as they are — those are real rows — but showing the same
 * headline twice in a list of ten tells the reader nothing new.
 *
 * Each row's own `url` is what makes the collapse work. The same clipping was
 * stored three ways — clean, with " - CitiNewsroom.com", and with " – Graphic
 * Online | 3 hours ago" — and only the host each row was actually fetched from
 * says which trailing words are that scraper's provenance rather than the
 * paper's headline.
 */
const dedupeKey = (c: SearchCandidate): string =>
  c.collection === 'testimonials'
    ? `${c.title}|${c.excerpt}`
    : normaliseTitle(c.title, hostOf(publisherUrl(c.url)))

/**
 * Words that carry no publisher identity, so a segment made only of these is
 * not evidence of anything: "Graphic Online" names a paper, "Online" does not.
 */
const GENERIC_HOST_WORDS = new Set(['online', 'com', 'www', 'gh', 'co', 'org', 'net', 'news', 'site', 'home'])

/** A dash a scraper or a paper used to set off a suffix, not a hyphen in a word. */
const PROVENANCE_DASH = /\s+[-–—]\s+/

/** Below this, a "headline" is a publisher name that got mistaken for one. */
const MIN_HEADLINE_CHARS = 12

/**
 * A whole title segment that is only a date. Month names are spelled out in full
 * rather than listed three-letter-first because a segment like "Jun" is also a
 * plausible word, and misreading it as a date would cut a real headline short.
 */
const MONTH = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t\\.?|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
const DATE_SEGMENT = new RegExp(
  '^(?:' +
    `\\d{1,2}\\s+(?:${MONTH})(?:\\s+\\d{4})?` + // 22 May, 11 Jun, 30 Oct 2025
    '|' +
    '\\d{4}-\\d{2}-\\d{2}' + // 2026-06-11
    '|' +
    '\\d+\\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\\s+ago' + // 3 hours ago
    '|' +
    `(?:${MONTH})\\s+\\d{1,2}(?:,?\\s*\\d{4})?` + // June 11, 2026
    ')$',
  'i',
)

/**
 * A trailing byline: "By Elsie Appiah-osei". Same reasoning as the date — it is
 * clipping metadata, and because a scraper may put it last it would otherwise
 * stop the walk before the publisher behind it is reached.
 */
const AUTHOR_SEGMENT = /^by\s+\S/i

const hostTokens = (host: string): string[] =>
  host
    .toLowerCase()
    .replace(/^www\./, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

/**
 * The host a record was fetched from, or null when its `url` is absent or
 * unparseable. Never throws: a malformed URL on one row must not cost the reader
 * every other row's dedupe.
 */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname || null
  } catch {
    return null
  }
}

/**
 * The publisher's own address for a stored one, or the stored one unchanged.
 *
 * Kept separate from `sourceAccess` because dedupe needs only the address, and
 * the two uses must never disagree: if a clipping were collapsed against the
 * aggregator's name and the reader offered the publisher's page, the record that
 * "the same headline from two papers" was a single clipping fetched twice.
 */
export const publisherUrl = (url: string | null | undefined): string | null => sourceAccess(url, null)?.url ?? null

/**
 * Sites that hold a clipping on behalf of the paper that wrote it.
 *
 * 131 of the archive's 134 news rows store an aggregator's address rather than
 * the publisher's: 85 reached through Google News and 46 through Bing's feed. The
 * Bing redirect carries the publisher's address inside it as a query parameter,
 * so those 46 can be unwrapped exactly. The Google one is an opaque signed blob
 * with no address in it, and it cannot be unwrapped without asking Google — so
 * those links stay as they are and are labelled as what they are.
 */
const AGGREGATOR_HOSTS = new Set(['www.bing.com', 'bing.com', 'news.google.com', 'news.google.co.uk'])

/** The aggregator's own name for itself, for when that is all we can honestly say. */
const AGGREGATOR_LABELS: Record<string, string> = {
  'www.bing.com': 'Bing News',
  'bing.com': 'Bing News',
  'news.google.com': 'Google News',
  'news.google.co.uk': 'Google News',
}

/**
 * Where the clipping can actually be read, and what to call that place.
 *
 * Returns the publisher's own page where the stored row carries one, and says so
 * plainly where it does not. An answer that links a reader to `bing.com` and
 * labels the result "Bing News" would present a search engine as the source of a
 * speech; an answer that links the same row to the paper, without mentioning that
 * the row was found through an aggregator, hides a fact the reader may need.
 */
export function sourceAccess(
  url: string | null | undefined,
  sourceName: string | null | undefined,
): { url: string | null; sourceName: string | null; via: string | null } {
  if (!url) return { url: null, sourceName: null, via: null }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { url: null, sourceName: null, via: null }
  }
  const host = parsed.hostname
  // A stored address is whatever a scraper wrote, and `javascript:alert(1)` is a
  // URL that parses. Returning it would put a script execution into the answer as
  // a link; the client also refuses it, but a field that can carry one should not
  // leave the server at all.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { url: null, sourceName: null, via: null }
  }
  if (!host) return { url: null, sourceName: null, via: null }
  if (!AGGREGATOR_HOSTS.has(host)) {
    return { url, sourceName: sourceName || null, via: null }
  }

  const via = AGGREGATOR_LABELS[host] ?? host
  // Bing's `apiclick` address wraps the real one as a query parameter.
  const wrapped = parsed.searchParams.get('url')
  if (wrapped) {
    try {
      const real = new URL(wrapped)
      if (real.protocol === 'https:' || real.protocol === 'http:') {
        return {
          url: real.toString(),
          // The paper's hostname, because the row's `sourceName` for these rows is
          // the aggregator's, and a hostname is a fact where a name would be a
          // guess.
          sourceName: sourceName && !isAggregatorName(sourceName) ? sourceName : real.hostname,
          via,
        }
      }
    } catch {
      // Not a wrapped address after all; fall through to the stored link.
    }
  }
  return { url, sourceName: sourceName && !isAggregatorName(sourceName) ? sourceName : null, via }
}

/** Whether a recorded publisher name is the aggregator rather than the paper. */
function isAggregatorName(name: string | null | undefined): boolean {
  const flat = (name ?? '').toLowerCase()
  return Object.values(AGGREGATOR_LABELS).some(label => flat.includes(label.toLowerCase()))
}

/**
 * Whether a trailing title segment is the publisher rather than part of the
 * headline, decided against the row's own URL host.
 *
 * A hardcoded list of Ghanaian papers would rot on the next scrape, and matching
 * on the mere presence of a dash would be worse than the bug: "Nominate Alban
 * Bagbin as Speaker of 9th Parliament – Mahama tells NDC caucus" and "African
 * autocrats — and US right wing — demand sovereignty" both carry interior dashes
 * that are not provenance, and truncating either would invent a different
 * headline. The host is already in the row, so it is the authority: a segment
 * qualifies only when every distinctive word in it occurs in the host that
 * published this very clipping.
 */
function isPublisherSegment(segment: string, tokens: string[]): boolean {
  const words = segment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => w.length >= 4 && !GENERIC_HOST_WORDS.has(w))
  if (words.length === 0 || words.length > 5) return false
  return words.every(word => tokens.some(token => token.includes(word) || word.includes(token)))
}

/**
 * Whether a trailing title segment is the clipping's date rather than part of the
 * headline: "3 hours ago", "22 May", "11 Jun", "30 Oct 2025".
 *
 * These are skipped rather than treated as the end of the provenance chain,
 * because scrapers disagree about where the date goes — Google News parks it
 * after the paper ("… - Graphic Online - 2 days ago") while the archive's own
 * `date` column holds it, so the title that reaches the reader carries both.
 */
function isDateSegment(segment: string): boolean {
  return DATE_SEGMENT.test(segment.trim()) || AUTHOR_SEGMENT.test(segment.trim())
}

/** Strip a trailing `- <publisher>` chain, leaving the headline the paper wrote. */
function stripPublisherSuffix(text: string, host: string | null | undefined): string {
  const tokens = host ? hostTokens(host) : []
  const parts = text.split(PROVENANCE_DASH)
  let end = parts.length
  // Walk in from the end, dropping segments while they are provenance. Anything
  // else ends the chain, so a headline's own dash is never cut at.
  while (end > 1) {
    const rest = parts.slice(0, end - 1).join(' - ').trim()
    if (rest.length < MIN_HEADLINE_CHARS) break
    const last = parts[end - 1]
    // A date or byline is dropped whether or not a host vouches for it: "… -
    // Ghanaian Times - 12 Jun" and "… - Ghanaian Times" are one clipping, and
    // demanding a host here would leave that pair as two cards because the
    // scraper reached the paper through an aggregator.
    if (isDateSegment(last)) {
      end -= 1
      continue
    }
    // A publisher is dropped only when every distinctive word in it appears in
    // the host that published this very row. With no host to check against,
    // nothing is guessed.
    if (tokens.length === 0 || !isPublisherSegment(last, tokens)) break
    end -= 1
  }
  return parts.slice(0, end).join(' - ')
}

export function normaliseTitle(title: string, host?: string | null): string {
  let text = title
  // Bing appends its own provenance after a pipe: "<headline> | 2 hours ago by
  // Nii Ayikwei". Nothing in a headline follows one, so the cut is unconditional
  // once enough of a headline survives it.
  const pipe = text.indexOf('|')
  if (pipe >= MIN_HEADLINE_CHARS) text = text.slice(0, pipe)
  text = stripPublisherSuffix(text.trim(), host)
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Fetch and normalise every searchable collection in parallel.
 *
 * Exported for the retrieval eval in `scripts/ask-eval.ts`, which needs the
 * candidate pool the database returned rather than only the ten rows that
 * survived ranking — a change to this query that quietly narrows the pool is
 * invisible in the final results, and it is the change most likely to cost
 * recall.
 */
export async function collectCandidates(
  terms: string[],
  period: AskPeriod | null = null,
  named: string[] = [],
): Promise<{ candidates: SearchCandidate[]; totals: CollectionTotal[]; undated: string[] }> {
  // A dated question can only be answered from collections that store a date.
  // The ones left out are named in the answer rather than quietly disappearing,
  // because "the archive holds nothing about this before 2020" and "the archive
  // holds 430 videos, none of them dated" are different facts.
  // A named collection narrows the search to itself; a window narrows it to the
  // collections that store a date. Both are reported in the answer rather than
  // applied silently.
  const scope = named.length > 0 ? SEARCHED.filter(c => named.includes(c)) : SEARCHED
  const searched = period ? scope.filter(c => SQL_SPECS[c]?.dateSource) : scope
  const undated = period
    ? scope.filter(c => !SQL_SPECS[c]?.dateSource).map(c => ASK_COLLECTION_LABELS[c])
    : []

  const perCollection = await Promise.all(
    searched.map(async collection => {
      const rows = await safeCollection(collection, () =>
        prisma.$queryRawUnsafe<Row[]>(buildCandidateSql(collection, terms, period, named.length > 0)),
      )
      const matchTotal = num(rows[0]?.match_total) ?? 0
      const completeTotal = num(rows[0]?.strict_total) ?? 0
      const candidates = rows
        .map(r => toCandidate(collection, r, { matchTotal, completeTotal }))
        .filter((c): c is SearchCandidate => c !== null)
      return { collection, matchTotal, completeTotal, candidates }
    }),
  )

  const totals: CollectionTotal[] = perCollection
    .filter(t => t.matchTotal > 0)
    .map(t => ({
      collection: t.collection,
      label: ASK_COLLECTION_LABELS[t.collection as CollectionName],
      matchTotal: t.matchTotal,
      completeTotal: t.completeTotal,
    }))

  return { candidates: perCollection.flatMap(t => t.candidates), totals, undated }
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Score one candidate: each term counts once, at its strongest field, so a
 * document repeating a word in its body cannot outrank one naming it in the
 * title.
 */
export function scoreCandidate(candidate: SearchCandidate, terms: string[]): ScoredCandidate {
  const matched = new Set<string>()
  let score = 0
  for (const term of terms) {
    let best = 0
    for (const variant of termVariants(term)) {
      for (const { weight, text } of candidate.fields) {
        if (weight > best && matchTerm(text, variant)) best = weight
      }
    }
    if (best > 0) {
      matched.add(term)
      score += best
    }
  }

  if (score > 0 && terms.length > 1) {
    const named = candidate.fields.some(
      f => f.weight >= PHRASE_MIN_WEIGHT && f.text && coversAllTerms(f.text, terms),
    )
    if (named) score += PHRASE_BONUS
  }

  return { candidate, score, matched }
}

/**
 * How much a partial match is lifted for also touching the previous turn's topic.
 *
 * Small on purpose. This is a preference between records that already scored the
 * same, not a way to smuggle an old topic into a new question — the terms
 * themselves are never widened, so a reader who names a new subject still gets a
 * search of that subject.
 */
const CONTEXT_BOOST = 1.18

/**
 * How much of the question a partial match has to cover to be shown at all, and
 * how strong the field it matched in has to be.
 *
 * Without a floor the archive answers *anything* — every candidate is, by
 * definition, a record that matched at least one term, so a question the archive
 * cannot answer still comes back with cards. "quantum computing policy" returned
 * the Water Resources ministry milestone, matched on the word "policy" in its
 * description, and "cattle ranching in the North East" returned the Tamale
 * secondary school milestone, matched on the region. Both were confident-looking
 * non-answers.
 *
 * Two conditions, and the second is what actually catches them:
 *
 *  - coverage — at least half the question's terms. This is stricter than "more
 *    than one": a one-word question about the North East would then be thrown out
 *    for naming it once.
 *  - a strong field — the single most informative match has to sit in a title or
 *    caption. A record that only matches inside a description or snippet is
 *    saying something *about* the subject, which is a lead rather than an answer,
 *    and a lead is not what a mode-'any' result list is for.
 *
 * The second condition deliberately cannot apply to a record that matches every
 * term. Such a record has answered the question even if each term landed in a
 * description, and dropping it in favour of a stronger title match on half the
 * question would be exactly the score-over-coverage mistake the ranking below
 * exists to prevent. A database count can promise zero complete matches while a
 * fetched row covers every term, so this is reachable rather than theoretical.
 *
 * The floor applies to partial answers only. Records satisfying every term have
 * already answered the question, and it is not this gate's business to second-
 * guess them.
 */
const MIN_PARTIAL_COVERAGE = 0.5
const STRONG_FIELD_WEIGHT = 5

/** Whether a match is informative enough to put in front of a reader. */
function isWorthShowing(r: ScoredCandidate, termCount: number): boolean {
  if (termCount <= 0) return false
  if (r.matched.size >= termCount) return true
  if (r.matched.size / termCount < MIN_PARTIAL_COVERAGE) return false
  return r.candidate.fields.some(
    f =>
      f.weight >= STRONG_FIELD_WEIGHT &&
      f.text &&
      [...r.matched].some(term => termVariants(term).some(v => matchTerm(f.text, v))),
  )
}

/**
 * Score, rank, cap and report. Records satisfying every term are preferred over
 * partial ones so a broad question still returns the most complete answer
 * available rather than whichever collection happened to be largest.
 *
 * `totals` carries the database's own counts. Without them the reported breadth
 * is whatever survived the candidate take, which is how the page came to claim
 * "60 news" for a collection of 134.
 */
export function rankCandidates(
  candidates: SearchCandidate[],
  terms: string[],
  totals?: CollectionTotal[],
  contextTerms: string[] = [],
  options: { listing?: boolean } = {},
): {
  mode: AskMatchMode
  results: ScoredCandidate[]
  collectionCounts: CollectionCount[]
  totalMatched: number
  broaderMatched?: number
} {
  const scored = candidates
    .map(c => scoreCandidate(c, terms))
    // A period-only search has no terms, so nothing "matches" in the ordinary
    // sense: the window already decided what is in scope.
    .filter(r => options.listing || r.matched.size > 0)
    .map(r => {
      let score = r.score * (PRIORITY[r.candidate.collection] ?? 1)
      // Conversation continuity, as a tie-break only.
      //
      // When the reader is still on a topic from a previous turn, a partial match
      // that also touches that topic is likelier to be the record they meant than
      // an equally partial one that ignores it. Restricted to partial matches on
      // purpose: a record that already satisfies the whole question does not need
      // help winning, and boosting it would inflate its score for no reason.
      if (contextTerms.length > 0 && r.matched.size < terms.length) {
        if (scoreCandidate(r.candidate, contextTerms).matched.size > 0) {
          score *= CONTEXT_BOOST
        }
      }
      return { ...r, score }
    })

  const complete = scored.filter(r => r.matched.size === terms.length)
  const completeTotal = totals
    ? totals.reduce((sum, t) => sum + t.completeTotal, 0)
    : complete.length

  // The database count decides the mode, not the pool: a collection can hold
  // complete matches that its own 60-row take did not return, and reporting a
  // partial answer when a complete one exists is the mistake this guards.
  let mode: AskMatchMode = completeTotal > 0 ? 'all' : 'any'
  let pool = mode === 'all' ? complete : scored
  if (mode === 'all' && pool.length === 0) {
    // `completeTotal` promised a complete match the fetch did not return.
    // Better to answer partially and say so than to answer "nothing found".
    mode = 'any'
    pool = scored
  }

  pool = [...pool].sort((a, b) => {
    // A window with no topic has nothing to rank by, so it is ordered oldest
    // first: that is the order the period happened in, which is what a reader
    // asking about a span of years is trying to see.
    if (options.listing) return (a.candidate.year ?? 0) - (b.candidate.year ?? 0)
    // A partial answer is assembled from several records, so the record that
    // covers *most of the question* has to lead. Score alone would let one
    // strong title outrank a record that answers two of the reader's three
    // terms, and every mode-'any' answer is assembled this way.
    if (b.matched.size !== a.matched.size) return b.matched.size - a.matched.size
    if (b.score !== a.score) return b.score - a.score
    return (b.candidate.year ?? 0) - (a.candidate.year ?? 0)
  })

  // What the reader will actually see. In mode-'any' the floor above decides
  // what that is, and the counts below are taken from it, because they are the
  // numbers the page reports and a reader must be able to find them on screen.
  const shown: ScoredCandidate[] =
    options.listing || mode === 'all' ? pool : pool.filter(r => isWorthShowing(r, terms.length))
  const visible = new Set(shown)

  const counts: CollectionCount[] = (totals ?? dedupeTotals(candidates))
    .filter(t => (mode === 'all' ? t.completeTotal : t.matchTotal) > 0)
    .map(t => {
      const visibleInCollection = scored.filter(
        r => r.candidate.collection === t.collection && visible.has(r),
      ).length
      const count = mode === 'all' ? t.completeTotal : visibleInCollection
      return { collection: t.collection, label: t.label, count, broader: t.matchTotal }
    })
    .filter(c => c.count > 0)
    .map(c => (c.broader !== undefined && c.broader > c.count ? c : { ...c, broader: undefined }))
    .sort((a, b) => b.count - a.count)

  const totalMatched = counts.reduce((sum, c) => sum + c.count, 0)
  const broaderMatched = counts.reduce((sum, c) => sum + (c.broader ?? c.count), 0)

  const used: Record<string, number> = {}
  const seen = new Set<string>()
  const results: ScoredCandidate[] = []
  for (const r of shown) {
    // Collapsing duplicates here rather than at fetch time means the strongest
    // version of a record is the one that survives, whatever collection it came
    // from. Counts above still describe every row in the archive.
    const key = dedupeKey(r.candidate)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)

    const collection = r.candidate.collection
    const cap = CAPS[collection] ?? 3
    if ((used[collection] ?? 0) >= cap) continue
    used[collection] = (used[collection] ?? 0) + 1
    results.push(r)
    if (results.length >= TOTAL_TAKE) break
  }

  return {
    mode,
    results,
    collectionCounts: counts,
    totalMatched,
    ...(broaderMatched > totalMatched ? { broaderMatched } : {}),
  }
}

/** Fall back to per-candidate counts when no database totals were supplied. */
function dedupeTotals(candidates: SearchCandidate[]): CollectionTotal[] {
  const seen = new Map<string, CollectionTotal>()
  for (const c of candidates) {
    if (seen.has(c.collection)) continue
    seen.set(c.collection, {
      collection: c.collection,
      label: c.collectionLabel,
      matchTotal: c.matchTotal,
      completeTotal: c.completeTotal,
    })
  }
  return [...seen.values()]
}

/**
 * Search every published collection for the given terms.
 *
 * `contextTerms` are terms from earlier turns in the conversation. They only
 * influence the ordering of partial matches (see `CONTEXT_BOOST`); they are never
 * added to `terms`, so the set of records that can match is unchanged.
 */
/**
 * `terms` are the words to search for and `collections` are the collections to search
 * in; the caller has already split them, with `collectionFilter`, because the caller
 * also needs the same split to know which words a reader's question was answered by.
 */
export async function searchArchive(
  terms: string[],
  contextTerms: string[] = [],
  period: AskPeriod | null = null,
  collections: string[] = [],
): Promise<ArchiveSearchResult> {
  // `buildCandidateSql` refuses a query with neither terms nor a window nor a named
  // collection, and an AND over nothing matches everything — so this is a guard, not
  // a fallback. A period or a collection on its own is a question with an answer.
  if (terms.length === 0 && !period && collections.length === 0) {
    return { mode: 'none', terms, results: [], collectionCounts: [], totalMatched: 0 }
  }
  const { candidates, totals, undated } = await collectCandidates(terms, period, collections)
  const ranked = rankCandidates(candidates, terms, totals, contextTerms, {
    // With no topic to score against, every record in the window or the collection
    // is the answer and the relevance floor would empty the result.
    listing: terms.length === 0,
  })
  return {
    ...ranked,
    terms,
    ...(period ? { period } : {}),
    ...(undated.length ? { undated } : {}),
    ...(collections.length ? { collections } : {}),
  }
}

export { ASK_COLLECTION_LABELS }

/**
 * Which Prisma model backs each searchable collection. Exported so a test can
 * check every column named in the weight specs and in the SQL specs above
 * against the real schema, including its `@map` and `@@map` names.
 */
export const ASK_COLLECTION_MODELS = {
  documents: 'ArchiveItem',
  photos: 'Image',
  videos: 'Video',
  audio: 'Audio',
  news: 'News',
  milestones: 'Milestone',
  testimonials: 'Testimonial',
} as const

/**
 * The collections actually queried, with their real table names, so a test can
 * check the hand-written SQL against the schema's `@@map` declarations.
 */
export const ASK_SQL_TABLES = Object.fromEntries(
  Object.entries(SQL_SPECS).map(([collection, spec]) => [collection, spec.table]),
) as Record<Exclude<CollectionName, 'photos'>, string>

/** The candidate SQL, exported so a test can assert on its shape. */
export const askCandidateSql = buildCandidateSql
