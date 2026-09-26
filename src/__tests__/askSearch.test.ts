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
  type SearchCandidate,
} from '@/lib/askSearch'
import { foldSuffix, queryTerms, termVariants } from '@/lib/askQuery'

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
    const identifiers = selected.map(part => {
      const alias = part.match(/AS "([^"]+)"$/)
      return alias ? alias[1] : part
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
    hasTranscript: false,
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
    const ranked = rankCandidates([candidate()], ['corruption'], [
      { collection: 'videos', label: 'Videos', matchTotal: 7, completeTotal: 7 },
    ])
    expect(ranked.broaderMatched).toBeUndefined()
    expect(ranked.collectionCounts[0].broader).toBeUndefined()
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
