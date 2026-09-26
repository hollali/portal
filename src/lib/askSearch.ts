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
import { termVariants, type AskMatchMode } from '@/lib/askQuery'

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
  hasTranscript: boolean
  /** Testimonial author role, where the collection has one. */
  role?: string | null
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
   * Records in this collection that satisfy the same bar the results were
   * selected under: every term, or at least one depending on the mode.
   */
  count: number
  /** Records matching any term, reported only when it is a larger number. */
  broader?: number
}

export interface ArchiveSearchResult {
  mode: AskMatchMode
  terms: string[]
  results: ScoredCandidate[]
  /** How many records each collection matched, counted in the database. */
  collectionCounts: CollectionCount[]
  totalMatched: number
  /** Records matching any term, when that is more than `totalMatched`. */
  broaderMatched?: number
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const yearOf = (v: unknown): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim()) return Number(v.slice(0, 4)) || null
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
export const NOT_ANSWERABLE: Record<string, string> = {
  photos: 'every row is uncaptioned and undated, so a match can only come from its scrape query',
}

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
  /** Static filter, i.e. published-only. */
  where?: string
  /** Deterministic tie-break, applied after relevance. */
  order: string
  /** Prisma field names whose `@map` renames the SQL column. */
  renamed?: Record<string, string>
}

const SQL_SPECS: Record<string, SqlSpec> = {
  documents: {
    table: 'archive_items',
    pick: ['kind', 'title', 'slug', 'year', 'excerpt', 'body'],
    where: `status = 'published'`,
    order: 'year DESC NULLS LAST, id DESC',
  },
  videos: {
    table: 'videos',
    pick: ['title', 'category', 'channel', 'source', 'platform', 'year'],
    where: `status = 'published'`,
    order: 'year DESC NULLS LAST, id DESC',
  },
  audio: {
    table: 'audio',
    pick: ['title', 'caption', 'artist', 'event', 'theme', 'location', 'category', 'notes', 'query', 'year'],
    where: `status = 'published'`,
    order: 'year DESC NULLS LAST, id DESC',
  },
  news: {
    // `News` has no status column; every row is a published clipping.
    table: 'news',
    pick: ['title', 'snippet', 'sourceName', 'date', 'notes', 'query'],
    order: 'id DESC',
    renamed: { sourceName: 'source_name' },
  },
  milestones: {
    table: 'milestones',
    pick: ['year', 'title', 'description', 'category'],
    where: `status = 'published'`,
    order: 'year ASC, id ASC',
  },
  testimonials: {
    table: 'testimonials',
    pick: ['author', 'role', 'quote', 'year', 'sortOrder'],
    where: `status = 'published'`,
    order: 'sort_order ASC, id ASC',
    renamed: { sortOrder: 'sort_order' },
  },
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/
/** Query terms are `[a-z0-9]`-only by the time they reach here, and stay that way. */
const PATTERN_TERM = /^[a-z0-9]{1,32}$/

function sqlColumn(spec: SqlSpec, field: string): string {
  const column = spec.renamed?.[field] ?? field
  if (!IDENTIFIER.test(column)) throw new Error(`[ask] refusing to build SQL: unsafe column "${column}"`)
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
function buildCandidateSql(collection: string, terms: string[]): string {
  const spec = SQL_SPECS[collection]
  if (!spec) throw new Error(`[ask] no SQL spec for collection "${collection}"`)
  if (!IDENTIFIER.test(spec.table)) throw new Error(`[ask] refusing to build SQL: unsafe table "${spec.table}"`)
  if (terms.length === 0) throw new Error('[ask] refusing to build SQL: no terms')

  const searched = Object.keys(W[collection as CollectionName])
  const columns = [...new Set(['id', ...searched, ...spec.pick])]
  const select = columns
    .map(field => {
      const column = sqlColumn(spec, field)
      return column === field ? column : `${column} AS "${field}"`
    })
    .join(', ')

  const loose = weightedExpr(collection, spec, terms)
  const strict = strictExpr(collection, spec, terms)

  return [
    `SELECT ${select},`,
    `  count(*) OVER ()::int AS "match_total",`,
    `  count(*) FILTER (WHERE ${strict}) OVER ()::int AS "strict_total"`,
    `FROM ${spec.table}`,
    spec.where ? `WHERE ${spec.where} AND ((${loose}) > 0)` : `WHERE ((${loose}) > 0)`,
    // Complete matches first, so the take can never drop them in favour of
    // records that only cover part of the question.
    `ORDER BY (CASE WHEN ${strict} THEN 1 ELSE 0 END) DESC, ${loose} DESC, ${spec.order}`,
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
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/[*_>]{1,3}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fallbackTitle(parts: Array<[string, string | null | undefined]>, id: number, noun: string): string {
  for (const [, v] of parts) if (v && String(v).trim()) return String(v).trim().slice(0, 120)
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
  const base = {
    matchTotal: totals.matchTotal,
    completeTotal: totals.completeTotal,
  }
  const withFields = (head: Omit<SearchCandidate, 'fields' | 'matchTotal' | 'completeTotal'>) => ({
    ...head,
    ...base,
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
        hasTranscript: Boolean(body),
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
        hasTranscript: false,
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
        hasTranscript: false,
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
        excerpt: str(r.snippet) || str(r.notes) || str(r.sourceName),
        hasTranscript: false,
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
        hasTranscript: false,
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
        excerpt: str(r.quote),
        hasTranscript: false,
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
 */
const dedupeKey = (c: SearchCandidate): string =>
  c.collection === 'testimonials' ? `${c.title}|${c.excerpt}` : normaliseTitle(c.title)

const normaliseTitle = (title: string): string =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Fetch and normalise every searchable collection in parallel. */
async function collectCandidates(
  terms: string[],
): Promise<{ candidates: SearchCandidate[]; totals: CollectionTotal[] }> {
  const perCollection = await Promise.all(
    SEARCHED.map(async collection => {
      const rows = await safeCollection(collection, () =>
        prisma.$queryRawUnsafe<Row[]>(buildCandidateSql(collection, terms)),
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

  return { candidates: perCollection.flatMap(t => t.candidates), totals }
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
): {
  mode: AskMatchMode
  results: ScoredCandidate[]
  collectionCounts: CollectionCount[]
  totalMatched: number
  broaderMatched?: number
} {
  const scored = candidates
    .map(c => scoreCandidate(c, terms))
    .filter(r => r.matched.size > 0)
    .map(r => ({ ...r, score: r.score * (PRIORITY[r.candidate.collection] ?? 1) }))

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
    // A partial answer is assembled from several records, so the record that
    // covers *most of the question* has to lead. Score alone would let one
    // strong title outrank a record that answers two of the reader's three
    // terms, and every mode-'any' answer is assembled this way.
    if (b.matched.size !== a.matched.size) return b.matched.size - a.matched.size
    if (b.score !== a.score) return b.score - a.score
    return (b.candidate.year ?? 0) - (a.candidate.year ?? 0)
  })

  const counts: CollectionCount[] = (totals ?? dedupeTotals(candidates))
    .filter(t => (mode === 'all' ? t.completeTotal : t.matchTotal) > 0)
    .map(t => {
      const count = mode === 'all' ? t.completeTotal : t.matchTotal
      return { collection: t.collection, label: t.label, count, broader: t.matchTotal }
    })
    .map(c => (c.broader !== undefined && c.broader > c.count ? c : { ...c, broader: undefined }))
    .sort((a, b) => b.count - a.count)

  const totalMatched = counts.reduce((sum, c) => sum + c.count, 0)
  const broaderMatched = counts.reduce((sum, c) => sum + (c.broader ?? c.count), 0)

  const used: Record<string, number> = {}
  const seen = new Set<string>()
  const results: ScoredCandidate[] = []
  for (const r of pool) {
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

/** Search every published collection for the given terms. */
export async function searchArchive(terms: string[]): Promise<ArchiveSearchResult> {
  // `buildCandidateSql` refuses to build a query with no terms, and an AND over
  // nothing matches everything — so this is a guard, not a fallback path.
  if (terms.length === 0) {
    return { mode: 'none', terms, results: [], collectionCounts: [], totalMatched: 0 }
  }
  const { candidates, totals } = await collectCandidates(terms)
  const ranked = rankCandidates(candidates, terms, totals)
  return { ...ranked, terms }
}

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
