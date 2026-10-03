import { describe, it, expect } from 'vitest'

import { rankCandidates, type CollectionTotal, type SearchCandidate } from '@/lib/askSearch'
import { formatReport, scoreRetrieval, sourceKey, type CaseScore, type GoldenCase, type Observation } from '@/lib/askEval'
import { ASK_GOLDEN } from './fixtures/askGolden'
import snapshot from './fixtures/askSnapshot.json'

/**
 * The retrieval gate.
 *
 * Everything else in this suite checks that /ask behaves. This checks that it
 * *answers*: that the questions in `fixtures/askGolden.ts` come back with the
 * records they name, ranked sensibly, without the same clipping printed twice
 * and without an answer invented for a subject the archive does not hold.
 *
 * It replays a frozen candidate pool rather than querying, so it runs in CI
 * without a database and without the network. The pool is captured by
 * `npx tsx scripts/ask-eval.ts snapshot`, and the numbers below come from
 * `npx tsx scripts/ask-eval.ts report` against the live archive — which is the
 * number to trust, because a change to the candidate queries narrows the pool
 * and a replay cannot see it.
 *
 * The thresholds are floors at the measured baseline, not targets. They exist to
 * catch a regression nobody noticed; raise them as the corresponding defect is
 * fixed, and the golden cases that encode the fix will stop being failures. The
 * defects this baseline is holding open, all of them visible in the report:
 *
 *   - `duplicateFree` 79.7%. `normaliseTitle` keeps the scraper's provenance
 *     suffix (" - CitiNewsroom.com - 2 days ago - By Nii Ayikwei Okine"), so the
 *     same clipping stored with and without it survives dedupe and is shown
 *     twice. Thirteen of the fifty-nine cases fail this way, and they are the
 *     bulk of what is left.
 *   - `video-fourth-republic`. "fourth" does not reach a headline that writes
 *     the ordinal as "4th", and the answer degrades to an unrelated document.
 *
 * The relevance floor took `emptyAccuracy` from 50% to 100%, so its floor is now
 * 1.00: the archive has no unanswerable question it will offer a card for, and
 * that is a property worth holding rather than a baseline to be lenient about.
 */

const CASES = snapshot.cases as unknown as Array<{
  id: string
  terms: string[]
  context: string[]
  candidates: SearchCandidate[]
  totals: CollectionTotal[]
}>

const observations = new Map<string, Observation>(
  CASES.map(entry => {
    const ranked = rankCandidates(entry.candidates, entry.terms, entry.totals, entry.context)
    return [
      entry.id,
      { id: entry.id, keys: ranked.results.map(result => sourceKey(result.candidate)), mode: ranked.mode },
    ]
  }),
)

const report = scoreRetrieval(ASK_GOLDEN, observations)
const detail = formatReport(report)

/** Every failing case named in the assertion message, so a red run is actionable. */
const failureList = report.failures
  .map(failure => `${failure.id}: ${failure.question}${failure.note ? ` (${failure.note})` : ''}`)
  .join('\n')

describe('/ask retrieval', () => {
  it('has a candidate pool for every golden question', () => {
    const golden = new Set(ASK_GOLDEN.map(testCase => testCase.id))
    const frozen = new Set(CASES.map(entry => entry.id))
    const missing = [...golden].filter(id => !frozen.has(id))
    const unknown = [...frozen].filter(id => !golden.has(id))
    expect(
      { missing, unknown },
      'the snapshot is out of step with the golden set — re-run `npx tsx scripts/ask-eval.ts snapshot`',
    ).toEqual({ missing: [], unknown: [] })
  })

  it('answers most questions with the record they name, in the top five', () => {
    expect(report.recallAt5, `below the 0.90 floor:\n${detail}\nfailures:\n${failureList}`).toBeGreaterThanOrEqual(0.9)
  })

  it('answers almost every question within the ten records it is allowed to show', () => {
    expect(report.recallAt10, `below the 0.95 floor:\n${detail}`).toBeGreaterThanOrEqual(0.95)
  })

  it('puts the right record near the top, not merely somewhere in the list', () => {
    expect(report.mrr, `below the 0.85 floor:\n${detail}`).toBeGreaterThanOrEqual(0.85)
  })

  it('never reports a partial answer for a question one record covers', () => {
    // The database decides this, not the rows that survived the take, so a
    // regression here means the counts and the results have come apart again.
    expect(report.modeAccuracy, `below the 1.00 floor:\n${detail}`).toBe(1)
  })

  it('refuses every question the archive cannot answer', () => {
    // A floor, not a baseline. Anything less than this means a question with no
    // answer in the archive came back with cards on it, which is the failure the
    // relevance floor exists to prevent.
    expect(report.emptyAccuracy, `below the 1.00 floor:\n${detail}`).toBe(1)
  })

  it('shows no record twice in four answers out of five', () => {
    expect(report.duplicateFree, `below the 0.79 floor:\n${detail}`).toBeGreaterThanOrEqual(0.79)
  })
})

describe('scoreRetrieval', () => {
  const caseWith = (over: Partial<GoldenCase>): GoldenCase => ({
    id: 'x',
    question: 'q',
    expect: ['documents|a'],
    ...over,
  })

  const score = (testCase: GoldenCase, keys: string[], mode: Observation['mode'] = 'all'): CaseScore =>
    scoreRetrieval([testCase], new Map([[testCase.id, { id: testCase.id, keys, mode }]])).cases[0]

  it('counts a case as found when any expected record is shown', () => {
    const found = score(caseWith({ expect: ['documents|a', 'documents|b'] }), ['documents|b'])
    expect(found.pass).toBe(true)
    expect(found.bestRank).toBe(1)
  })

  it('fails a case when nothing expected is shown, and says which', () => {
    const missed = score(caseWith({}), ['documents|z'])
    expect(missed.pass).toBe(false)
    expect(missed.missed).toEqual(['documents|a'])
  })

  it('scores a miss as a zero reciprocal rank rather than dropping the case', () => {
    const missed = score(caseWith({}), [])
    expect(missed.reciprocalRank).toBe(0)
    const report = scoreRetrieval(
      [caseWith({}), caseWith({ id: 'y' })],
      new Map<string, Observation>([
        ['x', { id: 'x', keys: [], mode: 'none' }],
        ['y', { id: 'y', keys: ['documents|a'], mode: 'all' }],
      ]),
    )
    expect(report.mrr).toBeCloseTo(0.5)
  })

  it('fails an unanswerable case that returned a record, however plausible', () => {
    const answered = score(caseWith({ expectEmpty: true, expect: undefined }), ['news|something'])
    expect(answered.pass).toBe(false)
    expect(answered.emptyOk).toBe(false)
  })

  it('fails a case that showed the same headline twice under different provenance', () => {
    const twice = score(
      caseWith({}),
      ['news|council of state advises parliament against passage of the bill', 'news|council of state advises parliament against passage of the bill citinewsroom com'],
    )
    expect(twice.duplicateTitles).toHaveLength(1)
    expect(twice.pass).toBe(false)
  })

  it('does not call two short titles the same headline on a shared prefix', () => {
    const distinct = score(caseWith({}), ['milestones|majority leader', 'milestones|minority leader'])
    expect(distinct.duplicateTitles).toEqual([])
  })

  it('fails a case whose declared coverage does not match what was reported', () => {
    const partial = score(caseWith({ mode: 'all' }), ['documents|a'], 'any')
    expect(partial.modeOk).toBe(false)
    expect(partial.pass).toBe(false)
  })

  it('keeps an unanswerable case out of the recall average', () => {
    // Otherwise a case that wrongly returned something would raise recall.
    const report = scoreRetrieval(
      [caseWith({ id: 'a' }), caseWith({ id: 'b', expectEmpty: true, expect: undefined })],
      new Map<string, Observation>([
        ['a', { id: 'a', keys: ['documents|a'], mode: 'all' }],
        ['b', { id: 'b', keys: ['documents|wrong'], mode: 'any' }],
      ]),
    )
    expect(report.answerable).toBe(1)
    expect(report.unanswerable).toBe(1)
    expect(report.recallAt1).toBe(1)
    expect(report.emptyAccuracy).toBe(0)
  })
})
