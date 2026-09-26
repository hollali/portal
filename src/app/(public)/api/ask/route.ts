import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLibraryCounts } from '@/lib/libraryQueries'
import { searchArchive, type ScoredCandidate } from '@/lib/askSearch'
import {
  ASK_SUGGESTIONS,
  queryTerms,
  type AskCitation,
  type AskCollectionCount,
  type AskMatchMode,
  type AskResult,
} from '@/lib/askQuery'

export const dynamic = 'force-dynamic'

/** "How many speeches…", "count of documents" — a corpus question, not a search. */
const COUNT_QUESTION = /\b(how many|how much|number of|count of|total number)\b/i

function snippet(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max).replace(/\s+\S*$/, '') + '…'
}

function noMatchSummary(terms: string[]): string {
  const shown = terms.slice(0, 3).join(', ')
  return `Nothing published in the archive mentions ${shown ? `“${shown}”` : 'that'}. The archive holds specific speeches, papers, clippings and photographs rather than material on every subject, so a narrower or differently worded question is more likely to land.`
}

/**
 * Theme-derived suggestions, shared by GET and POST so the chips a user sees
 * after a search are the same ones the archive can actually answer. The static
 * `ASK_SUGGESTIONS` list is only a fallback — several of its entries point at
 * topics the archive does not hold.
 *
 * When the caller supplies the terms of the question just asked, themes that
 * share a word with them are promoted. Otherwise the chips are the same four
 * biggest themes on every single answer, which teaches the reader that they are
 * a fixed menu rather than a follow-up.
 */
async function suggestFromThemes(terms: string[] = [], asked = ''): Promise<string[]> {
  try {
    const grouped = await prisma.archiveItem.groupBy({
      by: ['theme'],
      where: { status: 'published', NOT: { theme: null } },
      _count: { _all: true },
      orderBy: { _count: { theme: 'desc' } },
      // Wider than the four we return, so a term-aware promotion has
      // something to promote into the top slots.
      take: 12,
    })
    const themes = grouped
      .map(row => (row.theme ?? '').trim())
      .filter(theme => theme.length > 0)
    if (themes.length === 0) return ASK_SUGGESTIONS.slice(0, 3)

    const overlap = (theme: string) => {
      const haystack = theme.toLowerCase()
      return terms.reduce((score, term) => (haystack.includes(term) ? score + 1 : score), 0)
    }

    const ranked = themes
      .map((theme, order) => ({ theme, order, score: overlap(theme) }))
      // Never suggest the question that was just asked back to the reader.
      .filter(({ theme }) => theme.toLowerCase() !== asked.trim().toLowerCase())
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, 4)
      .map(({ theme }) => `What has the archive on “${theme}”?`)

    return ranked.length > 0 ? ranked : ASK_SUGGESTIONS.slice(0, 3)
  } catch {
    return ASK_SUGGESTIONS.slice(0, 3)
  }
}

/**
 * How wide the answer reached — and, because the response is capped at ten
 * records, how much was left out. A reader told "3 photographs" when fourteen
 * matched has been given a sample and should be able to see that it is one.
 *
 * `count` is the number of records that satisfy the same bar the results were
 * chosen under, counted by the database rather than by the rows that survived
 * the candidate take. `broader` is how many mention at least one of the terms,
 * which is the number a reader needs when the answer is assembled from several
 * records: 3 that cover the whole question and 1,340 that each mention a piece
 * of it are not the same claim, and the sentence should not blur them.
 */
function describeBreadth(counts: AskCollectionCount[], shown: number, broaderTotal = 0): string {
  if (counts.length === 0) return ''
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  const records = `${total} record${total === 1 ? '' : 's'}`
  const hidden = total > shown ? `, the ${shown} strongest shown` : ''

  const scope =
    counts.length === 1
      ? ` in ${counts[0].label.toLowerCase()}`
      : ` across ${counts.length} collections (${counts.map(c => `${c.count} ${c.label.toLowerCase()}`).join(', ')})`

  const wider =
    broaderTotal > total
      ? ` ${broaderTotal} records across the archive mention at least one of those words, but ` +
        `${total === 1 ? 'only 1 covers' : `no more than ${total} cover`} the whole question.`
      : ''

  return ` ${records} matched${scope}${hidden}.${wider}`
}

/**
 * The headline answer. A bare "the archive holds N items matching your question"
 * tells the reader nothing, so the summary leads with the best-matching record
 * and quotes it, then says how far the search reached.
 *
 * The lead is the top-ranked record whatever kind it is. Reading it off
 * `citations[0]` instead meant that a question whose best match was a milestone
 * or a testimonial announced the top *document* as the closest match, which is
 * precisely the claim the summary should never get wrong.
 *
 * The loose `any` path is where a keyword search most easily oversells itself:
 * nothing satisfied every term, so the summary says so in its first sentence
 * and names the terms the archive simply does not cover, rather than letting a
 * partial hit read as a complete answer.
 */
function buildSummary(
  mode: AskMatchMode,
  lead: ScoredCandidate | undefined,
  terms: string[],
  unmatched: string[],
  counts: AskCollectionCount[],
  shown: number,
  broaderTotal = 0,
): string {
  if (!lead) return noMatchSummary(terms)

  const { candidate } = lead
  const where = candidate.year ? ` (${candidate.year})` : ''
  const kind = ` — ${candidate.kindLabel.toLowerCase()}`
  const quote = candidate.excerpt && candidate.excerpt !== candidate.title
    ? ` “${snippet(candidate.excerpt, 150)}”`
    : ''
  const breadth = describeBreadth(counts, shown, broaderTotal)
  const leadSentence = `Closest match: “${candidate.title}”${where}${kind}.`

  if (mode === 'all') return `${leadSentence}${quote}${breadth}`

  // Two genuinely different partial answers get two different explanations.
  // `unmatched` is the union across every returned record, so an empty list here
  // means the terms were covered — just never by one item.
  if (unmatched.length > 0) {
    return (
      `No single item covers your whole question, and nothing in the archive mentions ` +
      `${unmatched.map(u => `“${u}”`).join(' or ')}. ${leadSentence}${quote}${breadth}`
    )
  }
  return (
    `Your question spans several records — no single one covers every part of it, ` +
    `so the answer below is assembled from the ${shown} closest match${shown === 1 ? '' : 'es'} between them. ${leadSentence}${quote}`
  )
}

/**
 * Corpus questions answered from the real counts rather than from a document
 * search that can only ever return nothing.
 */
async function answerCountQuestion(raw: string, suggested: string[]): Promise<AskResult> {
  const counts = await getLibraryCounts()
  const haystack = raw.toLowerCase()
  const parts: string[] = []

  const count = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`
  const wants = (needle: string, singular: string, plural: string, n: number) => {
    if (haystack.includes(needle)) parts.push(count(n, singular, plural))
  }

  wants('speech', 'published speech', 'published speeches', counts.speeches)
  wants('paper', 'public paper', 'public papers', counts.papers)
  wants('interview', 'interview', 'interviews', counts.interviews)
  wants('note', 'note or letter', 'notes or letters', counts.notes)
  wants('milestone', 'milestone', 'milestones', counts.milestones)
  wants('testimonial', 'testimonial', 'testimonials', counts.testimonials)
  wants('photo', 'photograph', 'photographs', counts.photos)
  wants('video', 'video', 'videos', counts.videos)
  wants('audio', 'audio recording', 'audio recordings', counts.audio)
  wants('news', 'news clipping', 'news clippings', counts.news)

  const summary = parts.length
    ? `The archive holds ${parts.join(', ')} — ${count(counts.total, 'published record', 'published records')} in total.`
    : `The archive holds ${count(counts.total, 'published record', 'published records')} in total: ${count(counts.speeches, 'speech', 'speeches')}, ${count(counts.papers, 'public paper', 'public papers')}, ${count(counts.interviews, 'interview', 'interviews')}, ${count(counts.notes, 'note or letter', 'notes or letters')}, plus ${count(counts.photos, 'photograph', 'photographs')}, ${count(counts.videos, 'video', 'videos')}, ${count(counts.audio, 'audio recording', 'audio recordings')}, ${count(counts.news, 'news clipping', 'news clippings')}, ${count(counts.milestones, 'milestone', 'milestones')} and ${count(counts.testimonials, 'testimonial', 'testimonials')}.`

  return {
    summary,
    terms: queryTerms(raw.slice(0, 500)),
    match: 'all',
    citations: [],
    timeline: [],
    testimonials: [],
    collectionCounts: [],
    matchedTerms: [],
    unmatched: [],
    totalMatched: 0,
    suggested,
  }
}

export async function GET() {
  return NextResponse.json({ suggested: await suggestFromThemes() })
}

export async function POST(request: NextRequest) {
  let body: { question?: string; messages?: { role?: string; content?: string }[] } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Prefer the explicit `question`; fall back to the last user turn for older clients.
  const raw =
    typeof body.question === 'string'
      ? body.question
      : [...(body.messages || [])].reverse().find(m => m.role === 'user')?.content || ''

  const terms = queryTerms(raw.slice(0, 500))
  const suggestions = await suggestFromThemes(terms, raw)

  const empty = (
    summary: string,
    mode: AskMatchMode = 'none',
    extra: Partial<AskResult> = {},
  ): AskResult => ({
    summary,
    terms,
    match: mode,
    citations: [],
    timeline: [],
    testimonials: [],
    collectionCounts: [],
    // With nothing to show, every term is uncovered. Saying so lets the client
    // show the reader exactly which words the archive could not satisfy.
    matchedTerms: [],
    unmatched: terms,
    totalMatched: 0,
    suggested: suggestions,
    ...extra,
  })

  // "How many speeches are there?" is a question about the corpus, not its
  // contents — searching for "many" can only ever return nothing.
  if (COUNT_QUESTION.test(raw) && terms.length <= 2) {
    return NextResponse.json(await answerCountQuestion(raw, suggestions))
  }

  if (terms.length === 0) {
    return NextResponse.json(
      empty(
        'Ask me about a speech, a letter, a theme or a period of the Speaker’s career — for example “parliamentary independence” or “education and the youth”.',
        'none',
        // No terms survived stopwording, so nothing is uncovered; a reader who
        // typed "who was he?" has not asked about a gap in the archive.
        { unmatched: [] },
      ),
    )
  }

  // Every published collection, ranked together. Milestones and testimonials
  // are split out below because the client already renders them as a
  // chronological timeline and as pull-quotes, which suit them better than a
  // generic result card.
  const { mode, results, collectionCounts, totalMatched, broaderMatched } = await searchArchive(terms)

  if (results.length === 0) {
    return NextResponse.json(empty(noMatchSummary(terms)))
  }

  const citations: AskCitation[] = []
  const timeline: AskResult['timeline'] = []
  const testimonials: AskResult['testimonials'] = []
  // Union across every returned record, not just the lead. The previous code
  // only looked at the lead's matches, so a term satisfied by the fourth result
  // was reported as uncovered.
  const covered = new Set<string>()

  for (const { candidate, matched } of results) {
    for (const term of matched) covered.add(term)

    if (candidate.collection === 'milestones') {
      timeline.push({ year: candidate.year ? String(candidate.year) : null, title: candidate.title })
      continue
    }
    if (candidate.collection === 'testimonials') {
      testimonials.push({
        quote: snippet(candidate.excerpt, 160),
        author: candidate.title,
        role: candidate.role ?? null,
      })
      continue
    }
    citations.push({
      kind: candidate.kind,
      kindLabel: candidate.kindLabel,
      collection: candidate.collection,
      collectionLabel: candidate.collectionLabel,
      title: candidate.title,
      href: candidate.href,
      year: candidate.year,
      excerpt: candidate.excerpt ? snippet(candidate.excerpt, 150) : null,
      hasTranscript: candidate.hasTranscript,
      // Sorted for a stable chip order, and longest-first reads better than
      // query order when one term is a prefix of another.
      matched: [...matched].sort((a, b) => b.length - a.length || a.localeCompare(b)),
    })
  }

  const unmatched = terms.filter(t => !covered.has(t))
  // Milestones and testimonials are rendered as their own sections rather than
  // result cards, but the reader still saw them — so they count towards what
  // the response is able to show, and the summary must not understate it.
  const shown = citations.length + timeline.length + testimonials.length
  const summary = buildSummary(mode, results[0], terms, unmatched, collectionCounts, shown, broaderMatched)

  return NextResponse.json({
    summary,
    terms,
    match: mode,
    citations,
    timeline,
    testimonials,
    collectionCounts,
    matchedTerms: terms.filter(t => covered.has(t)),
    unmatched,
    totalMatched,
    ...(broaderMatched ? { broaderMatched } : {}),
    suggested: suggestions,
  } satisfies AskResult)
}
