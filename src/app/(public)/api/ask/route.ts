import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLibraryCounts } from '@/lib/libraryQueries'
import { bestPassage, searchArchive, type ScoredCandidate } from '@/lib/askSearch'
import {
  buildVoice,
  resolveQuestion,
  suggestionsFromResult,
  type PersonaVoice,
} from '@/lib/askConversation'
import {
  ASK_COLLECTION_LABELS,
  ASK_SUGGESTIONS,
  COLLECTION_PAGES,
  collectionFilter,
  describeCollections,
  describeUnsearchable,
  describeWindow,
  NOT_ANSWERABLE_COLLECTIONS as NOT_ANSWERABLE,
  parsePeriod,
  queryTerms,
  type AskCitation,
  type AskCollectionCount,
  type AskCollectionName,
  type AskMatchMode,
  type AskPeriod,
  type AskResult,
} from '@/lib/askQuery'

export const dynamic = 'force-dynamic'

/** "How many speeches…", "count of documents" — a corpus question, not a search. */
const COUNT_QUESTION = /\b(how many|how much|number of|count of|total number)\b/i

/** Turns of history used to resolve a follow-up. */
const MAX_HISTORY_TURNS = 6

/**
 * What to say when nothing is shown.
 *
 * Two different facts hide behind an empty result, and only one of them is
 * "the archive holds nothing on this". Records can match a word of the question
 * and still be dropped for not answering it — a relevance floor, a record that
 * mentions "policy" in passing — and telling a reader who asked about a subject
 * the archive plainly covers that nothing was ever published on it is the kind
 * of sentence that makes an archive untrustworthy. `broaderTotal` is the count
 * of records that mention at least one of the question's words, so the wording
 * can admit what was found and refuse only the part that is not there.
 */
function noMatchSummary(
  terms: string[],
  broaderTotal = 0,
  period: AskPeriod | null = null,
  collections: string[] = [],
): string {
  const shown = terms.slice(0, 3).join(', ')
  const subject = shown ? `“${shown}”` : 'that'
  // "There is nothing in the photographs about poverty" and "there is nothing about
  // poverty anywhere in the archive" are different sentences, and only the first is
  // true — so the restriction is named even in a refusal.
  const scope = collections.length > 0 ? ` ${describeCollections(collections)}` : ''

  // A question that was only a window — "what happened in 1994?" — has no subject
  // left to name, because the years were the whole question. Saying the archive
  // "mentions that" tells the reader nothing, and worse, it reads as though
  // something had been searched for and not found.
  if (terms.length === 0 && period) {
    return (
      `${scope ? scope.slice(1) : ''}${describeWindow(period, [], 'empty')} The archive holds records ` +
      `from a finite set of years, and this is not one of them — naming a year it does cover is more likely to land.`
    )
  }

  // A collection named on its own that holds nothing searchable — "any videos?" over
  // an archive with none — is a fact about the collection, so it says so rather than
  // passing for a search that found nothing.
  if (terms.length === 0) {
    return (
      `${describeCollections(collections)}That collection holds no published records to show, ` +
      `which is worth saying plainly rather than passing for a search that found nothing.`
    )
  }

  // Inside a window, "nothing" is a statement about the window and has to say so.
  // The archive may hold records about the subject in other years, and an answer
  // that did not mention that would read as a claim about the whole archive.
  const window = period ? ` ${describeWindow(period, [], 'filtered')}` : ''

  if (broaderTotal > 0) {
    return (
      `The archive mentions ${subject} in ${broaderTotal} record${broaderTotal === 1 ? '' : 's'}, ` +
      `but none of ${broaderTotal === 1 ? 'it' : 'them'} answers the question as asked.${window}${scope} ` +
      `Naming the subject more precisely, or asking for one part of it, is more likely to land.`
    )
  }

  return (
    `Nothing published in the archive mentions ${subject}.${window}${scope} ` +
    `The archive holds specific speeches, papers, clippings and photographs rather than material on every subject, so a narrower or differently worded question is more likely to land.`
  )
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
function describeBreadth(
  counts: AskCollectionCount[],
  shown: number,
  broaderTotal = 0,
  order: 'relevance' | 'chronology' | 'collection' = 'relevance',
): string {
  if (counts.length === 0) return ''
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  const records = `${total} record${total === 1 ? '' : 's'}`
  // "The 2 strongest shown" is a claim about a ranking. A question that named only a
  // window or only a collection has nothing to rank by — the records are in the
  // order the collection or the years put them — so the sentence says which ones are
  // on screen instead of inventing a judgement.
  const hidden =
    total > shown
      ? `, ${
          order === 'chronology'
            ? `the earliest ${shown} shown`
            : order === 'collection'
              ? `the first ${shown} in the collection shown`
              : `the ${shown} strongest shown`
        }`
      : ''

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
 * The headline answer.
 *
 * The opening is no longer composed here — it comes from `buildVoice`, which is
 * the only place allowed to decide whether this reply speaks in the first person.
 * This function is responsible for the two things that have to stay attached to
 * it: how far the search actually reached, and the terms it could not satisfy.
 *
 * A partial answer that does not say it is partial is worse than no answer,
 * because the reader has no way to tell the difference. So the disclosure leads
 * for an incomplete answer, before any quotation — quoting a record confidently
 * and only then admitting a third of the question went uncovered is the exact
 * shape of an answer nobody should trust.
 */
function buildSummary(
  mode: AskMatchMode,
  voice: PersonaVoice,
  lead: ScoredCandidate | undefined,
  terms: string[],
  unmatched: string[],
  counts: AskCollectionCount[],
  shown: number,
  {
    broaderTotal = 0,
    windowed = false,
  }: { broaderTotal?: number; windowed?: boolean } = {},
): string {
  if (!lead) return noMatchSummary(terms, broaderTotal)

  const breadth = describeBreadth(
    counts,
    shown,
    broaderTotal,
    // With no words to rank by, the order the cards are in is the only order there
    // was, and the sentence must name the one that applied.
    terms.length === 0 ? (windowed ? 'chronology' : 'collection') : 'relevance',
  )

  if (mode === 'any' && unmatched.length > 0) {
    return (
      `No single item covers your whole question, and nothing in the archive mentions ` +
      `${unmatched.map(u => `“${u}”`).join(' or ')}. ${voice.lead}${breadth}`
    )
  }

  if (mode === 'any') {
    return (
      `Your question spans several records — no single one covers every part of it, ` +
      `so the answer below is assembled from the ${shown} closest match${shown === 1 ? '' : 'es'} between them. ` +
      `${voice.lead}${breadth}`
    )
  }

  return `${voice.lead}${breadth}`
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

  // The turns before this one, so "more on that?" and "and the debt?" can be
  // resolved against what is already under discussion. Capped, and user turns
  // only: an assistant turn is a summary we wrote, not something the reader asked.
  const history = (body.messages || [])
    .filter(m => m.role === 'user' && typeof m.content === 'string' && m.content.trim())
    .map(m => m.content as string)
    .slice(-MAX_HISTORY_TURNS)
    // The turn being answered is still in the array on a client that sends the
    // whole transcript; using it as its own history would make every question a
    // follow-up to itself.
    .filter(text => text.trim() !== raw.trim())

  const resolved = resolveQuestion(raw, history)
  const terms = resolved.terms
  const suggestions = await suggestFromThemes(terms, raw)

  // Read off the question before the "no subject" check below, because a question
  // can consist of nothing but a window. "What happened in 2026?" has no keywords
  // left after stopwording — every one of them was a year the period has claimed —
  // and it is not a question without a subject. It is the most direct one there is.
  const period = parsePeriod(raw)

  // A collection named in the question is a filter, not a subject. "What are the
  // milestones from the 1990s?" points at one page of this site, so it decides which
  // collections are searched and comes out of the words being searched for — leaving
  // it in would require every record returned to contain the word "milestones", which
  // is why that question used to come back empty.
  const named = collectionFilter(terms)
  const searchTerms = named.terms

  // Not every collection can answer anything: the photograph library is browsable
  // and searchable but every row of it is uncaptioned and undated. A reader who
  // names it is told so and given the page to browse, because answering with
  // records from other collections under a "Restricted to Photographs" heading
  // would be a lie about where the pictures came from.
  const unsearchable = named.collections.filter(c => c in NOT_ANSWERABLE)
  const collections = named.collections.filter(c => !(c in NOT_ANSWERABLE))
  const leftOut = describeUnsearchable(unsearchable)

  const empty = (
    summary: string,
    mode: AskMatchMode = 'none',
    extra: Partial<AskResult> = {},
  ): AskResult => ({
    summary,
    terms: searchTerms,
    match: mode,
    citations: [],
    timeline: [],
    testimonials: [],
    collectionCounts: [],
    // With nothing to show, every term is uncovered. Saying so lets the client
    // show the reader exactly which words the archive could not satisfy.
    matchedTerms: [],
    unmatched: searchTerms,
    totalMatched: 0,
    suggested: suggestions,
    ...extra,
  })

  // "How many speeches are there?" is a question about the corpus, not its
  // contents — searching for "many" can only ever return nothing.
  if (COUNT_QUESTION.test(raw) && searchTerms.length <= 2) {
    return NextResponse.json(await answerCountQuestion(raw, suggestions))
  }

  if (searchTerms.length === 0 && !period && collections.length === 0) {
    // A question made of nothing but the name of a collection the archive cannot
    // search is answerable, and the answer is that collection and where to find it.
    const asked = unsearchable
      .map(c => ASK_COLLECTION_LABELS[c as AskCollectionName])
      .join(' or ')
      .toLowerCase()
    const unsearchableOnly =
      unsearchable.length > 0
        ? `I cannot answer from the ${asked}: ${NOT_ANSWERABLE[unsearchable[0]]}. It is browsable at ${COLLECTION_PAGES[unsearchable[0]]}, and /search covers every collection at once.`
        : resolved.kind === 'followup'
          ? 'I could not carry that forward — the earlier turns in this conversation did not give me a subject to keep going on. Try naming the speech, theme or period again.'
          : 'Ask me about a speech, a letter, a theme or a period of the Speaker’s career — for example “parliamentary independence” or “education and the youth”.'
    return NextResponse.json(
      empty(unsearchableOnly, 'none',
        // No terms survived stopwording, so nothing is uncovered; a reader who
        // typed "who was he?" has not asked about a gap in the archive.
        {
          unmatched: [],
          ...(unsearchable.length ? { unsearchable } : {}),
          conversation: {
            kind: resolved.kind,
            lead: '',
            quotes: [],
            firstPerson: false,
            anchor: resolved.anchor,
          },
        },
      ),
    )
  }

  // Every published collection, ranked together. Milestones and testimonials
  // are split out below because the client already renders them as a
  // chronological timeline and as pull-quotes, which suit them better than a
  // generic result card.
  const { mode, results, collectionCounts, totalMatched, broaderMatched, undated } =
    await searchArchive(searchTerms, resolved.context, period, collections)

  if (results.length === 0) {
    // `broaderMatched` counts every record that mentions any of the question's
    // words, which is the claim the sentence now makes — the count of records
    // matching all of them would understate what the archive holds and is zero
    // for exactly the questions this wording exists for.
    return NextResponse.json(
      empty(
        `${noMatchSummary(searchTerms, Math.max(broaderMatched ?? 0, totalMatched), period, collections)}${leftOut ? ` ${leftOut}` : ''}`,
        mode,
        {
          ...(period ? { period } : {}),
          ...(undated?.length ? { undated } : {}),
          ...(collections.length ? { collections } : {}),
          ...(unsearchable.length ? { unsearchable } : {}),
        },
      ),
    )
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
      timeline.push({
        year: candidate.year ? String(candidate.year) : null,
        title: candidate.title,
        // The reader has been shown the milestone; without this they cannot go
        // and read what it actually says.
        href: candidate.href,
      })
      continue
    }
    if (candidate.collection === 'testimonials') {
      testimonials.push({
        quote: bestPassage(candidate, [...matched], 160),
        author: candidate.title,
        role: candidate.role ?? null,
        href: candidate.href,
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
      // The window around the match, not the opening of the record. A hundred and
      // fifty characters from the top of a long speech is almost never the part
      // the reader asked about, and a card showing the wrong paragraph is worse
      // than no card at all: the reader concludes the archive does not cover the
      // subject, when the subject was in the document the whole time.
      excerpt: bestPassage(candidate, [...matched], 150) || null,
      hasTranscript: candidate.hasTranscript,
      // Sorted for a stable chip order, and longest-first reads better than
      // query order when one term is a prefix of another.
      matched: [...matched].sort((a, b) => b.length - a.length || a.localeCompare(b)),
      // Where the record came from, beside the archive page it now lives on. A
      // reader who cannot reach the paper has no way to tell that from the
      // archive not holding the record.
      ...(candidate.url ? { url: candidate.url } : {}),
      ...(candidate.sourceName ? { sourceName: candidate.sourceName } : {}),
      ...(candidate.via ? { via: candidate.via } : {}),
      ...(candidate.hasCapture && candidate.id !== undefined
        ? { captureHref: `/api/news/${candidate.id}/original` }
        : {}),
    })
  }

  const unmatched = searchTerms.filter(t => !covered.has(t))
  // Milestones and testimonials are rendered as their own sections rather than
  // result cards, but the reader still saw them — so they count towards what
  // the response is able to show, and the summary must not understate it.
  const shown = citations.length + timeline.length + testimonials.length
  const matchedTerms = searchTerms.filter(t => covered.has(t))

  const voice = buildVoice(resolved.kind, resolved.anchor, results)
  // The window is a statement about the search, not a thing the Speaker said, so
  // it is appended outside the persona sentence. Bolting it onto the voice would
  // put an archive-side fact into the mouth of a man whose every other word here
  // is read verbatim from a stored record.
  // The restriction is a statement about the search, not a thing the Speaker said,
  // so it is appended outside the persona sentence alongside the window.
  const summary =
    buildSummary(mode, voice, results[0], searchTerms, unmatched, collectionCounts, shown, {
      broaderTotal: broaderMatched,
      windowed: period !== null,
    }) +
    (collections.length ? ` ${describeCollections(collections)}` : '') +
    (period ? ` ${describeWindow(period, undated ?? [])}` : '') +
    (leftOut ? ` ${leftOut}` : '')

  // Suggestions from the records that were actually returned, because the global
  // theme list was the same four chips on every answer and read as a fixed menu
  // rather than a next step. The theme list stays as the fallback for turns that
  // never reached a search.
  const resultSuggestions = suggestionsFromResult(results, matchedTerms, raw)

  return NextResponse.json({
    summary,
    terms: searchTerms,
    match: mode,
    citations,
    timeline,
    testimonials,
    collectionCounts,
    matchedTerms,
    unmatched,
    totalMatched,
    ...(broaderMatched ? { broaderMatched } : {}),
    ...(period ? { period } : {}),
    ...(undated?.length ? { undated } : {}),
    ...(collections.length ? { collections } : {}),
    ...(unsearchable.length ? { unsearchable } : {}),
    suggested: resultSuggestions.length > 0 ? resultSuggestions : suggestions,
    conversation: {
      kind: resolved.kind,
      lead: voice.lead,
      quotes: voice.quotes,
      firstPerson: voice.firstPerson,
      anchor: resolved.anchor,
    },
  } satisfies AskResult)
}
