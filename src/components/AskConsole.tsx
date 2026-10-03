"use client";

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
import { ASK_SUGGESTIONS, type AskResult } from "@/lib/askQuery";
import { highlightTerms } from "@/lib/askHighlight";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  result?: AskResult;
  failed?: boolean;
  /** The reader pressed stop, as opposed to the request failing. */
  stopped?: boolean;
}

const STORAGE_KEY = "askbagbin-chat-v1";
const MAX_PERSISTED = 40;

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
          }))
          .filter(c => c.href !== "")
      : [],
    timeline: Array.isArray(raw.timeline)
      ? raw.timeline
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .map(t => ({ year: typeof t.year === "string" ? t.year : null, title: str(t.title) }))
      : [],
    testimonials: Array.isArray(raw.testimonials)
      ? raw.testimonials
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .map(t => ({
            quote: str(t.quote),
            author: str(t.author),
            role: typeof t.role === "string" ? t.role : null,
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

function loadHistory(): ChatMsg[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const messages: ChatMsg[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const m = entry as Record<string, unknown>;
      if (m.role !== "user" && m.role !== "assistant") continue;
      if (typeof m.content !== "string") continue;
      // An assistant turn with no result and no terminal flag renders nothing;
      // keeping it would leave an invisible gap in the transcript.
      const result = m.role === "assistant" ? normaliseResult(m.result) : undefined;
      if (m.role === "assistant" && !result && m.failed !== true && m.stopped !== true) continue;
      messages.push({
        role: m.role,
        content: m.content,
        ...(result ? { result } : {}),
        ...(m.failed === true ? { failed: true } : {}),
        ...(m.stopped === true ? { stopped: true } : {}),
      });
    }
    return messages.slice(-MAX_PERSISTED);
  } catch {
    return [];
  }
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

const CHIP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  fontSize: "0.72rem",
  fontFamily: "var(--font-mono), monospace",
  borderRadius: 999,
  padding: "0.2rem 0.55rem",
  border: "1px solid var(--p-border-2)",
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
}: {
  citation: AskResult["citations"][number];
  allTerms: string[];
}) {
  const Icon = KIND_ICON[citation.kind] ?? FileText;
  return (
    <li>
      <Link
        href={citation.href}
        style={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          border: "1px solid var(--p-border)",
          background: "var(--p-surface-2)",
          borderRadius: 12,
          padding: "0.85rem 1rem",
          transition: "border-color 0.2s, transform 0.2s",
        }}
        className="p-card-lift"
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
          <Icon size={13} aria-hidden />
          {citation.kindLabel}
          {citation.year != null && (
            <span style={{ color: "var(--p-text-4)" }}>· {citation.year}</span>
          )}
        </span>
        <span
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
        </span>
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
            gap: "0.3rem",
            marginTop: "0.6rem",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--primary)",
          }}
        >
          {citation.hasTranscript ? "Read the full transcript" : "Open in the archive"}
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
      </Link>
    </li>
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
            {result.citations.map(c => (
              <CitationCard key={c.href} citation={c} allTerms={result.matchedTerms} />
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
                  <Highlight text={m.title} terms={result.matchedTerms} />
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
                  {t.author}
                  {t.role ? `, ${t.role}` : ""}
                </footer>
              </blockquote>
            ))}
          </div>
        </>
      )}

      {/* Where the answer came from, including what was left out. The response is
          capped at ten records, so a reader told "12 records matched" needs to
          know they are looking at a sample. */}
      {result.collectionCounts.length > 0 && (
        <>
          <SectionLabel>Searched across the archive</SectionLabel>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.35rem",
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
        </>
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

export default function AskConsole({ initialQuery = null }: { initialQuery?: string | null }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(ASK_SUGGESTIONS.slice(0, 3));
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
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
    // Reading localStorage must happen after mount: the server has no access to
    // it, so doing this in a lazy initialiser would mismatch on hydration.
    const restored = loadHistory();
    // Seed the transcript ref here rather than leaving it to the effect that
    // keeps it in sync. This effect calls `ask` below, and effects run in
    // declaration order, so that one has not happened yet — which would mean a
    // question arriving from a shared link could not resolve against the
    // conversation this reader already had open.
    messagesRef.current = restored;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(restored);
    setHydrated(true);

    // A shared link outranks a saved transcript: the URL is an explicit request
    // for that question. Re-asking the turn already at the top of the history
    // would only duplicate it.
    const pending = initialQuery?.trim();
    const lastAsked = [...restored].reverse().find(m => m.role === "user")?.content;
    if (pending && pending !== lastAsked) void ask(pending);

    bootedRef.current = true;
    // `ask` is deliberately not a dependency: re-running this would re-ask the
    // shared question on every turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (messages.length > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_PERSISTED)));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* storage unavailable — session-only is fine */
    }
  }, [messages, hydrated]);

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

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setCopiedIndex(null);
    setLinkCopied(false);
    setLoading(false);
    writeQueryParam(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    inputRef.current?.focus();
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

  return (
    <main
      style={{
        flex: 1,
        maxWidth: 1000,
        margin: "0 auto",
        width: "100%",
        padding: "1.25rem 1.5rem 2rem",
        display: "flex",
        flexDirection: "column",
      }}
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
              onClick={reset}
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
      <form
        ref={composerRef}
        onSubmit={e => {
          e.preventDefault();
          void ask(input);
        }}
        style={
          docked
            ? {
                position: "fixed",
                left: "50%",
                bottom: "max(0.7rem, env(safe-area-inset-bottom))",
                transform: "translateX(-50%)",
                width: "min(1000px, calc(100vw - 2rem))",
                zIndex: 45,
                display: "flex",
                alignItems: "flex-end",
                gap: "0.5rem",
                padding: "0.4rem",
                background: "color-mix(in srgb, var(--p-bg) 92%, transparent)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: "1px solid var(--p-border-3)",
                borderRadius: 24,
                boxShadow: "var(--p-shadow)",
              }
            : {
                display: "flex",
                alignItems: "flex-end",
                gap: "0.6rem",
                transition: "box-shadow 0.2s ease",
              }
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
            padding: "0.7rem 1.1rem",
            minHeight: 46,
            maxHeight: COMPOSER_MAX_H,
            color: "var(--p-text-1)",
            fontSize: "0.95rem",
            lineHeight: 1.5,
            fontFamily: "inherit",
            resize: "none",
            overflowY: "hidden",
          }}
        />
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
              width: 46,
              height: 46,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
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
              width: 46,
              height: 46,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: input.trim() ? "pointer" : "not-allowed",
              opacity: input.trim() ? 1 : 0.5,
              transition: "opacity 0.2s ease",
            }}
          >
            <Send size={18} aria-hidden />
          </button>
        )}
      </form>

      {emptyChat && (
        <div
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

        {emptyChat && (
          <div
            style={{
              textAlign: "center",
              padding: "2.5rem 1rem",
              border: "1px dashed var(--p-border)",
              borderRadius: 16,
              color: "var(--p-text-3)",
            }}
          >
            <Landmark
              size={26}
              aria-hidden
              style={{ color: "var(--primary)", margin: "0 auto 0.75rem", display: "block" }}
            />
            <p style={{ margin: "0 0 0.25rem", fontSize: "0.95rem" }}>
              Ask the library in plain language.
            </p>
            <p style={{ margin: 0, fontSize: "0.8rem" }}>
              Every answer links straight to the record it came from.
            </p>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  maxWidth: "min(82%, 32rem)",
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  borderRadius: 18,
                  borderBottomRightRadius: 6,
                  padding: "0.8rem 1.1rem",
                  fontSize: "0.925rem",
                  lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} style={{ display: "flex", gap: "0.6rem" }}>
              <span style={AVATAR} aria-hidden>
                <Sparkles size={15} />
              </span>
              <div
                style={{
                  maxWidth: "min(88%, 46rem)",
                  minWidth: 0,
                  background: "var(--p-surface)",
                  border: "1px solid var(--p-border)",
                  borderRadius: 18,
                  borderTopLeftRadius: 6,
                  padding: "0.9rem 1.1rem",
                  fontSize: "0.925rem",
                  lineHeight: 1.65,
                  color: "var(--p-text-1)",
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
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <span style={AVATAR} aria-hidden>
              <Sparkles size={15} />
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: "min(88%, 46rem)",
                background: "var(--p-surface)",
                border: "1px solid var(--p-border)",
                borderRadius: 18,
                borderTopLeftRadius: 6,
                padding: "0.9rem 1.1rem",
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
      {docked && <div aria-hidden style={{ height: 78 }} />}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.4rem",
          marginTop: "1.25rem",
          fontSize: "0.72rem",
          lineHeight: 1.5,
          color: "var(--p-text-4)",
        }}
      >
        <MessageSquare size={12} aria-hidden style={{ marginTop: "0.15rem", flexShrink: 0 }} />
        <span>
          This is <strong style={{ color: "var(--p-text-2)" }}>not the Speaker himself</strong>. It
          is a search of the published archive that answers in his voice: every passage in the
          first person is quoted word for word from a speech, paper, letter or interview held in
          this library, and links back to the record it came from. Nothing here is written by a
          model and nothing is paraphrased — where the archive is silent, it says so.
        </span>
      </div>
      </main>
  );
}
