import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  W,
  ASK_COLLECTION_MODELS,
  ASK_SQL_TABLES,
  NOT_ANSWERABLE,
  askCandidateSql,
  matchTerm,
  rankCandidates,
  scoreCandidate,
  plainText,
  bestPassage,
  normaliseTitle,
  sourceAccess,
  publisherUrl,
  type SearchCandidate,
} from '@/lib/askSearch'
import { foldSuffix, parsePeriod, queryTerms, termVariants } from '@/lib/askQuery'

/**
 * Regression guard for the class of bug that made the /ask feature look like it
 * worked while quietly answering from a fraction of the archive.
 *
 * `collectCandidates` used to build each collection's `where` clause from the
 * keys of its weight spec, and a `.catch(() => [])` — added so one bad
 * collection could not take down the whole answer — turned a Prisma error into
 * an empty result. The weight spec for videos named a `query` column the `Video`
 * model does not have, so every video query was rejected and all 430 published
 * videos were unfindable, with no error anywhere a user or the page could see.
 *
 * Those queries are now hand-written SQL, which moves the risk from a Prisma
 * validation error to a Postgres one: an unknown table or column is a syntax or
 * runtime failure rather than a compile error, and the `.catch` in
 * `safeCollection` would again turn it into a silent empty collection. So the
 * table and column names are checked against the schema here, `@map` and
 * `@@map` included, and the generated SQL is checked for the interpolated values
 * that are allowed to be in it.
 */

const schema = readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8')

interface ModelShape {
  /** Prisma field name -> SQL column name. */
  columns: Map<string, string>
  table: string
}

function modelShape(model: string): ModelShape {
  const block = schema.match(new RegExp(`model\\s+${model}\\s*\\{([\\s\\S]*?)\\n\\}`))
  if (!block) throw new Error(`model ${model} not found in prisma/schema.prisma`)

  const columns = new Map<string, string>()
  for (const line of block[1].split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue
    const [name, ...rest] = trimmed.split(/\s+/)
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) continue
    const map = rest.join(' ').match(/@map\("([^"]+)"\)/)
    columns.set(name, map ? map[1] : name)
  }

  const table = block[1].match(/@@map\("([^"]+)"\)/)?.[1] ?? model
  return { columns, table }
}

const COLLECTIONS = Object.keys(W) as Array<keyof typeof W>
const SEARCHED = COLLECTIONS.filter(c => !(c in NOT_ANSWERABLE))
const TERMS = ['independence', 'education']

describe('ask weight specs', () => {
  it('covers exactly the collections that have a model mapping', () => {
    expect([...COLLECTIONS].sort()).toEqual([...Object.keys(ASK_COLLECTION_MODELS)].sort())
  })

  it.each(COLLECTIONS)(
    'every column searched in "%s" exists on its Prisma model',
    collection => {
      const model = ASK_COLLECTION_MODELS[collection]
      const { columns } = modelShape(model)
      const missing = Object.keys(W[collection]).filter(field => !columns.has(field))
      expect(
        missing,
        `${model} has no column(s) ${missing.join(', ')} — a query naming them is ` +
          `rejected outright and the whole collection is silently dropped`,
      ).toEqual([])
    },
  )

  it('gives every collection at least one weighted field', () => {
    for (const collection of COLLECTIONS) {
      expect(Object.keys(W[collection]).length, `${collection} has no weights`).toBeGreaterThan(0)
    }
  })

  it('only uses positive weights, so a match can never lower a score', () => {
    for (const collection of COLLECTIONS) {
      for (const [field, weight] of Object.entries(W[collection])) {
        expect(weight, `${collection}.${field}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('ask SQL specs', () => {
  it('queries every collection that is not explicitly excluded', () => {
    expect([...SEARCHED].sort()).toEqual([...Object.keys(ASK_SQL_TABLES)].sort())
  })

  it('documents why each excluded collection is not searched', () => {
    for (const collection of COLLECTIONS) {
      if (SEARCHED.includes(collection)) continue
      expect(NOT_ANSWERABLE[collection], `${collection} is excluded with no stated reason`).toBeTruthy()
    }
  })

  it.each(SEARCHED)('the table for "%s" is the one the schema maps it to', collection => {
    const { table } = modelShape(ASK_COLLECTION_MODELS[collection])
    expect(
      ASK_SQL_TABLES[collection as Exclude<typeof collection, 'photos'>],
      `${ASK_COLLECTION_MODELS[collection]} is mapped to "${table}", not to the table the query reads`,
    ).toBe(table)
  })

  it.each(SEARCHED)('the columns the "%s" query reads all exist', collection => {
    const { columns } = modelShape(ASK_COLLECTION_MODELS[collection])
    const sql = askCandidateSql(collection, TERMS)
    // The select list is the authority: every identifier the query reads from the
    // table has to be a real column, aliasing included.
    const selected = sql
      .split('\n')[0]
      .replace(/^SELECT\s+/, '')
      .replace(/,$/, '')
      .split(',')
      .map(part => part.trim())
    const identifiers = selected.flatMap(part => {
      // A part of the form `<expression> AS "name"` is the query naming something
      // itself, so only what the expression reads has to exist. Without an alias
      // the whole part is an identifier and must be a column.
      const alias = part.match(/AS "([^"]+)"$/)
      if (!alias) return [part]
      return (
        part
          .slice(0, part.length - alias[0].length)
          // Keywords, not columns.
          .replace(/\b(?:IS|NOT|NULL|AND|OR|CASE|WHEN|THEN|END|CAST|COALESCE|TRUE|FALSE|SELECT)\b/gi, ' ')
          .match(/[a-z_][a-z0-9_]*/gi) ?? []
      )
    })
    const missing = identifiers.filter(
      name => !(columns.has(name) || [...columns.values()].includes(name)),
    )
    expect(
      missing,
      `${ASK_COLLECTION_MODELS[collection]} has no column(s) ${missing.join(', ')} — the query fails and the ` +
        `collection is silently dropped`,
    ).toEqual([])
  })

  it.each(SEARCHED)('the "%s" query only ever runs against published rows', collection => {
    const model = ASK_COLLECTION_MODELS[collection]
    const { columns } = modelShape(model)
    if (!columns.has('status')) return
    expect(askCandidateSql(collection, TERMS)).toContain(`status = 'published'`)
  })

  it.each(SEARCHED)('"%s" asks for both totals in the same query as the rows', collection => {
    const sql = askCandidateSql(collection, TERMS)
    expect(sql).toContain('count(*) OVER ()::int AS "match_total"')
    expect(sql).toContain('count(*) FILTER (WHERE')
    expect(sql).toContain('AS "strict_total"')
  })

  it.each(SEARCHED)('"%s" ranks complete matches ahead of partial ones', collection => {
    // Otherwise the 60-row take can drop the very records that answer the whole
    // question in favour of ones covering half of it, and the count the database
    // reports then describes records the page never saw.
    const sql = askCandidateSql(collection, TERMS)
    const order = sql.slice(sql.indexOf('ORDER BY'))
    expect(order).toContain('ORDER BY (CASE WHEN')
    expect(order).toContain(' DESC, (CASE WHEN')
  })

  it('refuses to build SQL for an unsafe term rather than interpolating it', () => {
    // The patterns are inlined because Neon's driver binds a single parameter and
    // this query needs none. That is only safe while every term is plain
    // lowercase alphanumerics, so the guard has to throw — an escaped-instead
    // version would be a query that returns the wrong rows when it matters.
    expect(() => askCandidateSql('news', ["x' OR 1=1 --"])).toThrow(/unsafe term/)
    expect(() => askCandidateSql('news', ['a; DROP TABLE news'])).toThrow(/unsafe term/)
    expect(() => askCandidateSql('news', [])).toThrow(/no terms/)
    expect(() => askCandidateSql('nope', TERMS)).toThrow(/no SQL spec/)
  })

  it('allows an empty term list only when a window or a named collection makes it a question', () => {
    // "What happened in 2024?" and "any photographs?" are both answerable, and an
    // AND over nothing would match the whole table instead.
    expect(() => askCandidateSql('news', [])).toThrow(/no terms/)
    expect(() => askCandidateSql('news', [], parsePeriod('in 2024'))).not.toThrow()
    expect(() => askCandidateSql('news', [], null, true)).not.toThrow()
    // The predicate really is empty — `news` is the one spec with no `status`
    // clause — so the `WHERE` is left off rather than emitted empty, which would
    // be a syntax error caught and hidden by `safeCollection`.
    const listing = askCandidateSql('news', [], null, true)
    expect(listing).not.toContain('LIKE')
    expect(listing).not.toMatch(/WHERE\s*\n/)
    expect(listing).toContain('FROM news')
    expect(listing).toContain('ORDER BY id DESC')
  })

  it('interpolates nothing but validated patterns and spec identifiers', () => {
    const sql = askCandidateSql('news', TERMS)
    const quoted = [...sql.matchAll(/'([^']*)'/g)].map(m => m[1])
    for (const literal of quoted) {
      // The only literals should be the status filter and the term patterns,
      // whose contents are a boundary expression over `[a-z0-9]` alternatives.
      const isPattern = /^\(\^\|\[\^a-z0-9\]\)\([a-z0-9|]+\)$/.test(literal)
      expect(isPattern || literal === 'published', `unexpected literal in SQL: ${literal}`).toBe(true)
    }
  })
})

describe('matchTerm', () => {
  it('matches at the start of a word and into longer words', () => {
    expect(matchTerm('parliamentary prayers', 'parliament')).toBe(true)
    expect(matchTerm('the parliament', 'parliament')).toBe(true)
    expect(matchTerm('parliament', 'parliament')).toBe(true)
  })

  it('rejects a term buried inside a longer word', () => {
    // These are the cases that made the substring search report 18 records about
    // "art" that were really about "Part".
    expect(matchTerm('a part of it', 'art')).toBe(false)
    expect(matchTerm('restarting the engine', 'art')).toBe(false)
    expect(matchTerm('the administration budget', 'min')).toBe(false)
  })

  it('is case-insensitive and handles punctuation either side', () => {
    expect(matchTerm('Alban, and Youth', 'youth')).toBe(true)
    expect(matchTerm("Alban's youth", 'youth')).toBe(true)
  })

  it('agrees with the word-start rule the SQL uses', () => {
    // The SQL side cannot use a lookbehind, so it consumes the boundary
    // character. Both forms have to accept the same strings, or the counts the
    // database reports stop describing the rows it selected.
    const sqlEquivalent = (text: string, variant: string) => new RegExp(`(^|[^a-z0-9])${variant}`, 'i').test(text)
    const samples = [
      'parliamentary',
      'a part of it',
      'Youth!',
      'youthful delegation',
      'reYouth',
      'corruption',
      'the youth of Ghana',
    ]
    for (const text of samples) {
      for (const variant of ['parliament', 'art', 'youth', 'corruption']) {
        expect(matchTerm(text, variant), `${text} / ${variant}`).toBe(sqlEquivalent(text, variant))
      }
    }
  })
})

describe('foldSuffix', () => {
  it('folds a regular suffix to a shared root', () => {
    expect(foldSuffix('independence')).toBe('independ')
    expect(foldSuffix('corruption')).toBe('corrupt')
    expect(foldSuffix('development')).toBe('develop')
  })

  it('leaves a word alone when folding would leave too little of it', () => {
    // A three-letter stem is no longer a word boundary, it is a guess.
    expect(foldSuffix('moment')).toBeNull()
    expect(foldSuffix('comment')).toBeNull()
  })

  it('never produces something that is not a prefix of the original', () => {
    for (const term of ['parliament', 'education', 'youth', 'development', 'independence', 'minister', 'security']) {
      const folded = foldSuffix(term)
      if (folded) expect(term.startsWith(folded), `${term} -> ${folded}`).toBe(true)
    }
  })

  it('is what lets a question find the other form of a word', () => {
    expect(termVariants('independence')).toContain('independ')
    expect(termVariants('development')).toContain('develop')
  })
})

describe('queryTerms', () => {
  it('drops the subject\'s own name, which every scraped record contains', () => {
    // Measured: all 430 videos, 254 audio rows and 134 news clippings carry
    // "Alban Sumana Kingsford Bagbin", and all 283 photographs carry nothing but
    // that name. Searching it produced ~250 headline cards that all said the
    // same thing.
    expect(queryTerms('Alban Bagbin')).toEqual([])
    expect(queryTerms('What did Alban Bagbin say about corruption?')).toEqual(['corruption'])
  })

  it('keeps a real question intact', () => {
    expect(queryTerms('What has the Speaker said about democracy?')).toEqual(['democracy'])
    expect(queryTerms('education and the youth')).toEqual(['education', 'youth'])
  })
})

/* -------------------------------------------------------------------------- */

function candidate(over: Partial<SearchCandidate> = {}): SearchCandidate {
  return {
    collection: 'videos',
    collectionLabel: 'Videos',
    kind: 'video',
    kindLabel: 'Video',
    title: 'A video',
    href: '/videos/1',
    year: 2024,
    excerpt: '',
    body: '',
    hasTranscript: false,
    url: null,
    sourceName: null,
    fields: [{ weight: 5, text: 'a video' }],
    matchTotal: 1,
    completeTotal: 1,
    ...over,
  }
}

describe('scoreCandidate', () => {
  it('scores each term once, at its strongest field', () => {
    const c = candidate({
      fields: [
        { weight: 6, text: 'corruption' },
        { weight: 1, text: 'corruption corruption corruption' },
      ],
    })
    expect(scoreCandidate(c, ['corruption']).score).toBe(6)
  })

  it('does not match a term that only appears inside a longer word', () => {
    const c = candidate({ fields: [{ weight: 6, text: 'a part of the plan' }] })
    expect(scoreCandidate(c, ['art']).matched.size).toBe(0)
  })

  it('rewards a record that names every term in one strong field', () => {
    const both = candidate({ fields: [{ weight: 5, text: 'parliament and independence' }] })
    const split = candidate({
      fields: [
        { weight: 3, text: 'parliament' },
        { weight: 3, text: 'independence' },
      ],
    })
    const terms = ['parliament', 'independence']
    expect(scoreCandidate(both, terms).score).toBeGreaterThan(scoreCandidate(split, terms).score)
  })

  it('does not award the phrase bonus for a weak field', () => {
    // Body text listing both words is not a headline answering the question.
    const body = candidate({
      fields: [
        { weight: 1, text: 'parliament and independence' },
        { weight: 1, text: 'parliament' },
      ],
    })
    const title = candidate({
      fields: [
        { weight: 5, text: 'parliament' },
        { weight: 1, text: 'independence' },
      ],
    })
    const terms = ['parliament', 'independence']
    expect(scoreCandidate(body, terms).score).toBeLessThan(scoreCandidate(title, terms).score)
  })
})

describe('rankCandidates', () => {
  const terms = ['parliament', 'independence']

  it('reports the counts the database returned, not the size of the candidate pool', () => {
    // The bug this guards: 421 videos matched and the page said "60", because the
    // count came from the rows that survived a 60-row take.
    const candidates = [
      candidate({ matchTotal: 421, completeTotal: 3, fields: [{ weight: 5, text: 'parliament independence' }] }),
    ]
    const ranked = rankCandidates(candidates, terms, [
      { collection: 'videos', label: 'Videos', matchTotal: 421, completeTotal: 3 },
    ])
    expect(ranked.totalMatched).toBe(3)
    expect(ranked.broaderMatched).toBe(421)
    expect(ranked.collectionCounts[0]).toEqual({ collection: 'videos', label: 'Videos', count: 3, broader: 421 })
  })

  it('omits the broader count when the two are the same', () => {
    const ranked = rankCandidates([candidate({ fields: [{ weight: 5, text: 'corruption' }] })], ['corruption'], [
      { collection: 'videos', label: 'Videos', matchTotal: 7, completeTotal: 7 },
    ])
    expect(ranked.broaderMatched).toBeUndefined()
    expect(ranked.collectionCounts[0].broader).toBeUndefined()
  })

  it('drops a collection whose every record is below the relevance floor', () => {
    // The database said seven videos mentioned "corruption"; the floor decides
    // none of them is worth showing. Printing "7 videos" beside an empty list
    // would be the page claiming coverage the reader cannot see.
    const ranked = rankCandidates([candidate({ fields: [{ weight: 5, text: 'a video' }] })], ['corruption'], [
      { collection: 'videos', label: 'Videos', matchTotal: 7, completeTotal: 0 },
    ])
    expect(ranked.results).toHaveLength(0)
    expect(ranked.totalMatched).toBe(0)
    expect(ranked.collectionCounts).toEqual([])
  })

  it('prefers complete matches and reports them as the total in that mode', () => {
    const complete = candidate({ title: 'complete', fields: [{ weight: 5, text: 'parliament independence' }] })
    const partial = candidate({ title: 'partial', fields: [{ weight: 5, text: 'parliament' }] })
    const ranked = rankCandidates([partial, complete], terms, [
      { collection: 'videos', label: 'Videos', matchTotal: 2, completeTotal: 1 },
    ])
    expect(ranked.mode).toBe('all')
    expect(ranked.results[0].candidate.title).toBe('complete')
    expect(ranked.totalMatched).toBe(1)
  })

  it('treats a question as partial when no record covers every term', () => {
    const ranked = rankCandidates([candidate({ fields: [{ weight: 5, text: 'parliament' }] })], terms, [
      { collection: 'videos', label: 'Videos', matchTotal: 1, completeTotal: 0 },
    ])
    expect(ranked.mode).toBe('any')
    expect(ranked.totalMatched).toBe(1)
  })

  it('leads a partial answer with the record covering the most terms', () => {
    const one = candidate({ title: 'one', fields: [{ weight: 5, text: 'parliament' }] })
    const two = candidate({
      title: 'two',
      fields: [
        { weight: 2, text: 'parliament' },
        { weight: 2, text: 'independence' },
      ],
    })
    const ranked = rankCandidates([one, two], terms, [
      { collection: 'videos', label: 'Videos', matchTotal: 2, completeTotal: 0 },
    ])
    expect(ranked.results[0].candidate.title).toBe('two')
  })

  it('does not report the same record twice', () => {
    // One speech scraped as both audio and video, 19 of 134 news rows being
    // duplicates of another headline: a list of ten with the same title in it
    // says nothing the first one did not.
    const hit = { weight: 5, text: 'corruption' }
    const asVideo = candidate({ title: 'Bagbin on corruption', collection: 'videos', fields: [hit] })
    const asAudio = candidate({
      title: 'Bagbin  on   corruption',
      collection: 'audio',
      collectionLabel: 'Audio',
      fields: [hit],
    })
    const ranked = rankCandidates([asVideo, asAudio], ['corruption'], [
      { collection: 'videos', label: 'Videos', matchTotal: 1, completeTotal: 1 },
      { collection: 'audio', label: 'Audio', matchTotal: 1, completeTotal: 1 },
    ])
    expect(ranked.results).toHaveLength(1)
  })

  /**
   * The same clipping, scraped three times: once whole, once with a date, once
   * with a date and a byline. All three carry the publisher that published them,
   * so all three reduce to one headline and the reader gets one card.
   */
  it('does not report one clipping twice when a scraper changed its suffix', () => {
    const hit = { weight: 5, text: 'citizenship' }
    const plain = candidate({ title: 'Council of State opposes citizenship bill', fields: [hit] })
    const withDate = candidate({
      title: 'Council of State opposes citizenship bill - Graphic Online - 3 hours ago',
      url: 'https://graphic.com.gh/news/citizenship',
      fields: [hit],
    })
    const withByline = candidate({
      title: 'Council of State opposes citizenship bill - Graphic Online - 3 hours ago - By Nii Ayikwei Okine',
      url: 'https://graphic.com.gh/news/citizenship',
      fields: [hit],
    })
    const ranked = rankCandidates([plain, withDate, withByline], ['citizenship'], [
      { collection: 'news', label: 'News', matchTotal: 3, completeTotal: 3 },
    ])
    expect(ranked.results).toHaveLength(1)
  })

  it('keeps two episodes of one programme apart', () => {
    // "… (2ND DEPUTY SPEAKER OF PARLIAMENT) PART ONE" and "PART TWO" share every
    // word up to the eighth. Collapsing them would hide an episode.
    const hit = { weight: 5, text: 'deputy' }
    const one = candidate({ title: 'EXCLUSIVE WITH HON ALBAN BAGBIN (2ND DEPUTY SPEAKER) PART ONE', fields: [hit] })
    const two = candidate({ title: 'EXCLUSIVE WITH HON ALBAN BAGBIN (2ND DEPUTY SPEAKER) PART TWO', fields: [hit] })
    const ranked = rankCandidates([one, two], ['deputy'], [
      { collection: 'videos', label: 'Videos', matchTotal: 2, completeTotal: 2 },
    ])
    expect(ranked.results).toHaveLength(2)
  })

  it('keeps two testimonials by the same author when the quotes differ', () => {
    const mk = (quote: string) =>
      candidate({
        collection: 'testimonials',
        collectionLabel: 'Testimonials',
        title: 'Ama B',
        excerpt: quote,
        fields: [{ weight: 5, text: quote }],
      })
    const ranked = rankCandidates([mk('one quote'), mk('another quote')], ['quote'], [
      { collection: 'testimonials', label: 'Testimonials', matchTotal: 2, completeTotal: 2 },
    ])
    expect(ranked.results).toHaveLength(2)
  })

  it('still answers partially when a complete count comes back with no complete row', () => {
    // The database promised a complete match the fetch did not return. Better to
    // answer partially and say so than to answer "nothing found".
    const ranked = rankCandidates([candidate({ fields: [{ weight: 5, text: 'parliament' }] })], terms, [
      { collection: 'videos', label: 'Videos', matchTotal: 1, completeTotal: 1 },
    ])
    expect(ranked.mode).toBe('any')
    expect(ranked.results).toHaveLength(1)
  })

  it('caps a single collection so the largest cannot decide the answer', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      candidate({ title: `video ${i}`, fields: [{ weight: 5, text: 'parliament' }] }),
    )
    const doc = candidate({
      collection: 'documents',
      collectionLabel: 'Archive documents',
      title: 'a document',
      fields: [{ weight: 6, text: 'parliament' }],
    })
    const ranked = rankCandidates([...many, doc], ['parliament'], [
      { collection: 'videos', label: 'Videos', matchTotal: 12, completeTotal: 12 },
      { collection: 'documents', label: 'Archive documents', matchTotal: 1, completeTotal: 1 },
    ])
    const videos = ranked.results.filter(r => r.candidate.collection === 'videos')
    const documents = ranked.results.filter(r => r.candidate.collection === 'documents')
    expect(videos.length).toBeLessThanOrEqual(3)
    expect(documents).toHaveLength(1)
  })
})

/**
 * The relevance floor.
 *
 * Every candidate is by definition a record that matched at least one term, so
 * without a floor the archive answers anything at all: "quantum computing policy"
 * came back with the Water Resources ministry milestone, matched on the word
 * "policy" in its description. A confident-looking non-answer is worse than the
 * refusal the reader would otherwise get, because it looks like coverage.
 */
describe('the relevance floor', () => {
  const threeTerms = ['quantum', 'computing', 'policy']

  it('drops a partial match that covers too little of the question', () => {
    const milestone = candidate({
      collection: 'milestones',
      title: 'Minister for Water Resources',
      fields: [
        { weight: 5, text: 'minister for water resources' },
        { weight: 4, text: 'oversees water policy and irrigation' },
      ],
    })
    const ranked = rankCandidates([milestone], threeTerms, [
      { collection: 'milestones', label: 'Milestones', matchTotal: 1, completeTotal: 0 },
    ])
    expect(ranked.results).toHaveLength(0)
  })

  it('drops a match that only describes the subject rather than naming it', () => {
    // "cattle ranching in the North East" is in neither title nor caption of this
    // milestone, only in the description as a region he attended school in. The
    // words match; the subject does not.
    const school = candidate({
      collection: 'milestones',
      title: 'Attended Tamale Secondary School',
      fields: [
        { weight: 5, text: 'attended tamale secondary school' },
        { weight: 4, text: 'in the northern region of ghana, near the north east' },
      ],
    })
    const ranked = rankCandidates([school], ['cattle', 'ranching', 'north', 'east'], [
      { collection: 'milestones', label: 'Milestones', matchTotal: 1, completeTotal: 0 },
    ])
    expect(ranked.results).toHaveLength(0)
  })

  it('keeps a record naming the subject in its title', () => {
    const clip = candidate({
      collection: 'news',
      title: 'Ghana to host quantum computing summit',
      fields: [{ weight: 5, text: 'ghana to host quantum computing summit' }],
    })
    const ranked = rankCandidates([clip], ['quantum', 'summit', 'policy'], [
      { collection: 'news', label: 'News', matchTotal: 1, completeTotal: 0 },
    ])
    expect(ranked.results).toHaveLength(1)
  })

  it('keeps a record that covers every term however weakly it matched', () => {
    // Nothing is complete here, so the mode is partial and the floor applies. A
    // record holding all three words has still answered the question, and it must
    // not lose to a stronger title match on one of them.
    const weak = candidate({
      title: 'weak',
      fields: [
        { weight: 1, text: 'quantum' },
        { weight: 1, text: 'computing' },
        { weight: 1, text: 'policy' },
      ],
    })
    const ranked = rankCandidates([weak], threeTerms, [
      { collection: 'videos', label: 'Videos', matchTotal: 1, completeTotal: 0 },
    ])
    expect(ranked.results.map(r => r.candidate.title)).toEqual(['weak'])
  })

  it('leaves complete answers alone', () => {
    const complete = candidate({
      title: 'complete',
      fields: [
        { weight: 5, text: 'quantum computing' },
        { weight: 1, text: 'policy' },
      ],
    })
    const ranked = rankCandidates([complete], threeTerms, [
      { collection: 'videos', label: 'Videos', matchTotal: 1, completeTotal: 1 },
    ])
    expect(ranked.mode).toBe('all')
    expect(ranked.results).toHaveLength(1)
  })

  it('keeps a single-term question at one match', () => {
    // "E-Levy" must not be thrown out for naming it once, which is why the floor
    // is a fraction of the question rather than a term count.
    const speech = candidate({
      collection: 'documents',
      fields: [{ weight: 6, text: 'e levy bill' }],
    })
    const ranked = rankCandidates([speech], ['levy'], [
      { collection: 'documents', label: 'Archive documents', matchTotal: 1, completeTotal: 1 },
    ])
    expect(ranked.results).toHaveLength(1)
  })
})

/* -------------------------------------------------------------------------- */

describe('plainText', () => {
  // These bodies get quoted to the reader as the Speaker's own words, so a
  // markup artefact surviving into the text is shown as though he said it.
  const body = [
    '## Financing the legislature',
    '',
    'A legislature that depends on the goodwill of the Executive **cannot fully**',
    'exercise over the purse.',
    '',
    '### On poverty strategy',
    '',
    '*Mr. Speaker*, it has become fashionable to speak of poverty-reduction',
    'strategies, and to treat them as a document rather than a duty.',
    '',
    '> The House sits, and the House decides.',
  ].join('\n')

  it('drops headings so they do not run into the first sentence', () => {
    const out = plainText(body)
    expect(out).not.toContain('Financing the legislature')
    expect(out).not.toContain('On poverty strategy')
    expect(out.startsWith('A legislature that depends')).toBe(true)
  })

  it('closes emphasis without leaving a gap before punctuation', () => {
    const out = plainText(body)
    expect(out).toContain('Mr. Speaker, it has become fashionable')
    expect(out).not.toMatch(/\s[,.;:!?]/)
  })

  it('keeps the sentence itself intact', () => {
    expect(plainText(body)).toContain(
      'A legislature that depends on the goodwill of the Executive cannot fully exercise over the purse.',
    )
  })

  it('unwraps a blockquote without gluing words together', () => {
    expect(plainText(body)).toContain('The House sits, and the House decides.')
  })
})

describe('bestPassage', () => {
  // A card shows 150 characters of a long speech. Before this existed it showed
  // whatever came first in the file, so a reader asking about one subject was
  // shown a paragraph about another and concluded the archive did not cover it.
  const long = candidate({
    excerpt: 'The Speaker on the state of the nation.',
    body: [
      'The House opens with a statement of business for the week.',
      'Members then rise to observe a minute of silence for the fallen.',
      'A colleague asks about the state of the opposition benches and their conduct.',
      'The Speaker replies that the House will return to the state of the nation later.',
    ].join(' '),
  })

  it('windows around the match instead of the opening of the record', () => {
    const out = bestPassage(long, ['opposition'], 120)
    expect(out).toContain('opposition benches')
    expect(out).not.toContain('a minute of silence')
    // Marked as an excerpt, so it does not read as the whole record.
    expect(out.startsWith('…')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
  })

  it('prefers the record’s own words over the editorial summary', () => {
    // The excerpt is written *about* the speech. The body is the speech. Quoting
    // the first as his words is the mistake this field distinction prevents.
    const out = bestPassage(long, ['conduct'], 120)
    expect(out).toContain('their conduct')
  })

  it('falls back to the opening when nothing in the record matches', () => {
    const out = bestPassage(long, ['no such term'], 60)
    expect(out.startsWith('The Speaker on the state')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(61)
  })

  it('never cuts mid-word', () => {
    const out = bestPassage(long, ['conduct'], 45)
    expect(out.endsWith('…')).toBe(true)
    // The visible text has to be an unbroken run of the record: if the character
    // after it in the source is a letter, a word has been cut in half.
    const visible = out.replace(/^…/, '').replace(/…$/, '')
    const at = long.body!.indexOf(visible)
    expect(at).toBeGreaterThan(0)
    expect(long.body![at + visible.length]).toMatch(/[. ]/)
  })

  it('handles a record with no body, such as a scraped video row', () => {
    const media = candidate({ excerpt: 'Address to Parliament · GBC', body: '', fields: [] })
    expect(bestPassage(media, ['parliament'], 100)).toBe('Address to Parliament · GBC')
  })

  it('keeps a full excerpt whole rather than truncating needlessly', () => {
    const short = candidate({ excerpt: 'Bagbin calls for judicial independence.', body: '' })
    expect(bestPassage(short, ['judicial'], 150)).toBe('Bagbin calls for judicial independence.')
  })
})

/**
 * The headline a paper wrote, recovered from the headline a scraper stored.
 *
 * A scraper saves "<headline> - <publisher>", "… | 3 hours ago", and
 * "… - <publisher> - 2 days ago - By <reporter>", while the reader needs only the
 * first part. Getting this wrong is visible twice over: the same article is shown
 * as several cards, and the same headline stored with and without its suffix
 * reads as two different stories.
 *
 * A publisher comes off only when the host backs it up. A hardcoded list of
 * Ghanaian papers would rot on the next scrape, and cutting at every dash would
 * invent a different headline out of "Nominate Alban Bagbin as Speaker of 9th
 * Parliament – Mahama tells NDC caucus", so a suffix qualifies only when every
 * distinctive word in it appears in the host that published this very row. With
 * no host, nothing is guessed.
 *
 * A date or byline needs no such backing: "… - 12 Jun" is metadata whoever
 * scraped it, and leaving it in is what keeps one clipping on two cards.
 */
describe('normaliseTitle', () => {
  const cases: Array<[string, string | null, string]> = [
    // Provenance that must come off, checked against its own host.
    ['Bagbin: I am not bound by Presidential directives - CitiNewsroom.com', 'www.citinewsroom.com', 'bagbin i am not bound by presidential directives'],
    ['Speaker Bagbin pledges government support for UBIDS, backs bid to train lawyers - 3News', '3news.com', 'speaker bagbin pledges government support for ubids backs bid to train lawyers'],
    ['Misleading! Video of Speaker Bagbin celebrating Black Stars goal unrelated to 2026 win over Panama, it\'s from 2022 - ghanafact.com', 'ghanafact.com', 'misleading video of speaker bagbin celebrating black stars goal unrelated to 2026 win over panama it s from 2022'],
    ['Bagbin markets Ghana as \u201cGateway for Africa, Euro-Med & Gulf Trade\u201d - Ghana News Agency', 'www.ghananewsagency.org', 'bagbin markets ghana as gateway for africa euro med gulf trade'],
    ['Alumni Spotlight - Rt. Hon. Kingsford Alban Sumana Bagbin', 'alumni.ug.edu.gh', 'alumni spotlight rt hon kingsford alban sumana bagbin'],
    // A date or byline after the publisher must not stop the strip reaching it.
    ['Bagbin refers constitution amendment bill to committee - Graphic Online - 3 hours ago', 'graphic.com.gh', 'bagbin refers constitution amendment bill to committee'],
    ['Bagbin refers constitution amendment bill to committee - Graphic Online - 30 Oct 2025', 'graphic.com.gh', 'bagbin refers constitution amendment bill to committee'],
    ['Parliament backs National General Cleaning Days - Ghana News Agency - 2 days ago - By Godwill Arthur-Mensah', 'www.ghananewsagency.org', 'parliament backs national general cleaning days'],
    // A pipe ends the headline outright: nothing follows one in a headline.
    ['Bagbin refers constitutional amendment bill to committee following Council of State\'s advice - Modern Ghana | 1 hour ago', 'www.modernghana.com.gh', 'bagbin refers constitutional amendment bill to committee following council of state s advice'],
    // Interior dashes that are not provenance, and must survive whole.
    ['Nominate Alban Bagbin as Speaker of 9th Parliament – Mahama tells NDC caucus', 'citinewsroom.com', 'nominate alban bagbin as speaker of 9th parliament mahama tells ndc caucus'],
    ['African autocrats — and US right wing — demand “sovereignty” at a Family Values conference in Accra', 'citinewsroom.com', 'african autocrats and us right wing demand sovereignty at a family values conference in accra'],
    ['Theatrics and drama should be sparingly invoked – Speaker Bagbin', 'citinewsroom.com', 'theatrics and drama should be sparingly invoked speaker bagbin'],
    ['Alban Bagbin is my favourite Speaker in the fourth republic – Kofi Bentil', 'citinewsroom.com', 'alban bagbin is my favourite speaker in the fourth republic kofi bentil'],
    // A suffix nobody can vouch for is left alone rather than guessed at.
    ['Respect Africa\'s sovereignty, don\'t attach conditions to aid – Bagbin - CitiNewsroom.com', 'www.bing.com', 'respect africa s sovereignty don t attach conditions to aid bagbin citinewsroom com'],
    // Never reduced to a bare publisher.
    ['Alban Bagbin - CitiNewsroom.com', 'citinewsroom.com', 'alban bagbin'],
  ]

  for (const [raw, host, want] of cases) {
    it(`reduces ${JSON.stringify(raw.slice(0, 56))}… to the headline`, () => {
      expect(normaliseTitle(raw, host)).toBe(want)
    })
  }

  it('collapses punctuation-only differences when no host is available', () => {
    expect(normaliseTitle('Justice D. F. Annan’s passing')).toBe(
      normaliseTitle('Justice D F Annan’s passing'),
    )
  })
})

describe('the date filter', () => {
  const TERMS = ['economy']
  const Y = { from: 2019, to: 2021, label: '2019–2021' }

  it('restricts every collection that stores a date', () => {
    for (const collection of ['documents', 'news', 'milestones', 'testimonials']) {
      const sql = askCandidateSql(collection, TERMS, Y)
      expect(sql).toMatch(/WHERE/)
      expect(sql).toMatch(/>= 2019/)
      expect(sql).toMatch(/<= 2021/)
    }
  })

  it('leaves the collections that store none out of a dated answer', () => {
    // Every video and audio row has a null `year`. Filtering on it would answer
    // a question about 2019–2021 with a 2023 recording and call it evidence.
    for (const collection of ['videos', 'audio']) {
      expect(() => askCandidateSql(collection, TERMS, Y)).toThrow(/no date/i)
    }
  })

  it('binds both ends of an open-ended window and nothing else', () => {
    const since = askCandidateSql('documents', TERMS, { from: 2020, to: null, label: 'since 2020' })
    expect(since).toMatch(/>= 2020/)
    expect(since).not.toMatch(/<= /)
    const until = askCandidateSql('documents', TERMS, { from: null, to: 1998, label: 'up to 1998' })
    expect(until).toMatch(/<= 1998/)
    expect(until).not.toMatch(/>= /)
  })

  it('reads a news date the way the columns actually hold it', () => {
    // ISO on some rows, RFC 2822 on others. A leading four-character slice would
    // read "Wed," as a year and filter every clipping out of every answer.
    const sql = askCandidateSql('news', TERMS, { from: 2026, to: 2026, label: '2026' })
    expect(sql).toMatch(/substring/)
    expect(sql).toMatch(/\\d\{4\}/)
  })

  it('takes the earliest records of a window when there is no topic to rank by', () => {
    // A take ordered by id would return only the newest rows of a decade, and
    // "the 1990s" would show the 1990s' last year.
    const sql = askCandidateSql('milestones', [], { from: 1990, to: 1999, label: 'the 1990s' })
    expect(sql).toMatch(/ORDER BY \(.+\) ASC/)
  })

  it('still asks for a topic when the question gave one', () => {
    const sql = askCandidateSql('milestones', TERMS, { from: 1990, to: 1999, label: 'the 1990s' })
    expect(sql).toMatch(/ORDER BY \(CASE WHEN/)
  })

  it('is not built by interpolating anything the reader typed', () => {
    const sql = askCandidateSql('news', TERMS, Y)
    // Only the validated terms and integer bounds may appear in the query text.
    const literals = sql.match(/'[^']*'/g) ?? []
    for (const literal of literals) {
      expect(literal).not.toMatch(/union|select|drop|;/i)
    }
    expect(sql).not.toMatch(/\$\{/)
  })
})

describe('ranking a dated answer', () => {
  /** A window with no topic: no terms, no totals, ranked chronologically. */
  const asWindow = (candidates: SearchCandidate[]) =>
    rankCandidates(candidates, [], undefined, [], { listing: true })

  const doc = (year: number | null, title: string, text = '') =>
    candidate({
      collection: 'documents',
      collectionLabel: 'Archive documents',
      kind: 'speech',
      kindLabel: 'Speech',
      title,
      year,
      href: `/archives/documents/${year ?? 'undated'}`,
      excerpt: text,
      fields: [
        { weight: 3, text: title },
        ...(text ? [{ weight: 1, text }] : []),
      ],
    })

  const milestone = (year: number, title: string) =>
    candidate({
      collection: 'milestones',
      collectionLabel: 'Milestones',
      kind: 'milestone',
      kindLabel: 'Milestone',
      title,
      year,
      href: '/archives/milestones',
      fields: [{ weight: 3, text: title }],
      matchTotal: 3,
      completeTotal: 3,
    })

  it('orders a window oldest first, because that is the order it happened in', () => {
    // Documents, because milestones are capped at two — that cap is about how
    // much of the timeline to render, not about chronology.
    const ranked = asWindow([
      doc(2026, 'Newest'),
      doc(2021, 'Oldest'),
      doc(2023, 'Middle'),
    ])
    expect(ranked.results.map(r => r.candidate.title)).toEqual(['Oldest', 'Middle', 'Newest'])
  })

  it('counts every record in the window, not only the ones it can show', () => {
    // "119 records matched, the 3 strongest shown" has to be true, and those two
    // numbers come from different places.
    const ranked = asWindow([
      milestone(2021, 'Oldest'),
      milestone(2026, 'Newest'),
      milestone(2023, 'Middle'),
    ])
    expect(ranked.results).toHaveLength(2)
    expect(ranked.totalMatched).toBe(3)
  })

  it('does not drop a window\'s records for weak term coverage', () => {
    // With no topic there is nothing to cover, so the relevance floor would throw
    // the whole window away and report "nothing published" for a year the archive
    // plainly covers.
    const ranked = asWindow([doc(2021, 'Address on the State of the Nation')])
    expect(ranked.results).toHaveLength(1)
    expect(ranked.mode).toBe('all')
  })

  it('keeps the floor for a question with both a topic and a window', () => {
    const ranked = rankCandidates(
      [
        doc(2021, 'Passing mention', 'the economy was not discussed'),
        doc(2022, 'On the state of the economy', 'the economy and the debt ceiling'),
      ],
      ['economy', 'debt'],
    )
    expect(ranked.results.map(r => r.candidate.title)).toContain('On the state of the economy')
  })

  it('leads with the record that answers the most of the question', () => {
    const ranked = rankCandidates(
      [
        doc(2021, 'On the economy', 'the economy'),
        doc(2022, 'On the economy and the debt', 'the economy and the debt ceiling'),
      ],
      ['economy', 'debt'],
    )
    expect(ranked.results[0].candidate.title).toBe('On the economy and the debt')
  })
})

describe('where a clipping can actually be read', () => {
  it('offers the publisher\'s own page, not the aggregator\'s', () => {
    // 46 of the archive's 134 news rows store Bing's redirect address. Following
    // it on the reader's behalf sends them through a search engine's feed and,
    // for a reader on a metered connection or a slow link, past a page that has
    // nothing to do with the Speech.
    const wrapped =
      'http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=6a51c5&url=https%3a%2f%2fwww.primenewsghana.com%2fpolitics%2fcouncil.html&c=1&mkt=en-ww'
    const access = sourceAccess(wrapped, 'Bing News')
    expect(access.url).toBe('https://www.primenewsghana.com/politics/council.html')
    // And the publisher is named by its hostname, because the row's own name for
    // it is the aggregator's.
    expect(access.sourceName).toBe('www.primenewsghana.com')
    expect(access.via).toBe('Bing News')
  })

  it('keeps an opaque aggregator link and says what it is', () => {
    // A Google News address is a signed blob with the publisher's address inside
    // it in no readable form. Unwrapping it would mean fetching it, and guessing
    // would mean inventing a link; so it is served as stored and labelled.
    const opaque = 'https://news.google.com/read/CBMiAAF95cUxQdGhla2ZMVTNvMGtSVEZaTjVFdjNsc05lWjBjUkZ0Z2xScXJsMlZqZWRt?hl=en-GH&gl=GH&ceid=GH%3Aen'
    const access = sourceAccess(opaque, 'Google News')
    expect(access.url).toBe(opaque)
    expect(access.via).toBe('Google News')
    // "Google News" must not be presented as the publication of a speech.
    expect(access.sourceName).toBeNull()
  })

  it('leaves a direct publisher link alone', () => {
    const access = sourceAccess('https://www.ghanaiantimes.com.gh/story', 'Ghanaian Times')
    expect(access).toEqual({ url: 'https://www.ghanaiantimes.com.gh/story', sourceName: 'Ghanaian Times', via: null })
  })

  it('invents nothing for a record with no address', () => {
    expect(sourceAccess(null, 'Some Channel')).toEqual({ url: null, sourceName: null, via: null })
    expect(sourceAccess('', null).url).toBeNull()
  })

  it('refuses an address that is not one', () => {
    // A stored `url` is whatever a scraper wrote. Handing it to a reader as a
    // link is fine; handing it to the browser as a scheme is not.
    expect(sourceAccess('not a url', 'Odd').url).toBeNull()
    expect(sourceAccess('javascript:alert(1)', 'Odd').url).toBeNull()
  })

  it('does not let a wrapped address point somewhere that is not a web page', () => {
    const wrapped = 'http://www.bing.com/news/apiclick.aspx?url=javascript%3aalert(1)'
    expect(sourceAccess(wrapped, 'Bing News').url).toBe(wrapped)
  })

  it('collapses duplicates against the publisher, so one clipping is not shown twice', () => {
    // The same story fetched through Bing and stored again with the paper's own
    // address is one clipping. Compared against `bing.com` they are two records.
    const viaBing = 'http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fwww.ghanaiantimes.com.gh%2fa-story'
    expect(publisherUrl(viaBing)).toBe('https://www.ghanaiantimes.com.gh/a-story')
    const title = 'Council of State advises Parliament against a rushed bill'
    expect(normaliseTitle(title, 'www.ghanaiantimes.com.gh')).toBe(
      normaliseTitle(`${title} - Ghanaian Times`, 'www.ghanaiantimes.com.gh'),
    )
  })
})
