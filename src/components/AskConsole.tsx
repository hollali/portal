"use client";

/* These effects hydrate browser-owned transcript state and persist it externally. */
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * The interactive half of /ask, as a client island under a server-rendered page.
 *
 * The composer, the transcript and the follow-up chips are all driven by state
 * and by fetches to /api/ask; the hero above is static and lives in the page,
 * which is also what lets that page own the route metadata — a `"use client"`
 * page cannot export `metadata`, which is how /ask used to ship the site-wide
 * title with no page-specific one.
 *
 * Two things about the shape of the answer are deliberate. The transcript flows
 * in the page rather than inside a scroller of its own: a second scroll area
 * nested in a scrolling page is a trap on a laptop and hides the citations the
 * answer exists to show. And the question asked is mirrored into `?q=`, so an
 * answer can be linked, bookmarked and reloaded instead of living only in
 * localStorage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Landmark,
  Layers,
  Link2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { KIND_ICON } from "@/lib/kindIcon";
import {
  ASK_SUGGESTIONS,
  describeCollections,
  describeUnsearchable,
  describeWindow,
  type AskResult,
} from "@/lib/askQuery";
import { highlightTerms } from "@/lib/askHighlight";
import ChatHistorySidebar, {
  createNewChat,
  loadAllChats,
  saveAllChats,
  type PersistedChat,
} from "./ChatHistorySidebar";


interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  result?: AskResult;
  failed?: boolean;
  /** The reader pressed stop, as opposed to the request failing. */
  stopped?: boolean;
}

/** Smallest comfortable target. Chips here were 36px, under the 44px guideline. */
const HIT = 44;

/** The composer stops growing here and scrolls; past this it is a reading pane. */
const COMPOSER_MAX_H = 148;

/**
 * The composer and the API have to agree on how long a question is.
 *
 * /api/ask slices its input at 500 characters (see `queryTerms(raw.slice(0, 500))`),
 * so the field is capped at the same number. Without a cap the field accepted
 * any length and quietly discarded the overflow at the far end, which reads as
 * the archive having ignored the end of the sentence.
 */
const MAX_QUESTION = 500;

/**
 * Mirror the question into the address bar without navigating.
 *
 * `replaceState` rather than `pushState` on purpose: each question overwrites
 * the last, so Back still leaves /ask instead of walking the reader back through
 * a dozen half-answered turns, and no history entry is created for a query the
 * page cannot restore on its own.
 */
function writeQueryParam(question: string | null) {
  const url = new URL(window.location.href);
  if (question) url.searchParams.set("q", question);
  else url.searchParams.delete("q");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Where a dead end should point. "Who was he?" reduces to no searchable terms
 * and used to be answered with a paragraph asking for a better question; these
 * are the pages that actually answer it.
 */
const FALLBACK_LINKS = [
  { href: "/the-man", label: "Who he is" },
  { href: "/timeline", label: "Life timeline" },
  { href: "/themes", label: "Themes & ideas" },
  { href: "/archives/speeches", label: "The speeches" },
  { href: "/parliament", label: "Parliamentary legacy" },
] as const;

/**
 * Coerce an unknown value into a renderable `AskResult`.
 *
 * Persisted history outlives the shape of the response. A conversation saved
 * before the current fields existed comes back from localStorage with no
 * `collectionCounts`, no `matchedTerms`, no `matched` on its citations — and
 * the renderer, which reads those unconditionally, throws on the first field it
 * cannot find. Reading them defensively here means an old transcript degrades
 * to a plainer answer instead of taking the whole page down.
 */
function normaliseResult(value: unknown): AskResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const strArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const bool = (v: unknown) => v === true;

  return {
    summary: str(raw.summary),
    terms: strArray(raw.terms),
    match: raw.match === "all" || raw.match === "any" ? raw.match : "none",
    citations: Array.isArray(raw.citations)
      ? raw.citations
          .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
          .map(c => ({
            kind: str(c.kind),
            kindLabel: str(c.kindLabel) || "Record",
            collection: str(c.collection),
            collectionLabel: str(c.collectionLabel),
            title: str(c.title),
            href: str(c.href),
            year: num(c.year),
            excerpt: typeof c.excerpt === "string" ? c.excerpt : null,
            hasTranscript: bool(c.hasTranscript),
            matched: strArray(c.matched),
            // An absolute http(s) URL only. A stored `url` is whatever a scraper
            // put in the row, and a `javascript:` or `data:` one would execute in
            // this page the moment a reader clicked it.
            ...(typeof c.url === "string" && /^https?:\/\//i.test(c.url) ? { url: c.url } : {}),
            ...(typeof c.sourceName === "string" && c.sourceName ? { sourceName: c.sourceName } : {}),
            ...(typeof c.via === "string" && c.via ? { via: c.via } : {}),
            ...(typeof c.captureHref === "string" && c.captureHref.startsWith("/")
              ? { captureHref: c.captureHref }
              : {}),
          }))
          .filter(c => c.href !== "")
      : [],
    timeline: Array.isArray(raw.timeline)
      ? raw.timeline
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .map(t => ({
            year: typeof t.year === "string" ? t.year : null,
            title: str(t.title),
            ...(typeof t.href === "string" && t.href.startsWith("/") ? { href: t.href } : {}),
          }))
      : [],
    testimonials: Array.isArray(raw.testimonials)
      ? raw.testimonials
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .map(t => ({
            quote: str(t.quote),
            author: str(t.author),
            role: typeof t.role === "string" ? t.role : null,
            ...(typeof t.href === "string" && t.href.startsWith("/") ? { href: t.href } : {}),
          }))
      : [],
    collectionCounts: Array.isArray(raw.collectionCounts)
      ? raw.collectionCounts
          .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
          .map(c => {
            const count = num(c.count) ?? 0;
            const broader = num(c.broader);
            return {
              collection: str(c.collection),
              label: str(c.label),
              count,
              // Only carried when it is the larger, more informative number.
              ...(broader && broader > count ? { broader } : {}),
            };
          })
      : [],
    matchedTerms: strArray(raw.matchedTerms),
    unmatched: strArray(raw.unmatched),
    totalMatched: num(raw.totalMatched) ?? 0,
    ...(num(raw.broaderMatched) ? { broaderMatched: num(raw.broaderMatched)! } : {}),
    suggested: strArray(raw.suggested),
    ...(raw.conversation && typeof raw.conversation === 'object'
      ? { conversation: normaliseConversation(raw.conversation) }
      : {}),
    ...(normalisePeriod(raw.period) ? { period: normalisePeriod(raw.period)! } : {}),
    ...(strArray(raw.undated).length > 0 ? { undated: strArray(raw.undated) } : {}),
    ...(strArray(raw.collections).length > 0 ? { collections: strArray(raw.collections) } : {}),
    ...(strArray(raw.unsearchable).length > 0
      ? { unsearchable: strArray(raw.unsearchable) }
      : {}),
    ...(normaliseReading(raw.reading) ? { reading: normaliseReading(raw.reading)! } : {}),
  };
}

/**
 * Coerce the window of years an answer was restricted to.
 *
 * Both bounds are independently optional, because "since 2020" has no end and "up
 * to 1998" has no start, and one bound can be present while the other is `null`
 * rather than absent. A transcript saved before this field existed has none at
 * all, which is not the same as a window with no bounds.
 */
function normalisePeriod(value: unknown): AskResult["period"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const year = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  const from = year(raw.from);
  const to = year(raw.to);
  if (from === null && to === null) return undefined;
  return {
    from,
    to,
    label: typeof raw.label === "string" && raw.label ? raw.label : "",
  };
}

/**
 * Coerce a generated reading, and refuse one that cannot prove what it is.
 *
 * `generated: true` is the whole point of the field. A payload that arrives
 * without it is not a reading this client knows how to label, and rendering it as
 * though it came from the archive would put an unattributable interpretation
 * into a page whose every other word is a stored quotation — so it is dropped
 * rather than guessed at.
 */
function normaliseReading(value: unknown): AskResult["reading"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.generated !== true) return undefined;
  const text = typeof raw.text === "string" ? raw.text : "";
  if (!text.trim()) return undefined;
  return {
    text,
    generated: true,
    basedOn: Array.isArray(raw.basedOn)
      ? raw.basedOn.filter((x): x is string => typeof x === "string")
      : [],
  };
}

/**
 * Coerce the conversation block.
 *
 * Same reason as the rest of `normaliseResult`: a transcript saved before the
 * persona existed comes back with no `conversation` at all, and one saved by a
 * build where it was a different shape comes back with half of it. The renderer
 * reads `quotes` unconditionally, so anything missing has to become an empty
 * quote list rather than an exception.
 */
function normaliseConversation(value: unknown): NonNullable<AskResult["conversation"]> {
  const raw = (value ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    kind: raw.kind === "followup" || raw.kind === "unresolved" ? raw.kind : "new",
    lead: str(raw.lead),
    firstPerson: raw.firstPerson === true,
    anchor: Array.isArray(raw.anchor)
      ? raw.anchor.filter((a): a is string => typeof a === "string")
      : [],
    quotes: Array.isArray(raw.quotes)
      ? raw.quotes
          .filter((q): q is Record<string, unknown> => !!q && typeof q === "object")
          .map(q => ({
            text: str(q.text),
            title: str(q.title),
            href: str(q.href),
            year: typeof q.year === "number" && Number.isFinite(q.year) ? q.year : null,
            kindLabel: str(q.kindLabel),
            collectionLabel: str(q.collectionLabel),
          }))
          // A quote with no text or nowhere to verify it is not a quotation.
          .filter(q => q.text.length > 0 && q.href.length > 0)
      : [],
  };
}

function restoreMessages(chat: PersistedChat): ChatMsg[] {
  return chat.messages.flatMap(message => {
    const result = message.role === "assistant" ? normaliseResult(message.result) : undefined;
    if (message.role === "assistant" && !result && !message.failed && !message.stopped) return [];
    return [{
      role: message.role,
      content: message.content,
      ...(result ? { result } : {}),
      ...(message.failed ? { failed: true } : {}),
      ...(message.stopped ? { stopped: true } : {}),
    }];
  });
}

const AVATAR: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  flexShrink: 0,
  background: "color-mix(in srgb, var(--primary) 14%, transparent)",
  border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--primary)",
};

/**
 * Renders text with the reader's own terms marked up. The archive matches by
 * keyword, so showing exactly which words landed is the difference between a
 * citation the reader trusts and one they have to take on faith.
 */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const segments = highlightTerms(text, terms);
  return (
    <>
      {segments.map((segment, i) =>
        segment.match ? (
          <mark
            key={i}
            style={{
              background: "color-mix(in srgb, var(--primary) 22%, transparent)",
              color: "inherit",
              borderRadius: 3,
              padding: "0 0.12em",
              fontWeight: 600,
            }}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </>
  );
}

/** Highlights the word currently reached by speechSynthesis's character index. */
const CHIP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  fontSize: "0.72rem",
  fontFamily: "var(--font-mono), monospace",
  borderRadius: 999,
  padding: "0.2rem 0.55rem",
  // Longhand, so callers can override borderColor without mixing shorthand.
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--p-border-2)",
  color: "var(--p-text-3)",
  background: "var(--p-surface-2)",
  whiteSpace: "nowrap",
};

/** The terms that were actually searched for — the answer's real subject. */
function TermsReadout({ result }: { result: AskResult }) {
  if (result.terms.length === 0) return null;
  return (
    <p
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "0.3rem",
        margin: "0 0 0.75rem",
        fontSize: "0.72rem",
        color: "var(--p-text-4)",
        fontFamily: "var(--font-mono), monospace",
      }}
    >
      <Search size={11} aria-hidden />
      <span>searched for</span>
      {result.terms.map(term => {
        const found = result.matchedTerms.includes(term);
        return (
          <span
            key={term}
            style={{
              ...CHIP,
              color: found ? "var(--primary)" : "var(--p-text-4)",
              borderColor: found
                ? "color-mix(in srgb, var(--primary) 40%, transparent)"
                : "var(--p-border-2)",
              textDecoration: found ? undefined : "line-through",
              opacity: found ? 1 : 0.75,
            }}
          >
            {term}
          </span>
        );
      })}
    </p>
  );
}

/**
 * What the answer could not do. A partial answer that does not say it is partial
 * is worse than no answer, because the reader has no way to tell the difference.
 */
/**
 * The window a dated answer was filtered to, above the cards it chose.
 *
 * Every record below this line was picked under this filter, and a reader who
 * cannot see the filter will read a 2026 clipping as evidence about 2021. The
 * sentence comes from `describeWindow` rather than being written here, so the
 * summary and this banner cannot disagree about which records were shown.
 */
/**
 * The filters the search actually ran under, above the records.
 *
 * A collection named in the question and a window of years are both restrictions the
 * reader chose and cannot see in the cards. Naming them here is also what keeps a
 * refusal honest: a restriction the reader typed is not the archive missing something.
 */
function WindowNotice({ result }: { result: AskResult }) {
  const collections = result.collections ?? [];
  const unsearchable = result.unsearchable ?? [];
  if (!result.period && collections.length === 0 && unsearchable.length === 0) return null;
  const window =
    result.period &&
    (result.period.label ||
      describeWindow(result.period, result.undated ?? [], "shown").replace(/\.$/, ""));
  const scope = collections.length > 0 ? describeCollections(collections) : null;
  return (
    <p
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.45rem",
        margin: "0 0 0.85rem",
        padding: "0.55rem 0.7rem",
        borderRadius: 10,
        border: "1px solid color-mix(in srgb, var(--primary) 26%, transparent)",
        background: "color-mix(in srgb, var(--primary) 7%, transparent)",
        fontSize: "0.8rem",
        lineHeight: 1.5,
        color: "var(--p-text-2)",
      }}
    >
      <CalendarRange size={15} style={{ flexShrink: 0, marginTop: "0.1rem" }} aria-hidden="true" />
      <span>
        {scope ? <>{scope} </> : null}
        {window ? <>Restricted to {window}. </> : null}
        {result.undated && result.undated.length > 0 ? (
          <span style={{ color: "var(--p-text-4)" }}>
            {result.undated.join(" and ")} carry no date, so they are not in this window.
          </span>
        ) : null}{" "}
        {unsearchable.length > 0 ? (
          <span style={{ color: "var(--p-text-4)" }}>{describeUnsearchable(unsearchable)}</span>
        ) : null}
      </span>
    </p>
  );
}

/**
 * An interpretation of the records, labelled as one.
 *
 * Nothing sends this field today — `/ask` builds every sentence it shows from
 * stored text — and it is rendered distinctly for the day something does: a
 * generated reading belongs beside the quotations in a different voice, never
 * inside the persona's paragraph, where a reader has been told every word is the
 * Speaker's own.
 */
function GeneratedReading({ reading }: { reading: NonNullable<AskResult["reading"]> }) {
  return (
    <div
      style={{
        margin: "0 0 0.85rem",
        padding: "0.7rem 0.8rem",
        borderRadius: 10,
        border: "1px dashed color-mix(in srgb, var(--p-text-4) 45%, transparent)",
        fontSize: "0.8rem",
        lineHeight: 1.6,
        color: "var(--p-text-2)",
      }}
    >
      <p
        style={{
          margin: "0 0 0.35rem",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "0.62rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--p-text-4)",
        }}
      >
        Generated reading &mdash; not his words
      </p>
      <p style={{ margin: 0 }}>{reading.text}</p>
      {reading.basedOn.length > 0 ? (
        <p style={{ margin: "0.4rem 0 0", fontSize: "0.72rem", color: "var(--p-text-4)" }}>
          Drawn from {reading.basedOn.length} cited record
          {reading.basedOn.length === 1 ? "" : "s"} above.
        </p>
      ) : null}
    </div>
  );
}

/**
 * What the answer could not do. A partial answer that does not say it is partial
 * is worse than no answer, because the reader has no way to tell the difference.
 */
function MatchNotice({ result }: { result: AskResult }) {
  if (result.match !== "any") return null;
  const gap = result.unmatched.length > 0;
  return (
    <p
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.5rem",
        margin: "0 0 0.85rem",
        padding: "0.6rem 0.75rem",
        borderRadius: 10,
        fontSize: "0.8rem",
        lineHeight: 1.5,
        color: "var(--p-text-2)",
        background: gap
          ? "color-mix(in srgb, var(--warning) 12%, transparent)"
          : "color-mix(in srgb, var(--primary) 8%, transparent)",
        border: `1px solid ${
          gap
            ? "color-mix(in srgb, var(--warning) 38%, transparent)"
            : "color-mix(in srgb, var(--primary) 28%, transparent)"
        }`,
      }}
    >
      {gap ? (
        <AlertTriangle size={14} aria-hidden style={{ flexShrink: 0, marginTop: "0.1rem" }} />
      ) : (
        <Layers size={14} aria-hidden style={{ flexShrink: 0, marginTop: "0.1rem" }} />
      )}
      <span>
        {gap ? (
          <>
            <strong style={{ color: "var(--p-text-1)" }}>Partial answer.</strong> No published
            record mentions{" "}
            {result.unmatched.map((t, i) => (
              <span key={t}>
                {i > 0 && (i === result.unmatched.length - 1 ? " or " : ", ")}
                <em style={{ color: "var(--p-text-1)" }}>{t}</em>
              </span>
            ))}
            . Everything below matched the remaining term
            {result.terms.length - result.unmatched.length === 1 ? "" : "s"}.
          </>
        ) : (
          <>
            <strong style={{ color: "var(--p-text-1)" }}>Combined answer.</strong> No single
            record covers every term, so this is assembled from the{" "}
            {result.citations.length + result.timeline.length + result.testimonials.length} closest
            matches below.
          </>
        )}
      </span>
    </p>
  );
}

function CitationCard({
  citation,
  allTerms,
  number,
}: {
  citation: AskResult["citations"][number];
  allTerms: string[];
  /** 1-based position in the answer, matching the numbering in "Copy sources". */
  number?: number;
}) {
  const Icon = KIND_ICON[citation.kind] ?? FileText;
  // The card is not itself a link.
  //
  // It was, which meant a clipping could only ever lead the reader to this
  // library's page for it — the one thing an archive can offer in place of the
  // paper it took the words from. Adding the original as a link inside a link is
  // invalid HTML that browsers resolve in unpredictable ways, so the card became a
  // container with the archive page as the title's link and the sources beside it.
  const sources = [
    ...(citation.url
      ? [
          {
            key: "original",
            href: citation.url,
            // Named by the paper where the row names one. When it only names the
            // aggregator, the link says so: "via Google News" is a fact about how
            // the archive found the clipping, and presenting that as the
            // publication would put a search engine in the source line of a
            // speech.
            label: citation.sourceName || citation.via || "the original",
            via: citation.sourceName ? citation.via : null,
          },
        ]
      : []),
    ...(citation.captureHref
      ? [{ key: "capture", href: citation.captureHref, label: "as captured", via: null }]
      : []),
  ];
  return (
    <li
      className="ask-citation-card p-card-lift"
      style={{
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
        // The active state lives in CSS (`.ask-citation-card[data-active]`), so this
        // inline style never changes between renders. Changing a border property
        // inline on every scroll-driven re-render is what React warned about.
        border: "1px solid var(--p-border)",
        background: "var(--p-surface-2)",
        borderRadius: 12,
        padding: "0.85rem 1rem",
        transition: "border-color 0.2s, transform 0.2s",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--primary)",
          marginBottom: "0.4rem",
        }}
      >
        {number !== undefined && (
          <span
            aria-label={`Source ${number}`}
            style={{
              display: "inline-grid",
              placeItems: "center",
              minWidth: 20,
              height: 20,
              padding: "0 0.3rem",
              borderRadius: 6,
              background: "color-mix(in srgb, var(--primary) 14%, transparent)",
              color: "var(--primary)",
              fontWeight: 700,
            }}
          >
            {number}
          </span>
        )}
        <Icon size={13} aria-hidden />
        {citation.kindLabel}
        {citation.year != null && (
          <span style={{ color: "var(--p-text-4)" }}>· {citation.year}</span>
        )}
      </span>
      <Link
        href={citation.href}
        style={{
          display: "block",
          fontWeight: 700,
          fontSize: "0.95rem",
          fontFamily: "var(--font-display), sans-serif",
          lineHeight: 1.35,
          color: "var(--p-text-1)",
        }}
      >
        <Highlight text={citation.title} terms={allTerms} />
      </Link>
      {citation.excerpt && (
        <span
          style={{
            display: "block",
            marginTop: "0.35rem",
            fontSize: "0.82rem",
            lineHeight: 1.55,
            color: "var(--p-text-3)",
          }}
        >
          <Highlight text={citation.excerpt} terms={allTerms} />
        </span>
      )}
      <span
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.3rem 0.85rem",
          marginTop: "0.6rem",
          fontSize: "0.78rem",
          fontWeight: 600,
          color: "var(--primary)",
        }}
      >
        <Link href={citation.href}>
          {citation.hasTranscript ? "Read the full transcript" : "Open in the archive"}
        </Link>
        {/* Named by the publication rather than "source": the point is that the
            reader can tell whose page this is. */}
        {sources.map(s => (
          <Link
            key={s.key}
            href={s.href}
            target={s.key === "original" ? "_blank" : undefined}
            rel={s.key === "original" ? "noopener noreferrer" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              color: "var(--p-text-3)",
              fontWeight: 500,
            }}
          >
            {s.label}
            {s.key === "original" ? (
              <ExternalLink size={12} aria-hidden />
            ) : (
              <FileText size={12} aria-hidden />
            )}
            {s.via ? (
              <span style={{ color: "var(--p-text-4)" }}>via {s.via}</span>
            ) : null}
          </Link>
        ))}
        {citation.matched.length > 0 && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              marginLeft: "auto",
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.65rem",
              fontWeight: 400,
              color: "var(--p-text-4)",
            }}
          >
            matched
            {citation.matched.map(term => (
              <span
                key={term}
                style={{
                  ...CHIP,
                  padding: "0.05rem 0.4rem",
                  fontSize: "0.65rem",
                  color: "var(--primary)",
                  borderColor: "color-mix(in srgb, var(--primary) 35%, transparent)",
                }}
              >
                {term}
              </span>
            ))}
          </span>
        )}
      </span>
    </li>
  );
}

function ResearchGuidance() {
  return (
    <div className="ask-guidance-panel">
      <h2>About this search</h2>
      <p>Search the published speeches, letters, papers, milestones and testimonials in the archive.</p>
      <p>Answers show the strongest matches and link back to each record, so you can check the source.</p>
      <p className="ask-guidance-disclaimer">
        <strong>This is not the Speaker himself.</strong> It is a search of the published archive. First-person passages are quoted from their linked records.
      </p>
    </div>
  );
}

/** A suggested question the reader can fire off with one click. */
function AskChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: (q: string) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(label)}
      disabled={disabled}
      style={{
        fontSize: "0.78rem",
        color: "var(--primary)",
        background: "color-mix(in srgb, var(--primary) 9%, transparent)",
        border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
        borderRadius: 999,
        padding: "0.45rem 0.9rem",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        minHeight: HIT,
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}

/**
 * What the answer looks like while it is still being found.
 *
 * "Searching the archive…" told the reader that time was passing. It did not
 * tell them what was coming, so a two-second search and a twenty-second one were
 * indistinguishable and both read as a stall. These bars are the real answer's
 * shape — a short summary, then citation cards — so the wait has a visible
 * destination, and the layout does not jump when the real answer replaces them.
 *
 * Marked `aria-hidden` and paired with the polite status line, which is what a
 * screen reader actually hears. A skeleton read aloud bar by bar would be noise.
 */
function ThinkingSkeleton() {
  const bar = (width: string, height = 11) => (
    <span
      className="ask-skeleton"
      aria-hidden
      style={{ display: "block", width, height, borderRadius: 6 }}
    />
  );
  return (
    <div aria-hidden style={{ display: "grid", gap: "0.7rem" }}>
      <div style={{ display: "grid", gap: "0.45rem" }}>
        {bar("92%")}
        {bar("97%")}
        {bar("58%")}
      </div>
      <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.35rem" }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              display: "grid",
              gap: "0.4rem",
              padding: "0.75rem 0.85rem",
              border: "1px solid var(--p-border)",
              borderRadius: 12,
            }}
          >
            {bar("32%", 8)}
            {bar(i === 2 ? "64%" : "86%", 12)}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The Speaker's own words.
 *
 * This is the only place in the page where the first person appears, and it only
 * appears inside these quotations. The framing around them states a source and
 * nothing else, and every passage links to the record it was taken from — so a
 * reader can check any sentence of it against the source in one click. Nothing in
 * this block is generated, paraphrased or assembled.
 */
function PersonaQuotes({
  quotes,
  terms,
}: {
  quotes: NonNullable<AskResult["conversation"]>["quotes"];
  terms: string[];
}) {
  if (quotes.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: "0.85rem", margin: "0 0 1rem" }}>
      {quotes.map((quote, i) => (
        <figure
          key={`${quote.href}-${i}`}
          style={{
            margin: 0,
            padding: "0.9rem 1.1rem",
            borderLeft: "3px solid var(--primary)",
            borderRadius: "0 12px 12px 0",
            background: "color-mix(in srgb, var(--primary) 5%, transparent)",
          }}
        >
          <blockquote
            style={{
              margin: 0,
              fontFamily: "var(--font-display), serif",
              fontSize: "1.0625rem",
              lineHeight: 1.55,
              color: "var(--p-text-1)",
              textWrap: "pretty",
            }}
          >
            <span aria-hidden style={{ color: "var(--primary)", marginRight: "0.15em" }}>
              “
            </span>
            <Highlight text={quote.text} terms={terms} />
            <span aria-hidden style={{ color: "var(--primary)" }}>
              ”
            </span>
          </blockquote>
          <figcaption
            style={{
              marginTop: "0.6rem",
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono), monospace",
              color: "var(--p-text-3)",
            }}
          >
            <Link
              href={quote.href}
              style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}
            >
              {quote.title}
            </Link>
            {quote.year ? ` · ${quote.year}` : ""} · {quote.kindLabel.toLowerCase()}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/**
 * A heading, not a styled div.
 *
 * An answer is a document with sections — the records it found, the timeline,
 * the testimonials, the breadth of the search, what to ask next. Labelling those
 * with `<div>`s meant a screen reader navigating by heading found nothing inside
 * an answer, and had to read it top to bottom to find out what was in it.
 *
 * `h2`: the sections are the top-level structure of the answer, which itself sits
 * directly under the page's `h1`.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: "0.68rem",
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--p-text-4)",
        margin: "1.1rem 0 0.5rem",
      }}
    >
      {children}
    </h2>
  );
}

function AssistantReply({
  result,
  failed,
  stopped,
  onRetry,
  onCopy,
  onFollowUp,
  copied,
  busy,
}: {
  result?: AskResult;
  failed?: boolean;
  stopped?: boolean;
  onRetry?: () => void;
  onCopy: (text: string) => void;
  onFollowUp: (q: string) => void;
  copied: boolean;
  /** A search is in flight, so these would be dropped on the floor. */
  busy?: boolean;
}) {
  const retryButton = (label: string, icon: React.ReactNode) =>
    onRetry && (
      <button
        type="button"
        onClick={onRetry}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          marginTop: "0.75rem",
          background: "none",
          border: "1px solid var(--p-border-2)",
          borderRadius: 999,
          padding: "0.45rem 0.9rem",
          color: "var(--p-text-1)",
          fontSize: "0.82rem",
          fontWeight: 600,
          cursor: "pointer",
          minHeight: HIT,
        }}
      >
        {icon} {label}
      </button>
    );

  if (stopped) {
    return (
      <div>
        <p style={{ margin: 0, color: "var(--p-text-2)" }}>
          Search stopped. Nothing was lost — the question is still here.
        </p>
        {retryButton("Run it again", <RefreshCw size={14} aria-hidden />)}
      </div>
    );
  }

  if (failed) {
    return (
      <div>
        <p style={{ margin: 0, color: "var(--p-text-2)" }}>
          The archive could not be reached. Nothing was lost — try again.
        </p>
        {retryButton("Try again", <RefreshCw size={14} aria-hidden />)}
      </div>
    );
  }

  if (!result) return null;

  // A dead end: either the question reduced to no searchable terms ("Who was
  // he?") or nothing published matches. Both used to end in a paragraph of
  // advice; both now point at the pages that actually hold the answer.
  const deadEnd = result.match === "none";
  const shown = result.citations.length + result.timeline.length + result.testimonials.length;

  const copyText = [
    result.summary,
    ...result.citations.map(
      (c, i) => `${i + 1}. ${c.title}${c.year ? ` (${c.year})` : ""} — ${c.href}`,
    ),
  ].join("\n");

  if (deadEnd) {
    return (
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, color: "var(--p-text-1)" }}>{result.summary}</p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.45rem",
            marginTop: "0.85rem",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.72rem",
              fontFamily: "var(--font-mono), monospace",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--p-text-4)",
            }}
          >
            <Landmark size={12} aria-hidden /> try
          </span>
          {FALLBACK_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--primary)",
                textDecoration: "none",
                background: "color-mix(in srgb, var(--primary) 9%, transparent)",
                border: "1px solid color-mix(in srgb, var(--primary) 32%, transparent)",
                borderRadius: 999,
                padding: "0.35rem 0.8rem",
                minHeight: HIT,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minWidth: 0 }}>
      {/* Capped in `ch` rather than left to the column: the column is now wide
          enough to fit citation cards two-up, but a summary paragraph stretched
          to that width is unreadable. Prose keeps its measure, cards use the
          space.

          The persona opening ("In my own words, from …") is already the head of
          `summary` — the server composes the two together so a partial-answer
          disclosure can be placed *before* the quotation, which is the only order
          that is honest. Rendering `conversation.lead` as well would print it
          twice. */}
      <p style={{ margin: 0, maxWidth: "68ch", color: "var(--p-text-1)" }}>
        <Highlight text={result.summary} terms={result.matchedTerms} />
      </p>

      <div style={{ marginTop: "0.85rem" }}>
        <PersonaQuotes quotes={result.conversation?.quotes ?? []} terms={result.matchedTerms} />
        {result.reading ? <GeneratedReading reading={result.reading} /> : null}
        <WindowNotice result={result} />
        <TermsReadout result={result} />
        <MatchNotice result={result} />
      </div>

      {result.citations.length > 0 && (
        <>
          <SectionLabel>
            {result.citations.length} item{result.citations.length === 1 ? "" : "s"} in the archive
          </SectionLabel>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              // Citation cards are short, link-shaped blocks. Stacked in one
              // column they made every answer twice as tall as it needed to be
              // on a wide screen; two-up past ~900px of bubble width is where
              // the card still has room for a title plus an excerpt.
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
              gap: "0.6rem",
            }}
          >
            {result.citations.map((c, index) => (
              <CitationCard
                key={c.href}
                citation={c}
                number={index + 1}
                allTerms={result.matchedTerms}
              />
            ))}
          </ul>
        </>
      )}

      {result.timeline.length > 0 && (
        <>
          <SectionLabel>From the timeline</SectionLabel>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.35rem" }}>
            {result.timeline.map(m => (
              <li
                key={`${m.year}-${m.title}`}
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  fontSize: "0.875rem",
                  color: "var(--p-text-2)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono), monospace",
                    fontSize: "0.75rem",
                    color: "var(--primary)",
                    flexShrink: 0,
                    paddingTop: "0.1rem",
                  }}
                >
                  {m.year ?? "—"}
                </span>
                <span>
                  {m.href ? (
                    <Link href={m.href} style={{ color: "inherit" }}>
                      <Highlight text={m.title} terms={result.matchedTerms} />
                    </Link>
                  ) : (
                    <Highlight text={m.title} terms={result.matchedTerms} />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {result.testimonials.length > 0 && (
        <>
          <SectionLabel>What others have said</SectionLabel>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {result.testimonials.map((t, i) => (
              <blockquote
                key={`${t.author}-${i}`}
                style={{
                  margin: 0,
                  borderLeft: "2px solid var(--primary)",
                  paddingLeft: "0.85rem",
                  fontSize: "0.875rem",
                  lineHeight: 1.6,
                  color: "var(--p-text-2)",
                }}
              >
                “<Highlight text={t.quote} terms={result.matchedTerms} />”
                <footer
                  style={{
                    marginTop: "0.35rem",
                    fontSize: "0.75rem",
                    color: "var(--p-text-4)",
                  }}
                >
                  {t.href ? (
                    <Link href={t.href} style={{ color: "inherit" }}>
                      {t.author}
                      {t.role ? `, ${t.role}` : ""}
                    </Link>
                  ) : (
                    <>
                      {t.author}
                      {t.role ? `, ${t.role}` : ""}
                    </>
                  )}
                </footer>
              </blockquote>
            ))}
          </div>
        </>
      )}

      {/* Where the answer came from, including what was left out. The response is
          capped at ten records, so a reader told "12 records matched" needs to
          know they are looking at a sample. */}
      {/* Disclosure rather than a section: on a phone this block pushed the
          citations — the part of the answer the reader came for — below a row of
          chips describing a search. The chips are still one tap away, and the
          summary says how many there are so the reader knows what they are
          choosing to open. On a wide screen the detail is simply shown, because
          there is room for it and the affordance would be noise. */}
      {result.collectionCounts.length > 0 && (
        <section aria-labelledby="ask-breadth-heading">
        {/* A `summary` is a button, not a heading, so it cannot be this section's
            label for assistive technology. Without a real heading in the outline,
            navigating by heading skipped straight past the block that says what
            the search did not cover. */}
        <h2 id="ask-breadth-heading" className="sr-only">
          Searched across the archive
        </h2>
        <details className="ask-disclosure">
          <summary className="ask-disclosure-summary">
            Searched across the archive
            <span style={{ color: "var(--p-text-4)" }}>
              {" "}
              &mdash; {result.collectionCounts.length} collection
              {result.collectionCounts.length === 1 ? "" : "s"}
              {result.undated && result.undated.length > 0
                ? `, ${result.undated.length} left undated`
                : ""}
            </span>
          </summary>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.35rem",
              paddingTop: "0.5rem",
            }}
          >
            {result.collectionCounts.map(c => (
              <span key={c.collection} style={CHIP}>
                {c.count} {c.label.toLowerCase()}
                {/* Where a collection has records matching only part of the
                    question, say so on the chip: "1 news" next to a reader who
                    was shown a partial answer reads as "that is all there is". */}
                {c.broader ? (
                  <span style={{ color: "var(--p-text-4)" }}> of {c.broader}</span>
                ) : null}
              </span>
            ))}
            {result.totalMatched > shown && (
              <span style={{ ...CHIP, borderStyle: "dashed", color: "var(--p-text-4)" }}>
                {result.totalMatched - shown} more not shown
              </span>
            )}
          </div>
        </details>
        </section>
      )}

      {/* The answer is capped at the strongest ten records. Someone who wants
          all of them — or a result this ranking left out — needs a way into the
          exhaustive result list, and /search is where that already lives. */}
      {result.terms.length > 0 && (
        <p style={{ margin: "0.9rem 0 0" }}>
          <Link
            href={`/search?q=${encodeURIComponent(result.terms.join(" "))}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              minHeight: HIT,
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={13} aria-hidden /> See every match in Search
          </Link>
        </p>
      )}

      {/* Follow-ups, so an answer is a door rather than a dead end. */}
      {result.suggested.length > 0 && (
        <>
          <SectionLabel>Ask next</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {result.suggested.slice(0, 3).map(s => (
              <AskChip key={s} onClick={onFollowUp} label={s} disabled={busy} />
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: "1rem" }}>
        <button
          type="button"
          onClick={() => onCopy(copyText)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            background: "none",
            border: "1px solid var(--p-border-2)",
            borderRadius: 999,
            padding: "0.4rem 0.8rem",
            color: "var(--p-text-3)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            minHeight: HIT,
          }}
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {/* The live region is on the label, not the button: it is the text change
              that needs announcing, and putting it on the button would also
              announce the icon swap. */}
          <span aria-live="polite">{copied ? "Copied" : "Copy sources"}</span>
        </button>
      </div>
    </div>
  );
}

export default function AskConsole({
  initialQuery = null,
}: {
  initialQuery?: string | null;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(ASK_SUGGESTIONS.slice(0, 3));
  const [chats, setChats] = useState<PersistedChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // The latest transcript, for `ask` to read without taking `messages` as a
  // dependency. Closing over `messages` directly would hand every call site a
  // snapshot from an earlier render.
  const messagesRef = useRef<ChatMsg[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  // Set only while a reader-initiated stop is in flight, so the composer can
  // swap Send for Stop without also offering to cancel a teardown.
  const stopRef = useRef<(() => void) | null>(null);
  // Requests abandoned because a newer question replaced them. Distinguishes
  // "the reader moved on" from "the reader pressed stop": the first is silently
  // withdrawn, the second earns a "search stopped" turn in the transcript.
  const supersededRef = useRef(new Set<AbortController>());
  const [docked, setDocked] = useState(false);
  // The docked bar is lifted out of the flow, so something has to stand in for
  // it. That used to be a hardcoded 64 or 78 pixels, which was wrong the moment
  // the box grew a line — a reader who had expanded the textarea to write a long
  // question would lose the last citation behind their own composer. Measuring
  // it is the whole fix.
  const [dockMetrics, setDockMetrics] = useState({ height: 0, left: 0, width: 0 });

  // Where the docked bar has to sit, measured off the transcript rather than
  // guessed from the viewport.
  //
  // The obvious arithmetic — centre of the viewport, pushed right by half the
  // rail — is only correct while the transcript is flush against the rail's
  // inner edge. It is centred in whatever space is left over, so the moment
  // there is a history column beside it too, the guess is off by however much
  // `margin: auto` moved the column. That is exactly the class of bug nobody
  // notices by eye, because the bar still looks plausible over a citation and
  // is only measurably wrong. Measured, it cannot drift.
  useEffect(() => {
    const form = composerRef.current;
    const main = mainRef.current;
    if (!form || !main) return;

    let last = "";
    const measure = () => {
      const height = form.getBoundingClientRect().height;
      const padLeft = parseFloat(getComputedStyle(main).paddingLeft) || 0;
      const padRight = parseFloat(getComputedStyle(main).paddingRight) || 0;
      // Layout, not viewport: `offsetLeft` is unaffected by scrolling, so this
      // does not need to re-run as the reader moves down the transcript. The
      // content box rather than the border box, so the docked bar's edges line
      // up with the text and the citation cards instead of hanging 24px into
      // the gutters on each side.
      const left = main.getBoundingClientRect().left + padLeft;
      const width = Math.max(0, main.offsetWidth - padLeft - padRight);
      const next = `${Math.round(height)}:${Math.round(left)}:${Math.round(width)}`;
      // Re-rendering a transcript on every scroll frame is not worth a
      // sub-pixel difference.
      if (next === last) return;
      last = next;
      setDockMetrics({ height, left, width });
    };

    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(form);
    observer?.observe(main);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  // Whether the reader is already at the end of the page. Only then is a new
  // turn worth pulling them to; scrolling someone out of a citation they were
  // mid-way through reading is the worst thing this page could do. Starts false
  // because a page that has not been scrolled has not been read.
  const atBottomRef = useRef(false);
  // A question the reader just asked always scrolls, even mid-page: they asked
  // it, so the answer is what they are waiting on.
  const forceScrollRef = useRef(false);
  const bootedRef = useRef(false);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text) return;

      // A question asked while a search is in flight replaces it rather than
      // being dropped. The composer is deliberately left enabled mid-search, so a
      // reader can have a follow-up ready; Enter used to be swallowed here with no
      // feedback at all, which is the one outcome that leaves them with a typed
      // question and no way to send it. Replacing matches what /search does with
      // the same input, and stops being a race the reader has to notice.
      const inFlight = abortRef.current;
      if (inFlight) {
        supersededRef.current.add(inFlight);
        inFlight.abort();
      }

      const userMsg: ChatMsg = { role: "user", content: text };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setCopiedIndex(null);
      setLinkCopied(false);
      setLoading(true);
      forceScrollRef.current = true;
      writeQueryParam(text);

      const controller = new AbortController();
      abortRef.current = controller;

      // Only a stop the reader asked for earns a "search stopped" turn. Unmount
      // and "new conversation" also abort, and neither should leave a trace in a
      // transcript that is being torn down or has already been cleared.
      let stopAsked = false;
      const onStop = () => {
        stopAsked = true;
        controller.abort();
      };
      stopRef.current = onStop;

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The transcript travels with the question so the server can resolve a
          // follow-up against it. Without this, "more on that?" has no subject to
          // carry forward and the page has to answer as if it were the first
          // question of the conversation. Only user turns are sent: an assistant
          // turn is a summary this page wrote, and treating it as something the
          // reader asked would let the page answer its own words back to them.
          body: JSON.stringify({
            question: text,
            messages: messagesRef.current
              .filter(m => m.role === "user")
              .map(m => ({ role: m.role, content: m.content })),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          setMessages(prev => [
            ...prev,
            { role: "assistant", content: "", failed: true },
          ]);
          return;
        }

        // Normalised for the same reason history is: the renderer reads these
        // fields unconditionally, so a response that is merely `ok` but not the
        // expected shape would otherwise throw instead of showing an error.
        const result = normaliseResult(await res.json());
        if (!result) {
          setMessages(prev => [
            ...prev,
            { role: "assistant", content: "", failed: true },
          ]);
          return;
        }
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: result.summary, result },
        ]);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setMessages(prev => [...prev, { role: "assistant", content: "", failed: true }]);
      } finally {
        // `delete` reports whether it was there, so this both reads and clears
        // the flag.
        const superseded = supersededRef.current.delete(controller);
        // Only the request that still owns the composer may clear the loading
        // state. A superseded one finishing after its replacement would otherwise
        // report the search as finished while the new one was still running, and
        // the Stop button would swap back to Send mid-flight.
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoading(false);
        }
        if (stopRef.current === onStop) stopRef.current = null;
        if (stopAsked) {
          // The question stays in the transcript; this is the turn that says the
          // search for it was cut short, so the reader is never left looking at a
          // question that appears to have been ignored.
          setMessages(prev => [...prev, { role: "assistant", content: "", stopped: true }]);
        }
        if (superseded) {
          // Withdraw the abandoned question with its search. Left in place it would
          // be a question in the transcript that never gets an answer — the exact
          // dangling state the stop turn exists to avoid. Removed by identity
          // rather than position: by now the replacement question is on screen, and
          // "the last message" is no longer the one being abandoned.
          setMessages(prev => prev.filter(m => m !== userMsg));
        }
      }
    },
    [],
  );

  useEffect(() => {
    let loadedChats: PersistedChat[] = [];
    try {
      loadedChats = loadAllChats();
    } catch {
      /* storage unavailable — start a session-only conversation */
    }
    const activeChat = loadedChats[0] ?? createNewChat();
    const restored = restoreMessages(activeChat);
    setChats(loadedChats.length > 0 ? loadedChats : [activeChat]);
    setActiveChatId(activeChat.id);
    messagesRef.current = restored;
    setMessages(restored);
    setHydrated(true);

    const pending = initialQuery?.trim();
    const lastAsked = [...restored].reverse().find(m => m.role === "user")?.content;
    if (pending && pending !== lastAsked) void ask(pending);

    bootedRef.current = true;
  }, [ask, initialQuery]);

  useEffect(() => {
    if (!hydrated || !activeChatId) return;
    const firstQuestion = messages.find(message => message.role === "user")?.content.trim();
    const title = firstQuestion
      ? firstQuestion.length > 40 ? `${firstQuestion.slice(0, 40)}…` : firstQuestion
      : "New conversation";
    const updatedAt = Date.now();
    setChats(previous => {
      const next = previous.map(chat => chat.id === activeChatId
        ? { ...chat, title, updatedAt, messages }
        : chat);
      saveAllChats(next);
      return next;
    });
  }, [messages, hydrated, activeChatId]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      atBottomRef.current =
        window.innerHeight + window.scrollY >= doc.scrollHeight - 120;
    };
    // Deliberately not measured on mount: at that point the restored transcript
    // has not been committed, so the page is still short and every position
    // would read as "at the bottom".
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!bootedRef.current) return;
    const el = endRef.current;
    if (!el) return;
    // Already on screen — a short answer that never left the viewport needs no
    // help, and this is also what keeps a restored transcript from yanking the
    // reader to the bottom of a conversation they have not seen yet.
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    if (!forceScrollRef.current && !atBottomRef.current) return;
    forceScrollRef.current = false;
    if (typeof el.scrollIntoView !== "function") return;
    // A smooth scroll on every new turn is disorienting for readers who have
    // asked the OS to stop motion.
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "end", behavior: reduced ? "auto" : "smooth" });
  }, [messages, loading]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * Grow the composer to fit what was typed, then stop.
   *
   * A question here is a sentence or two, not a keyword, so a single-line field
   * was the wrong control: it scrolled its own text sideways, hid the rest of
   * the question, and invited the short one-word questions the archive answers
   * worst. Collapsing back to one row on an empty value keeps the resting
   * height identical to the field this replaced, so nothing below it shifts.
   */
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // An empty field is sized by its `min-height`, never by a measurement.
    // Measuring an empty textarea counts the placeholder, which wraps onto a
    // second line on a phone — so the resting box was 74px tall and dropped to
    // 48px the instant the first character landed, shrinking the composer under
    // the reader's thumb halfway through writing the question.
    if (!input) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, COMPOSER_MAX_H);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_H ? "auto" : "hidden";
  }, [input, docked]);

  /**
   * Dock the composer once it has scrolled out of view.
   *
   * The composer stays at the top of the page on purpose — a reader should not
   * have to scroll past a wall of citations to find the box that produced
   * them. But after a few turns the top of the page is a long way up, and the
   * only way to ask again would be to scroll all the way back. Docking solves
   * both: the composer is still above the transcript, and it is still reachable
   * once the reader is deep inside one.
   *
   * The bar is a view follower, not a layout sibling — it is measured on every
   * scroll rather than placed by the document flow, so docking never reflows
   * the transcript and never costs the reader their scroll position.
   */
  useEffect(() => {
    // The composer's position in the document, captured while it is still in the
    // flow. Docking lifts the form out of the flow entirely, so once it is
    // docked its own rect describes the docked bar rather than the anchor point
    // — measuring it then would flip the state straight back and the bar would
    // strobe on every scroll event. This anchor is compared against instead.
    let anchor: number | null = null;
    let isDocked = false;

    const measure = () => {
      // Hand the viewport back to the page footer before the fixed composer can
      // cover it. Scope this to the site footer: answer quotes can also render
      // their own <footer> elements.
      const footer = document.querySelector<HTMLElement>(".ask-page-root > footer");
      const footerVisible = footer && footer.getBoundingClientRect().top < window.innerHeight;
      if (footerVisible) {
        if (isDocked) {
          isDocked = false;
          setDocked(false);
        }
        return;
      }

      if (isDocked) {
        // Back near the top? The in-flow composer is on screen again, so hand
        // the page back to it.
        if (anchor !== null && window.scrollY <= anchor + 8) {
          isDocked = false;
          setDocked(false);
        }
        return;
      }
      const el = composerRef.current;
      if (!el) return;
      anchor = el.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > anchor + 8) {
        isDocked = true;
        setDocked(true);
      }
    };

    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/ask", { signal: controller.signal })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { suggested?: string[] }) => {
        if (Array.isArray(data.suggested) && data.suggested.length > 0) {
          setSuggestions(data.suggested.slice(0, 3));
        }
      })
      .catch(() => {
        /* keep the static suggestions */
      });
    return () => controller.abort();
  }, []);

  // The one line a screen reader hears for each completed turn. Reading the
  // full answer aloud is the alternative, and it is unusable.
  const lastResult = [...messages].reverse().find(m => m.role === "assistant")?.result;
  const lastAnswer = lastResult
    ? lastResult.match === "none"
      ? "No answer found."
      : lastResult.match === "any" && lastResult.unmatched.length > 0
        ? `Partial answer. Nothing in the archive covers ${lastResult.unmatched.join(" or ")}.`
        : "Answer found."
    : undefined;
  const lastAnswerCount = lastResult
    ? lastResult.citations.length + lastResult.timeline.length + lastResult.testimonials.length
    : 0;

  const handleNewChat = () => {
    abortRef.current?.abort();
    const nextChat = createNewChat();
    const nextChats = [nextChat, ...chats];
    setChats(nextChats);
    saveAllChats(nextChats);
    setActiveChatId(nextChat.id);
    setMessages([]);
    messagesRef.current = [];
    setInput("");
    setCopiedIndex(null);
    setLinkCopied(false);
    setLoading(false);
    writeQueryParam(null);
    inputRef.current?.focus();
  };

  const handleSelectChat = (chatId: string) => {
    const chat = chats.find(candidate => candidate.id === chatId);
    if (!chat) return;
    abortRef.current?.abort();
    const restored = restoreMessages(chat);
    setMessages(restored);
    messagesRef.current = restored;
    setActiveChatId(chatId);
    setLoading(false);
    setInput("");
    setCopiedIndex(null);
    setLinkCopied(false);
    writeQueryParam(null);
    inputRef.current?.focus();
  };

  const handleDeleteChat = (chatId: string) => {
    const remaining = chats.filter(chat => chat.id !== chatId);
    if (chatId !== activeChatId) {
      setChats(remaining);
      saveAllChats(remaining);
      return;
    }

    abortRef.current?.abort();
    const replacement = remaining[0] ?? createNewChat();
    const nextChats = remaining.length > 0 ? remaining : [replacement];
    const restored = restoreMessages(replacement);
    setChats(nextChats);
    saveAllChats(nextChats);
    setActiveChatId(replacement.id);
    setMessages(restored);
    messagesRef.current = restored;
    setInput("");
    setLoading(false);
    setCopiedIndex(null);
    setLinkCopied(false);
    writeQueryParam(null);
  };

  const onCopy = (text: string, index: number) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 1600);
    });
  };

  const onCopyLink = () => {
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1600);
    });
  };

  const emptyChat = hydrated && messages.length === 0;
  const previousChats = chats.filter(chat =>
    chat.id !== activeChatId && chat.messages.some(message => message.role === "user"),
  );
  const hasHistory = previousChats.length > 0;

  /**
   * The question each turn belongs to, by index.
   *
   * Every failed and stopped turn carries a "Try again" button, and it has to ask
   * *its own* question. It used to be handed the newest question in the
   * transcript, so asking A, failing, asking B and succeeding left A's retry
   * button asking B — a button labelled "Try again" beside one failure, quietly
   * re-running a different question the reader had just got a good answer to.
   *
   * One forward pass rather than a backwards search per turn: each turn carries
   * the question in effect when it was rendered, and a user's own turn carries
   * itself.
   */
  const turnQuestion: (string | undefined)[] = [];
  let latestQuestion: string | undefined;
  for (const m of messages) {
    if (m.role === "user") latestQuestion = m.content;
    turnQuestion.push(latestQuestion);
  }

  return (
    <div
      className={`ask-shell ask-console relative flex w-full min-w-0 flex-1 flex-col${messages.length === 0 ? " ask-console-empty" : ""}`}
      data-has-conversation={messages.length > 0 ? "on" : "off"}
      data-has-history={hasHistory ? "on" : "off"}
    >
      <div className="ask-history" data-open={historyExpanded ? "on" : "off"}>
        <button
          className="ask-history-toggle"
          type="button"
          aria-expanded={historyExpanded}
          onClick={() => setHistoryExpanded(open => !open)}
        >
          Conversation history ({previousChats.length})
        </button>
        <div className="ask-history-content">
          <ChatHistorySidebar
            chats={previousChats}
            activeChatId={activeChatId}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            className="ask-history-panel"
          />
        </div>
      </div>

      <main
        ref={mainRef}
        className="mx-auto flex w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] transition-[max-width] duration-200 ease-out sm:px-6 sm:pb-8 lg:max-w-[var(--ask-col)]"
      >
      {messages.length > 0 && (
      <div
        style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.25rem 0.75rem",
            marginBottom: "0.65rem",
          }}
        >
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--p-text-4)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {lastAnswerCount} source{lastAnswerCount === 1 ? "" : "s"} in the last answer
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
            <button
              type="button"
              onClick={onCopyLink}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                background: "none",
                border: "none",
                color: "var(--p-text-3)",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
                minHeight: HIT,
                padding: "0 0.6rem",
              }}
            >
              {linkCopied ? <Check size={13} aria-hidden /> : <Link2 size={13} aria-hidden />}
              <span aria-live="polite">{linkCopied ? "Link copied" : "Copy link"}</span>
            </button>
            <button
              type="button"
              onClick={handleNewChat}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "none",
                border: "none",
                color: "var(--p-text-3)",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
                minHeight: HIT,
                padding: "0 0.6rem",
              }}
            >
              <RotateCcw size={13} aria-hidden /> New conversation
            </button>
          </span>
        </div>
      )}

      {/* The composer sits directly under the hero, not at the foot of a
          viewport-height shell. A reader who has to scroll past a wall of
          citations to find the box that produced them is a reader who asks one
          question and leaves. The follow-up chips inside each answer are the
          fast path to the next question, and once the reader scrolls past this
          box it follows them down as a docked bar.

          It stays enabled while a search is in flight: someone who has just
          watched a slow answer arrive can be drafting the follow-up before the
          first one lands, and there is no reason to make them wait for a
           round trip to start typing. Sending it then replaces the search in
           flight — see `ask` — so a follow-up typed early can be fired without
           waiting for the answer it was a follow-up to. */}
      <p className="ask-source-note">
        <MessageSquare size={14} aria-hidden style={{ marginTop: "0.05rem", flexShrink: 0 }} />
        <span>
          <strong>Archive search:</strong> the Speaker isn’t answering directly; results come from
          published records.
        </span>
      </p>
      <form
        ref={composerRef}
        onSubmit={e => {
          e.preventDefault();
          void ask(input);
        }}
        className={
          docked
             ? // Pushed right by half the guide rail so the docked box stays over
              // the transcript it belongs to — centring it on the viewport would
              // park it half under the figure for the whole length of a long
              // answer. Both numbers come from the container's custom
              // properties, so this follows the rail instead of assuming it.
               "ask-docked ask-composer fixed bottom-[max(0.7rem,env(safe-area-inset-bottom))] left-1/2 z-45 flex w-[calc(100vw-1rem)] -translate-x-1/2 items-end gap-2 rounded-3xl border border-[var(--p-border-3)] bg-[color-mix(in_srgb,var(--p-bg)_94%,transparent)] p-[0.4rem] shadow-[var(--p-shadow)] backdrop-blur-[16px] transition-[transform,box-shadow] duration-200 ease-out"
            : // `w-full` is load-bearing, not decoration. `main` is a column flex
              // container, and an `auto` margin on a flex item replaces the
              // cross-axis stretch: the form shrink-to-fit to its contents and
              // `max-width` capped it at 288px — a 234px field on a 1440px
              // screen. A definite width plus auto margins centres it without
              // giving up the stretch.
               "ask-composer flex w-full items-end gap-2.5 transition-[box-shadow] duration-200 ease-out mx-auto"
        }
        style={
          docked
            ? ({
                "--dock-left": `${dockMetrics.left}px`,
                "--dock-width": `${dockMetrics.width}px`,
              } as React.CSSProperties)
            : { maxWidth: "min(48rem, 100%)" }
        }
      >
        <label htmlFor="ask-question" className="sr-only">
          Ask a question about the archive
        </label>
        {/* No `outline: none` here. The site sets a focus ring on `*:focus-visible`
            (globals.css), and an inline `outline` outranks it — which left the one
            control every visitor has to use with no visible keyboard focus at all.
            A text field always matches `:focus-visible` when focused, so the ring
            shows for pointer focus too, which is what a reader expects from a box
            they have just tapped. */}
        <textarea
          id="ask-question"
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            // Enter asks; Shift+Enter is a newline. A question is prose, so the
            // reader needs a way to write more than one line of it before
            // sending, and the mobile keyboard is told which key does what.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask(input);
            }
          }}
          rows={1}
          placeholder="Ask about a speech, letter, theme or period…"
          maxLength={MAX_QUESTION}
          enterKeyHint="send"
          autoComplete="off"
          spellCheck
          style={{
            flex: 1,
            minWidth: 0,
            background: "var(--p-surface)",
            border: "1px solid var(--p-border-3)",
            borderRadius: 20,
            padding: "0.7rem 1.05rem",
            // 50, not 44. The old floor was the WCAG minimum, which is fine for
            // a checkbox and mean for the one control on the page a reader has
            // to aim a thumb at. It is also exactly one line of 16px/1.6 text
            // plus padding and border, so the field does not jump by a couple of
            // pixels the moment the first character arrives.
            minHeight: 50,
            maxHeight: COMPOSER_MAX_H,
            color: "var(--p-text-1)",
            // 16px exactly, not 15.6. iOS Safari zooms the whole viewport on
            // focus for anything under 16 and does not zoom back out when the
            // field loses focus, which leaves the reader stranded mid-page on a
            // question they have not sent yet.
            fontSize: "1rem",
            lineHeight: 1.6,
            fontFamily: "inherit",
            resize: "none",
            overflowY: "hidden",
            boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
            transition: "border-color 150ms ease-out, box-shadow 150ms ease-out",
          }}
          aria-describedby="ask-composer-help"
        />
        <span id="ask-composer-help" className="sr-only">
          Press Enter to send, Shift+Enter for a new line.
        </span>
        {loading ? (
          <button
            type="button"
            onClick={() => stopRef.current?.()}
            aria-label="Stop searching"
            title="Stop searching"
            style={{
              background: "var(--p-surface-2)",
              border: "1px solid var(--p-border-3)",
              color: "var(--p-text-1)",
              borderRadius: 999,
              width: 44,
              height: 44,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 100ms ease-out",
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <span
              aria-hidden
              style={{ width: 13, height: 13, borderRadius: 3, background: "currentColor" }}
            />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send question"
            style={{
              background: "var(--primary)",
              border: "none",
              color: "var(--primary-fg)",
              borderRadius: 999,
              width: 44,
              height: 44,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: input.trim() ? "pointer" : "not-allowed",
              opacity: input.trim() ? 1 : 0.5,
              transition: "opacity 150ms ease-out, transform 100ms ease-out",
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Send size={18} aria-hidden />
          </button>
        )}
      </form>

      {emptyChat && (
        <div
          className="ask-suggestions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            margin: "0.85rem 0 0",
          }}
        >
          {suggestions.map(s => (
            <AskChip key={s} label={s} onClick={q => void ask(q)} disabled={loading} />
          ))}
        </div>
      )}

      {/*
        A polite live region on the transcript itself re-reads the whole
        answer — summary, every citation, every testimonial — on each turn,
        which is unusable with a screen reader. Announcing only the one-line
        status below keeps the reader informed without the noise; the log keeps
        the landmark so the transcript is still reachable, just not
        re-announced.
      */}
      <p className="sr-only" role="status" aria-live="polite">
        {loading
          ? "Searching the archive"
          : lastAnswer
            ? `${lastAnswer} ${lastAnswerCount} source${
                lastAnswerCount === 1 ? "" : "s"
              } found.`
            : ""}
      </p>

      <div
        role="log"
        aria-live="off"
        aria-busy={loading}
        aria-label="Conversation with the archive"
        style={{
          display: "grid",
          gap: "0.9rem",
          marginTop: "1.25rem",
          alignContent: "start",
        }}
      >
        {!hydrated && messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--p-text-4)" }}>
            Restoring your last conversation…
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ask-message ask-message-user" style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                 className="ask-user-bubble"
                 style={{
                  maxWidth: "min(85%, 38rem)",
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  borderRadius: 20,
                  borderBottomRightRadius: 8,
                  padding: "0.75rem 1rem",
                  fontSize: "0.9375rem",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                  transition: "box-shadow 150ms ease-out",
                }}
              >
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="ask-message ask-message-assistant" style={{ display: "flex", gap: "0.6rem" }}>
              <span style={AVATAR} aria-hidden>
                <Sparkles size={15} />
              </span>
              <div
                 className="ask-assistant-bubble"
                 style={{
                  maxWidth: "min(92%, 48rem)",
                  minWidth: 0,
                  background: "var(--p-surface)",
                  border: "1px solid var(--p-border)",
                  borderRadius: 20,
                  borderTopLeftRadius: 8,
                  padding: "0.875rem 1.125rem",
                  fontSize: "0.9375rem",
                  lineHeight: 1.7,
                  color: "var(--p-text-1)",
                  boxShadow: "var(--p-shadow)",
                  transition: "border-color 150ms ease-out, box-shadow 150ms ease-out",
                }}
              >
                 <AssistantReply
                  result={m.result}
                  failed={m.failed}
                  stopped={m.stopped}
                  copied={copiedIndex === i}
                  onCopy={text => onCopy(text, i)}
                  onFollowUp={q => void ask(q)}
                   busy={loading}
                   onRetry={
                    m.failed || m.stopped
                      ? turnQuestion[i]
                        ? () => void ask(turnQuestion[i]!)
                        : undefined
                      : undefined
                  }
                />
              </div>
            </div>
          ),
        )}

        {loading && (
          <div className="ask-message ask-message-assistant" style={{ display: "flex", gap: "0.6rem" }}>
            <span style={AVATAR} aria-hidden>
              <Sparkles size={15} />
            </span>
            <div
               className="ask-assistant-bubble"
               style={{
                flex: 1,
                minWidth: 0,
                maxWidth: "min(92%, 48rem)",
                background: "var(--p-surface)",
                border: "1px solid var(--p-border)",
                borderRadius: 20,
                borderTopLeftRadius: 8,
                padding: "0.875rem 1.125rem",
                boxShadow: "var(--p-shadow)",
              }}
            >
              <ThinkingSkeleton />
            </div>
          </div>
        )}
      </div>

      {/* The scroll anchor. The transcript is part of the page, not a scroller
          of its own, so this is what the page follows when a new turn lands. */}
      <div ref={endRef} aria-hidden style={{ height: 1 }} />

      {/* The composer is fixed while docked, so it stops contributing height to
          the page. This is the room that keeps the last citation in a long
          answer from being left sitting underneath it. It belongs at the end of
          the column — clearance at the top would just open a gap where the
          composer used to be. */}
      {/* Reserves the docked bar's own height, measured rather than guessed. */}
      {docked && <div aria-hidden style={{ height: dockMetrics.height || undefined }} />}
      </main>

      <aside className="ask-research-sidebar" aria-label="Research guidance">
        <div className="ask-research-desktop"><ResearchGuidance /></div>
        <details className="ask-research-mobile">
          <summary>About archive answers</summary>
          <ResearchGuidance />
        </details>
      </aside>
    </div>
  );
}
