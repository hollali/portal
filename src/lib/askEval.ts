/**
 * Retrieval metrics for /ask.
 *
 * The other tests in this suite assert that the pipeline *behaves* — that the
 * SQL covers every collection, that a partial answer says so, that the counts
 * come from the database. None of them assert that a good question returns the
 * right record, which means every quality decision in `askSearch.ts` (the
 * weights, the caps, the phrase bonus, the stopword list) is currently
 * unfalsifiable: it can be made worse and the suite stays green.
 *
 * This module holds the arithmetic, and nothing else. It takes the questions a
 * reader would plausibly type, the records the pipeline actually put in front of
 * them, and says how often the right one was there. The questions live in
 * `src/__tests__/fixtures/askGolden.ts`; the runner is `scripts/ask-eval.ts`,
 * which can also freeze a candidate snapshot so the same measurement runs in CI
 * without a database.
 */

import type { AskMatchMode } from './askQuery'
import { CANDIDATE_TITLE_MAX, normaliseTitle } from './askSearch'

/**
 * One reader question, and what a good answer has to contain.
 *
 * `expect` names sources by `collection | normalised title` rather than by id or
 * slug so a case survives a re-slug, and so the failure message names something
 * the reader can recognise. It is a list because a good answer to "what did he
 * say about X" is usually several records, and because recall is the metric
 * that matters: the pipeline is allowed to show ten records, and a case that
 * demands one exact record would measure an id, not a search.
 */
export interface GoldenCase {
  id: string
  question: string
  /** Source keys at least one of which must reach the reader. */
  expect?: string[]
  /** A question the archive cannot answer. The answer must admit it. */
  expectEmpty?: boolean
  /**
   * How the answer should describe its own coverage. `all` is the assertion
   * that matters: a record naming every term exists, so an answer that reports a
   * partial match has failed even when it returned something.
   */
  mode?: AskMatchMode
  /**
   * What the case is for, in one line. Every case here is a question a real
   * reader would type — a question written to be easy to answer measures
   * nothing.
   */
  note?: string
}

/**
 * The identity a reader can see: which collection, and which record in it.
 *
 * Capped at `CANDIDATE_TITLE_MAX` because that is where `fallbackTitle` cuts
 * every scraped headline. Without the cap here, a golden case naming a full
 * 128-character headline could never match the 120-character card the reader is
 * shown, and the case would report a search failure that is really a fixture bug.
 */
export function sourceKey(source: { collection: string; title: string }): string {
  const title = normaliseTitle(source.title.slice(0, CANDIDATE_TITLE_MAX))
  return `${source.collection}|${title}`
}

/** Build a case's `expect` list from readable titles, so the fixture stays legible. */
export function expectKeys(collection: string, titles: string[]): string[] {
  return titles.map(title => sourceKey({ collection, title }))
}

/**
 * How many leading words identify a headline.
 *
 * The scrapers appended provenance to news titles — " - CitiNewsroom.com - 2
 * days ago - By Nii Ayikwei Okine" — and stored the same clipping with it, with
 * part of it, and without it. `normaliseTitle` keeps those words, so the three
 * rows are three different keys and the pipeline cannot collapse them. Comparing
 * headlines on their first few words is the closest an eval can get to "is this
 * the same clipping" without re-implementing the strip.
 */
const HEADLINE_WORDS = 8

/**
 * The identity of a clipping for duplicate detection.
 *
 * A title shorter than `HEADLINE_WORDS` is compared whole, because its first
 * eight words are the whole title and prefixes of short titles collide on things
 * like "majority leader" and "minority leader".
 */
export function headlineKey(title: string): string {
  const words = title.split(' ')
  return words.length > HEADLINE_WORDS ? words.slice(0, HEADLINE_WORDS).join(' ') : title
}

/** What the pipeline actually showed, in rank order. */
export interface Observation {
  id: string
  keys: string[]
  mode: AskMatchMode
}

/**
 * How well one question was answered.
 *
 * `reciprocalRank` is 0 when nothing expected came back, which folds "not found"
 * into MRR as a zero rather than dropping the case — a metric that silently
 * excludes its failures is a metric that improves when the search gets worse.
 */
export interface CaseScore {
  id: string
  question: string
  note?: string
  /** True for a case the archive is expected not to be able to answer. */
  unanswerable: boolean
  /** Position in the fixture, so a report reads in the order the cases were written. */
  order: number
  /** Expected keys that reached the reader, in rank order. */
  found: Array<{ key: string; rank: number }>
  /** Expected keys the reader never saw. */
  missed: string[]
  reciprocalRank: number
  /** First rank at which any expected key appeared, or 0. */
  bestRank: number
  /**
   * Records whose normalised title appears more than once in the same answer.
   *
   * Not an opt-in. `rankCandidates` claims to collapse these ("showing the same
   * headline twice in a list of ten tells the reader nothing new"), and where it
   * fails to, the reader is shown the same clipping twice and told the answer
   * spans several collections — so a duplicate is always a defect, whatever the
   * question was.
   */
  duplicateTitles: string[]
  modeOk: boolean
  /** The coverage the pipeline reported. */
  mode: AskMatchMode
  /** The coverage the case expected, when it declared one. */
  expectedMode?: AskMatchMode
  /** False when a case expecting nothing was answered anyway. */
  emptyOk: boolean
  pass: boolean
}

export interface EvalReport {
  /** Cases that had something to find. */
  answerable: number
  /** Cases that had nothing to find. */
  unanswerable: number
  /** Share of answerable cases where an expected source reached the top 1 / 5 / 10. */
  recallAt1: number
  recallAt5: number
  recallAt10: number
  /** Mean reciprocal rank over answerable cases. */
  mrr: number
  /** Share of cases declaring a `mode` whose reported mode matched it. */
  modeAccuracy: number
  /** Share of unanswerable cases that returned nothing. */
  emptyAccuracy: number
  /**
   * Share of cases that showed no record twice.
   *
   * Separate from the pass rate because it is the one defect here that is not a
   * retrieval problem at all: the right record is found, ranked correctly, and
   * then printed again because a second copy of it exists in the table.
   */
  duplicateFree: number
  /** Share of all cases that met every assertion they carry. */
  passRate: number
  cases: CaseScore[]
  failures: CaseScore[]
}

const rankOf = (keys: string[], key: string): number => keys.indexOf(key) + 1

/**
 * Score every case and roll the results up.
 *
 * `observations` is keyed by case id; a case with no observation is scored as a
 * failure rather than skipped, so a question that stopped being answerable
 * cannot disappear from the report.
 */
export function scoreRetrieval(
  golden: GoldenCase[],
  observations: Map<string, Observation>,
): EvalReport {
  const casesWithMode = new Set(golden.filter(c => c.mode !== undefined).map(c => c.id))
  const cases: CaseScore[] = golden.map((testCase, index) => {
    const observed = observations.get(testCase.id)
    const keys = observed?.keys ?? []
    const expected = testCase.expect ?? []

    const found = expected
      .map(key => ({ key, rank: rankOf(keys, key) }))
      .filter(hit => hit.rank > 0)
      .sort((a, b) => a.rank - b.rank)

    const bestRank = found.length > 0 ? found[0].rank : 0

    // Compared on the headline half of the key, so the same clipping stored with
    // and without its provenance suffix is caught, and the same row surfaced
    // from two collections is caught too.
    const seenTitles = new Set<string>()
    const duplicateTitles: string[] = []
    for (const key of keys) {
      const title = headlineKey(key.slice(key.indexOf('|') + 1))
      if (seenTitles.has(title)) {
        if (!duplicateTitles.includes(title)) duplicateTitles.push(title)
      }
      seenTitles.add(title)
    }

    // An unanswerable question is only answered correctly by an empty result.
    // A result that returns something the reader can click is a false positive,
    // and it is the failure mode a "nothing found" path never shows in testing.
    const emptyOk = testCase.expectEmpty ? keys.length === 0 : true
    const modeOk = testCase.mode ? observed?.mode === testCase.mode : true
    const uniqueOk = duplicateTitles.length === 0

    const pass = testCase.expectEmpty
      ? emptyOk && uniqueOk
      : found.length > 0 && modeOk && emptyOk && uniqueOk

    return {
      id: testCase.id,
      question: testCase.question,
      note: testCase.note,
      unanswerable: Boolean(testCase.expectEmpty),
      found,
      missed: expected.filter(key => !found.some(hit => hit.key === key)),
      reciprocalRank: bestRank > 0 ? 1 / bestRank : 0,
      bestRank,
      duplicateTitles,
      mode: observed?.mode ?? 'none',
      modeOk,
      expectedMode: testCase.mode,
      emptyOk,
      pass,
      order: index,
    }
  })

  // Classified from the case, not from the outcome: a case that was supposed to
  // be unanswerable and wrongly returned a record is still an unanswerable case
  // that failed, and folding it into the answerable pool would quietly raise
  // recall instead of reporting the false positive.
  const answerable = cases.filter(c => !c.unanswerable)
  const unanswerable = cases.filter(c => c.unanswerable)
  const share = (n: number) => (answerable.length === 0 ? 0 : n / answerable.length)
  const at = (k: number) => share(answerable.filter(c => c.bestRank > 0 && c.bestRank <= k).length)
  const modeCases = cases.filter(c => casesWithMode.has(c.id))
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

  const report: EvalReport = {
    answerable: answerable.length,
    unanswerable: unanswerable.length,
    recallAt1: at(1),
    recallAt5: at(5),
    recallAt10: at(10),
    mrr: answerable.length === 0 ? 0 : sum(answerable.map(c => c.reciprocalRank)) / answerable.length,
    modeAccuracy: modeCases.length === 0 ? 1 : modeCases.filter(c => c.modeOk).length / modeCases.length,
    emptyAccuracy:
      unanswerable.length === 0 ? 1 : unanswerable.filter(c => c.emptyOk).length / unanswerable.length,
    duplicateFree:
      cases.length === 0 ? 0 : cases.filter(c => c.duplicateTitles.length === 0).length / cases.length,
    passRate: cases.length === 0 ? 0 : cases.filter(c => c.pass).length / cases.length,
    cases,
    // Worst first: a missing answer outranks a badly ranked one, and a case that
    // returned something the archive does not hold outranks both.
    failures: cases
      .filter(c => !c.pass)
      .sort(
        (a, b) =>
          Number(a.bestRank > 0) - Number(b.bestRank > 0) ||
          Number(a.emptyOk) - Number(b.emptyOk) ||
          a.order - b.order,
      ),
  }
  return report
}

/** One-line-per-case report, worst first: the failures are the point of running it. */
export function formatReport(report: EvalReport): string {
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`
  const lines = [
    '',
    `  cases          ${report.cases.length} (${report.answerable} answerable, ${report.unanswerable} unanswerable)`,
    `  recall@1       ${pct(report.recallAt1)}`,
    `  recall@5       ${pct(report.recallAt5)}`,
    `  recall@10      ${pct(report.recallAt10)}`,
    `  MRR@10         ${report.mrr.toFixed(3)}`,
    `  mode accuracy  ${pct(report.modeAccuracy)}`,
    `  empty accuracy ${pct(report.emptyAccuracy)}`,
    `  no duplicates  ${pct(report.duplicateFree)}`,
    `  pass rate      ${pct(report.passRate)}`,
    '',
  ]

  if (report.failures.length > 0) {
    lines.push('  failures')
    for (const failure of report.failures) {
      const reason = !failure.emptyOk
        ? 'answered a question the archive cannot answer'
        : failure.duplicateTitles.length > 0
          ? 'showed the same record twice'
          : failure.found.length === 0
            ? 'nothing expected came back'
            : `reported mode "${failure.mode}" where the case expects "${failure.expectedMode}"`
      lines.push(`    ${failure.id.padEnd(28)} ${reason}`)
      lines.push(`      q: ${failure.question}`)
      if (failure.missed.length > 0) lines.push(`      missed: ${failure.missed.join(', ')}`)
      if (failure.duplicateTitles.length > 0) {
        lines.push(`      twice:  ${failure.duplicateTitles.join(', ')}`)
      }
      if (failure.note) lines.push(`      why:  ${failure.note}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
