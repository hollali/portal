"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  FileText,
  Landmark,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { KIND_ICON } from "@/lib/kindIcon";
import { ASK_SUGGESTIONS, type AskResult } from "@/lib/askQuery";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  result?: AskResult;
  failed?: boolean;
}

const STORAGE_KEY = "askbagbin-chat-v1";
const MAX_PERSISTED = 40;

function loadHistory(): ChatMsg[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as ChatMsg[])
      .filter(
        (m): m is ChatMsg =>
          !!m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .slice(-MAX_PERSISTED);
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

function CitationCard({ citation }: { citation: AskResult["citations"][number] }) {
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
          {citation.title}
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
            {citation.excerpt}
          </span>
        )}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            marginTop: "0.6rem",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--primary)",
          }}
        >
          {citation.hasTranscript ? "Read the full transcript" : "Open in the archive"}
        </span>
      </Link>
    </li>
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
  copied,
}: {
  result?: AskResult;
  failed?: boolean;
  onRetry?: () => void;
  onCopy: (text: string) => void;
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
              minHeight: 36,
            }}
          >
            <RefreshCw size={14} aria-hidden /> Try again
          </button>
        )}
      </div>
    );
  }

  if (!result) return null;

  const copyText = [
    result.summary,
    ...result.citations.map(
      (c, i) => `${i + 1}. ${c.title}${c.year ? ` (${c.year})` : ""} — ${c.href}`,
    ),
  ].join("\n");

  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, color: "var(--p-text-1)" }}>{result.summary}</p>

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
              <CitationCard key={c.href} citation={c} />
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
                <span>{m.title}</span>
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
                “{t.quote}”
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
            padding: "0.35rem 0.75rem",
            color: "var(--p-text-3)",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
          {copied ? "Copied" : "Copy sources"}
        </button>
      </div>
    </div>
  );
}

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(ASK_SUGGESTIONS.slice(0, 3));
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Reading localStorage must happen after mount: the server has no access to
    // it, so doing this in a lazy initialiser would mismatch on hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(loadHistory());
    setHydrated(true);
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
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || loading) return;

      const userMsg: ChatMsg = { role: "user", content: text };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setCopiedIndex(null);
      setLoading(true);

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

        const result = (await res.json()) as AskResult;
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

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setCopiedIndex(null);
    setLoading(false);
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

  const lastUserQuestion = [...messages].reverse().find(m => m.role === "user")?.content;
  const emptyChat = hydrated && messages.length === 0;

  return (
    <div
      style={{
        background: "var(--p-bg)",
        color: "var(--p-text-1)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <PublicHeader />

      <section
        id="content"
        style={{
          position: "relative",
          overflow: "hidden",
          borderBottom: "1px solid var(--p-border)",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(color-mix(in srgb, var(--p-text-1) 7%, transparent) 1px, transparent 1.6px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(900px 500px at 50% 0%, black, transparent 78%)",
            WebkitMaskImage: "radial-gradient(900px 500px at 50% 0%, black, transparent 78%)",
          }}
        />
        <div
          style={{
            position: "relative",
            maxWidth: 1180,
            margin: "0 auto",
            padding: "clamp(3rem, 6vw, 4.5rem) 1.5rem",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.6875rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--primary)",
              border: "1px solid color-mix(in srgb, var(--primary) 40%, transparent)",
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
              padding: "0.375rem 0.75rem",
              borderRadius: 999,
            }}
          >
            <Sparkles size={12} aria-hidden /> AI assistant · preview
          </span>
          <h1
            style={{
              fontFamily: "var(--font-display), sans-serif",
              fontSize: "clamp(2.25rem, 5vw, 3.5rem)",
              letterSpacing: "-0.035em",
              lineHeight: 1.03,
              margin: "1rem 0 0.75rem",
              color: "var(--p-text-1)",
            }}
          >
            Ask <span className="p-serif">Bagbin Archive</span>
          </h1>
          <p
            style={{
              fontSize: "1rem",
              lineHeight: 1.6,
              color: "var(--p-text-2)",
              maxWidth: "38rem",
              margin: 0,
            }}
          >
            Question the library — every answer is drawn from the speeches, letters,
            papers, milestones and testimonials held in this archive.
          </p>
        </div>
      </section>

      <main
        style={{
          flex: 1,
          maxWidth: 860,
          margin: "0 auto",
          width: "100%",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 36,
            marginBottom: "0.5rem",
          }}
        >
          <span
            style={{
              fontSize: "0.8rem",
              color: "var(--p-text-4)",
              fontFamily: "var(--font-mono), monospace",
            }}
          >
            {messages.length === 0
              ? "No questions yet"
              : `${messages.length} message${messages.length === 1 ? "" : "s"} this session`}
          </span>
          {messages.length > 0 && (
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
                minHeight: 36,
              }}
            >
              <RotateCcw size={13} aria-hidden /> New conversation
            </button>
          )}
        </div>

        <div
          ref={scrollRef}
          role="log"
          aria-live="polite"
          aria-busy={loading}
          aria-label="Conversation with the archive"
          style={{
            flex: 1,
            overflowY: "auto",
            overscrollBehavior: "contain",
            display: "flex",
            flexDirection: "column",
            gap: "0.9rem",
            padding: "0.25rem 0.25rem 1rem",
            minHeight: 320,
            maxHeight: "min(56vh, 60dvh)",
          }}
        >
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
                Ask the library anything.
              </p>
              <p style={{ margin: 0, fontSize: "0.8rem" }}>
                Try a topic below, or type your own question.
              </p>
            </div>
          )}

          {!hydrated && messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--p-text-4)" }}>
              Restoring your last conversation…
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

        {emptyChat && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              padding: "0.5rem 0 1rem",
            }}
          >
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                style={{
                  fontSize: "0.78rem",
                  color: "var(--primary)",
                  background: "color-mix(in srgb, var(--primary) 9%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                  borderRadius: 999,
                  padding: "0.45rem 0.9rem",
                  cursor: "pointer",
                  minHeight: 36,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={e => {
            e.preventDefault();
            void ask(input);
          }}
          style={{
            display: "flex",
            gap: "0.6rem",
            borderTop: "1px solid var(--p-border)",
            paddingTop: "1rem",
          }}
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
            style={{
              flex: 1,
              minWidth: 0,
              background: "var(--p-surface)",
              border: "1px solid var(--p-border-3)",
              borderRadius: 999,
              padding: "0.75rem 1.2rem",
              minHeight: 46,
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
              width: 46,
              height: 46,
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

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.4rem",
            marginTop: "0.9rem",
            fontSize: "0.72rem",
            lineHeight: 1.5,
            color: "var(--p-text-4)",
          }}
        >
          <MessageSquare size={12} aria-hidden style={{ marginTop: "0.15rem", flexShrink: 0 }} />
          <span>
            Answers are keyword-matched against the live archive — each result links
            straight to the item it came from. Conversational reasoning is planned but
            not yet enabled.
          </span>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
