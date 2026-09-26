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
}

const STORAGE_KEY = "askbagbin-chat-v1";
const MAX_PERSISTED = 40;

/** Smallest comfortable target. Chips here were 36px, under the 44px guideline. */
const HIT = 44;

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
      // An assistant turn with no result and no failure flag renders nothing;
      // keeping it would leave an invisible gap in the transcript.
      const result = m.role === "assistant" ? normaliseResult(m.result) : undefined;
      if (m.role === "assistant" && !result && m.failed !== true) continue;
      messages.push({
        role: m.role,
        content: m.content,
        ...(result ? { result } : {}),
        ...(m.failed === true ? { failed: true } : {}),
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
          ? "color-mix(in srgb, #b45309 10%, transparent)"
          : "color-mix(in srgb, var(--primary) 8%, transparent)",
        border: `1px solid ${
          gap
            ? "color-mix(in srgb, #b45309 30%, transparent)"
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono), monospace",
        fontSize: "0.68rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--p-text-4)",
        margin: "1.1rem 0 0.5rem",
      }}
    >
      {children}
    </div>
  );
}

function AssistantReply({
  result,
  failed,
  onRetry,
  onCopy,
  onFollowUp,
  copied,
}: {
  result?: AskResult;
  failed?: boolean;
  onRetry?: () => void;
  onCopy: (text: string) => void;
  onFollowUp: (q: string) => void;
  copied: boolean;
}) {
  if (failed) {
    return (
      <div>
        <p style={{ margin: 0, color: "var(--p-text-2)" }}>
          The archive could not be reached. Nothing was lost — try again.
        </p>
        {onRetry && (
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
            <RefreshCw size={14} aria-hidden /> Try again
          </button>
        )}
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
      <p style={{ margin: 0, color: "var(--p-text-1)" }}>
        <Highlight text={result.summary} terms={result.matchedTerms} />
      </p>

      <div style={{ marginTop: "0.85rem" }}>
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
            {result.testimonials.map(t => (
              <blockquote
                key={t.author}
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
              <AskChip key={s} onClick={onFollowUp} label={s} />
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
          {copied ? "Copied" : "Copy sources"}
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
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
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
      if (!text || loading) return;

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

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text }),
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
        if (abortRef.current === controller) abortRef.current = null;
        setLoading(false);
      }
    },
    [loading],
  );

  useEffect(() => {
    // Reading localStorage must happen after mount: the server has no access to
    // it, so doing this in a lazy initialiser would mismatch on hydration.
    const restored = loadHistory();
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
    // `ask` is deliberately not a dependency: it changes with `loading`, and
    // re-running this would re-ask the shared question on every turn.
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

  const lastUserQuestion = [...messages].reverse().find(m => m.role === "user")?.content;
  const emptyChat = hydrated && messages.length === 0;

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
        maxWidth: 860,
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
              {linkCopied ? "Link copied" : "Copy link"}
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
          fast path to the next question. */}
      <form
        onSubmit={e => {
          e.preventDefault();
          void ask(input);
        }}
        style={{ display: "flex", gap: "0.6rem" }}
      >
        <label htmlFor="ask-question" className="sr-only">
          Ask a question about the archive
        </label>
        <input
          id="ask-question"
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about a speech, letter, theme or period…"
          disabled={loading}
          autoComplete="off"
          enterKeyHint="send"
          style={{
            flex: 1,
            minWidth: 0,
            background: "var(--p-surface)",
            border: "1px solid var(--p-border-3)",
            borderRadius: 999,
            padding: "0.75rem 1.2rem",
            minHeight: 48,
            color: "var(--p-text-1)",
            fontSize: "0.95rem",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Send question"
          style={{
            background: "var(--primary)",
            border: "none",
            color: "var(--primary-fg)",
            borderRadius: 999,
            width: 48,
            height: 48,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          <Send size={18} aria-hidden />
        </button>
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
                  maxWidth: "82%",
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
                  maxWidth: "88%",
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
                  copied={copiedIndex === i}
                  onCopy={text => onCopy(text, i)}
                  onFollowUp={q => void ask(q)}
                  onRetry={
                    m.failed && lastUserQuestion ? () => void ask(lastUserQuestion) : undefined
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
                background: "var(--p-surface)",
                border: "1px solid var(--p-border)",
                borderRadius: 18,
                borderTopLeftRadius: 6,
                padding: "0.9rem 1.1rem",
                fontSize: "0.9rem",
                color: "var(--p-text-3)",
              }}
            >
              Searching the archive…
            </div>
          </div>
        )}
      </div>

      {/* The scroll anchor. The transcript is part of the page, not a scroller
          of its own, so this is what the page follows when a new turn lands. */}
      <div ref={endRef} aria-hidden style={{ height: 1 }} />

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
          Answers are keyword-matched against the live archive — each result links
          straight to the item it came from, and each question gets a shareable
          link. Conversational reasoning is planned but not yet enabled.
        </span>
      </div>
      </main>
  );
}
