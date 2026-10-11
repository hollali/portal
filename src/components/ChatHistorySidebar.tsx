"use client";

import { useMemo, useState } from "react";
import { Button } from "./ui/Button";
import { Clock, MessageSquare, Pencil, Plus, Search, Trash2 } from "lucide-react";

export type PersistedMessage = {
  role: "user" | "assistant";
  content: string;
  ts?: number;
  result?: unknown;
  failed?: boolean;
  stopped?: boolean;
};

export type PersistedChat = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: PersistedMessage[];
};

const STORAGE_KEY = "askbagbin-chat-history-v1";
const LEGACY_KEY = "askbagbin-chat-v1";

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function deriveTitle(messages: PersistedMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  const text = (firstUser?.content || "").trim().replace(/\s+/g, " ");
  if (text.length === 0) return "New conversation";
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
}

function groupChats(chats: PersistedChat[]): Record<string, PersistedChat[]> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  return chats.reduce<Record<string, PersistedChat[]>>((groups, item) => {
    const day = new Date(item.updatedAt).toISOString().slice(0, 10);
    const group = day === today ? "Today" : day === yesterday ? "Yesterday" : "Earlier";
    (groups[group] ||= []).push(item);
    return groups;
  }, {});
}

export function loadAllChats(): PersistedChat[] {
  const migrated = migrateLegacy();
  if (migrated) return migrated;
  const parsed = safeParse<PersistedChat[]>(localStorage.getItem(STORAGE_KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((c) => c && Array.isArray(c.messages))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function migrateLegacy(): PersistedChat[] | null {
  const legacy = safeParse<PersistedMessage[]>(localStorage.getItem(LEGACY_KEY));
  if (!Array.isArray(legacy) || legacy.length === 0) return null;
  const now = Date.now();
  const chat: PersistedChat = {
    id: generateId(),
    title: deriveTitle(legacy),
    createdAt: now,
    updatedAt: now,
    messages: legacy,
  };
  const chats = [chat];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
  return chats;
}

export function saveAllChats(chats: PersistedChat[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, 50)));
  } catch {}
}

export function createNewChat(): PersistedChat {
  const now = Date.now();
  return {
    id: generateId(),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export type ChatHistorySidebarProps = {
  chats: PersistedChat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onRenameChat?: (chatId: string, title: string) => void;
  className?: string;
  mobile?: boolean;
  onCloseMobile?: () => void;
};

export default function ChatHistorySidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  className = "",
  mobile = false,
  onCloseMobile,
}: ChatHistorySidebarProps) {
  const [search, setSearch] = useState("");
  const sortedChats = useMemo(
    () => [...chats].sort((a, b) => b.updatedAt - a.updatedAt),
    [chats]
  );

  const visibleChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sortedChats;
    return sortedChats.filter(chat => {
      const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
      const haystack = `${chat.title} ${lastUser?.content ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [sortedChats, search]);

  const groupedChats = useMemo(() => groupChats(visibleChats), [visibleChats]);

  const handleSelect = (id: string) => {
    onSelectChat(id);
    if (mobile) onCloseMobile?.();
  };
  const handleNew = () => {
    onNewChat();
    if (mobile) onCloseMobile?.();
  };

  const handleRename = (chat: PersistedChat) => {
    if (typeof window === "undefined" || typeof window.prompt !== "function") return;
    const next = window.prompt("Conversation name", chat.title)?.trim();
    if (!next || next === chat.title) return;
    onRenameChat?.(chat.id, next);
  };

  const groupOrder = ["Today", "Yesterday", "Earlier"];

  return (
    <aside
      className={`flex h-full flex-col border border-white/10 rounded-xl bg-[color:color-mix(in_srgb,var(--p-surface),transparent_40%)] backdrop-blur transition-all ${className}`}
      aria-label="Chat history"
      style={{ width: mobile ? "min(85vw, 320px)" : undefined }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="flex w-full items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          style={{ height: 44, minHeight: 44, fontSize: "0.8125rem", gap: "0.4rem" }}
          onClick={handleNew}
        >
          <Plus size={16} aria-hidden="true" />
          <span>New chat</span>
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <label className="ask-history-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
          />
        </label>
        <ul className="flex flex-col gap-1">
          {groupOrder.map((group) => {
            const items = groupedChats[group];
            if (!items || items.length === 0) return null;
            return (
              <section key={group} className="ask-history-group">
                <span className="ask-history-date">{group}</span>
                {items.map((chat) => {
                  const active = chat.id === activeChatId;
                  const lastUser = [...chat.messages].reverse().find((m) => m.role === "user");
                  const preview = (lastUser?.content || chat.title || "New conversation").replace(/\s+/g, " ");
                  return (
                    <div key={chat.id} className="ask-history-row">
                      <button
                        type="button"
                        onClick={() => handleSelect(chat.id)}
                        className={`flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left focus-visible:outline-none transition-colors duration-150 rounded-lg px-2 py-1.5 ${
                          active ? "bg-white/15 ring-1 ring-inset ring-white/20" : "hover:bg-white/10"
                        }`}
                        aria-current={active ? "true" : undefined}
                      >
                        <div className="flex w-full items-center gap-2">
                          <MessageSquare size={14} className="shrink-0 opacity-70" aria-hidden="true" />
                          <span className="truncate text-sm font-medium">
                            {chat.title || "New conversation"}
                          </span>
                          <span className="ml-auto shrink-0 text-[10px] text-[color:var(--p-text-muted)]">
                            <Clock size={10} aria-hidden className="inline-block align-middle" />
                            {timeAgo(chat.updatedAt)}
                          </span>
                        </div>
                        {preview && (
                          <span className="pl-6 text-[11px] text-[color:var(--p-text-muted)] line-clamp-1">
                            {preview.length > 60 ? `${preview.slice(0, 60)}…` : preview}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRename(chat)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-md opacity-70 transition hover:bg-white/20 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
                        aria-label="Rename conversation"
                        title="Rename conversation"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(chat.id);
                        }}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-md opacity-70 transition hover:bg-white/20 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)]"
                        aria-label="Delete conversation"
                        title="Delete conversation"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </section>
            );
          })}
          {sortedChats.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-[color:var(--p-text-muted)]">
              <MessageSquare size={20} aria-hidden="true" className="opacity-60" />
              <span>No conversations yet</span>
              <span className="text-[11px] opacity-80">Start a new chat to begin</span>
            </li>
          )}
          {sortedChats.length > 0 && visibleChats.length === 0 && (
            <li className="flex flex-col items-center gap-2 px-3 py-8 text-center text-xs text-[color:var(--p-text-muted)]">
              <Search size={20} aria-hidden="true" className="opacity-60" />
              <span>No conversations match your search</span>
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}