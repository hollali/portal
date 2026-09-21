"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  RotateCcw,
  Landmark,
  Quote,
  MessageSquare,
} from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

interface AskResponse {
  reply: string;
  suggested: string[];
}

const STORAGE_KEY = "askbagbin-chat-v1";

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ChatMsg[];
          if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        }
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      if (messages.length > 0)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSuggested([]);
    setLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data: AskResponse | { error?: string } = await res
        .json()
        .catch(() => ({}));
      const reply =
        "error" in data && data.error
          ? `I could not answer that right now. ${data.error}`
          : (data as AskResponse).reply || "No answer returned.";
      const suggestions =
        "suggested" in data && Array.isArray((data as AskResponse).suggested)
          ? (data as AskResponse).suggested
          : [];
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (messages.length < 2) setSuggested(suggestions);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "The archive could not be reached. Please try again shortly.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setSuggested([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const bubble = (m: ChatMsg) =>
    m.role === "user" ? (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
          }}
        >
          {m.content}
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", gap: "0.6rem" }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            flexShrink: 0,
            background: "color-mix(in srgb, var(--primary) 14%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)",
          }}
        >
          <Sparkles size={15} />
        </span>
        <div
          style={{
            maxWidth: "82%",
            background: "var(--p-surface)",
            border: "1px solid var(--p-border)",
            borderRadius: 18,
            borderTopLeftRadius: 6,
            padding: "0.8rem 1.1rem",
            fontSize: "0.925rem",
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            color: "var(--p-text-1)",
          }}
        >
          {m.content}
        </div>
      </div>
    );

  const emptyChat = messages.length === 0;

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
        <div className="grid-bg" style={{ position: "absolute", inset: 0 }} />
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
              border:
                "1px solid color-mix(in srgb, var(--primary) 40%, transparent)",
              background: "color-mix(in srgb, var(--primary) 10%, transparent)",
              padding: "0.375rem 0.75rem",
              borderRadius: 999,
            }}
          >
            <Sparkles size={12} /> AI assistant · preview
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
            Ask Bagbin Archive
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
            Question the library &mdash; every answer is drawn from the
            speeches, letters, papers, milestones and testimonials held in this
            archive.
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
            marginBottom: "0.75rem",
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
          {!emptyChat && (
            <button
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
              }}
            >
              <RotateCcw size={13} /> New conversation
            </button>
          )}
        </div>

        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.9rem",
            padding: "0.25rem 0.25rem 1rem",
            minHeight: 320,
            maxHeight: "56vh",
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
                style={{
                  color: "var(--primary)",
                  margin: "0 auto 0.75rem",
                  display: "block",
                }}
              />
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.95rem" }}>
                Ask the library anything.
              </p>
              <p style={{ margin: 0, fontSize: "0.8rem" }}>
                Try a topic below, or type your own question.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i}>{bubble(m)}</div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background:
                    "color-mix(in srgb, var(--primary) 14%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary)",
                }}
              >
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

        {(suggested.length > 0 || emptyChat) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              padding: "0.5rem 0 1rem",
            }}
          >
            {(suggested.length > 0
              ? suggested
              : [
                  "What has the Speaker said about democracy?",
                  "Find the notice recalling Parliament",
                  "Speeches on education and the youth",
                ]
            ).map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                style={{
                  fontSize: "0.78rem",
                  color: "var(--primary)",
                  background:
                    "color-mix(in srgb, var(--primary) 9%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--primary) 35%, transparent)",
                  borderRadius: 999,
                  padding: "0.4rem 0.9rem",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          style={{
            display: "flex",
            gap: "0.6rem",
            borderTop: "1px solid var(--p-border)",
            paddingTop: "1rem",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              loading
                ? "Searching the archive…"
                : "Ask about a speech, letter, theme or period…"
            }
            disabled={loading}
            style={{
              flex: 1,
              background: "var(--p-surface)",
              border: "1px solid var(--p-border-3)",
              borderRadius: 999,
              padding: "0.75rem 1.2rem",
              color: "var(--p-text-1)",
              fontSize: "0.95rem",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              background: "var(--primary)",
              border: "none",
              color: "var(--primary-fg)",
              borderRadius: 999,
              width: 46,
              height: 46,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
          >
            <Send size={18} />
          </button>
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            marginTop: "0.9rem",
            fontSize: "0.72rem",
            color: "var(--p-text-4)",
          }}
        >
          <Quote size={12} /> <MessageSquare size={12} />
          <span>
            Answers are keyword-matched against the live archive. Conversational
            reasoning is planned but not yet enabled.
          </span>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
