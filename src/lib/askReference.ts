import type { AskResult } from "@/lib/askQuery";

/**
 * A conversational reference to a record already on screen.
 *
 * "Tell me more about the second one", "why does that matter?" and "open that
 * source" are not searches: the reader is pointing at something this
 * conversation already returned. The server has no transcript of the rendered
 * cards, so resolving these on the client is both simpler and more accurate — it
 * uses the exact card the reader is looking at, and it answers immediately
 * instead of rerunning a search for the word "second".
 *
 * The returned result is a normal `AskResult` containing only the referenced
 * citation, so the existing answer renderer and saved-history format keep working.
 */
export function resolveCardReference(question: string, previous: AskResult): AskResult | null {
  const citations = previous.citations;
  if (citations.length === 0) return null;

  const flat = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const ordinals: Record<string, number> = {
    first: 0, "1st": 0,
    second: 1, "2nd": 1,
    third: 2, "3rd": 2,
    fourth: 3, "4th": 3,
    fifth: 4, "5th": 4,
    last: citations.length - 1,
  };

  const explicit =
    flat.match(/\b(?:the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|last)\s+(?:one|source|record|item|result|card|link|speech|clip|event)\b/) ??
    flat.match(/^(?:tell me (?:more )?about|what about|and)\s+(?:the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|last)\b/);
  const demonstrative = /\b(?:that|this)\s+(?:one|source|record|item|result|card|link)\b/.test(flat);
  const why = /\b(?:why|what)\s+does\s+(?:that|this|it)\s+matter\b|\bwhy\s+is\s+(?:that|this|it)\s+important\b/.test(flat);

  if (!explicit && !demonstrative && !why) return null;

  const index = explicit ? (ordinals[explicit[1]] ?? 0) : 0;
  const citation = citations[Math.min(Math.max(index, 0), citations.length - 1)];
  if (!citation) return null;

  const where = citation.year ? ` (${citation.year})` : "";
  const label = citation.kindLabel.toLowerCase();
  const note = citation.note?.trim();
  const ordinalWord = explicit?.[1] ?? (index === 0 ? "first" : "that");

  const summary = why
    ? note
      ? `The archive’s note on why this record matters: ${note}`
      : `The record itself is the best answer to that. “${citation.title}”${where} is a ${label}; open the card below to read it in context.`
    : `The ${ordinalWord === "that" ? "record I pointed to" : `${ordinalWord} record`} is “${citation.title}”${where}, a ${label}.${
        note ? ` Why it matters: ${note}` : ""
      } I’ve kept the source below so you can open it directly.`;

  return {
    ...previous,
    summary,
    terms: citation.matched.length > 0 ? citation.matched : previous.terms,
    match: "all",
    citations: [citation],
    timeline: [],
    testimonials: [],
    collectionCounts: [
      {
        collection: citation.collection,
        label: citation.collectionLabel,
        count: 1,
      },
    ],
    matchedTerms: citation.matched,
    unmatched: [],
    totalMatched: 1,
    broaderMatched: undefined,
    reading: undefined,
    suggested: previous.suggested.slice(0, 3),
    conversation: {
      kind: "followup",
      lead: "",
      quotes: [],
      firstPerson: false,
      anchor: previous.terms,
    },
  };
}


/** The page shape returned by /api/ask/link. */
export interface LinkSource {
  title: string
  url: string
  siteName: string | null
  description: string | null
  excerpt: string
  matched: string[]
  retrievedAt: string
}

/**
 * A chat message with no archive cards, for conversation that is not an answer.
 * Used for greetings and for a link the assistant could not read.
 */
export function chatMessageResult(summary: string, suggested: string[] = []): AskResult {
  return {
    summary,
    terms: [],
    match: "all",
    citations: [],
    timeline: [],
    testimonials: [],
    collectionCounts: [],
    matchedTerms: [],
    unmatched: [],
    totalMatched: 0,
    suggested,
    conversation: { kind: "chat", lead: "", quotes: [], firstPerson: false, anchor: [] },
  };
}

/**
 * Turn a fetched page into an answer card.
 *
 * The page is outside the archive and unverified, so it is labelled as such and
 * the summary says plainly that the file was read for the reader's words rather
 * than treated as evidence.
 */
export function buildLinkAnswer(source: LinkSource, question: string): AskResult {
  const passage = source.excerpt?.trim();
  const summary = passage
    ? `I read “${source.title}”${source.siteName ? ` from ${source.siteName}` : ""}. The passage closest to your question reads: “${passage}”`
    : `I read “${source.title}”${source.siteName ? ` from ${source.siteName}` : ""}, but the page had no readable text for me to quote.`;
  const terms = source.matched.length > 0 ? source.matched : question.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return {
    summary,
    terms,
    match: "all",
    citations: [
      {
        kind: "web",
        kindLabel: "Web page",
        collection: "web",
        collectionLabel: "Outside the archive",
        title: source.title,
        href: source.url,
        year: null,
        excerpt: passage || source.description || null,
        hasTranscript: false,
        matched: source.matched,
        sourceName: source.siteName,
      },
    ],
    timeline: [],
    testimonials: [],
    collectionCounts: [],
    matchedTerms: source.matched,
    unmatched: [],
    totalMatched: 1,
    limitations: [
      "This page is outside the archive. I read it because you linked it, but I have not verified it against the archive’s published records.",
    ],
    suggested: [
      "What does the archive say about this?",
      "What else is in the archive?",
      "What is on the timeline?",
    ],
    conversation: { kind: "chat", lead: "", quotes: [], firstPerson: false, anchor: [] },
  };
}
