"use client";

/**
 * Reader-facing /ask preferences, persisted in localStorage.
 *
 * This is the archive's stand-in for the desktop assistant's Settings page:
 * theme, voice input/output and a privacy reset live here, and the rest of the
 * page reads them through `loadPrefs` so the two halves cannot disagree. Only
 * things the page can actually change are offered — the /api/ask route takes no
 * options today, so there is deliberately no "which collections to search"
 * control.
 */

export interface AskPrefs {
  /** Mirrors the site-wide theme stored under `theme` by `ThemeToggle`. */
  theme: "dark" | "light";
  /** Speech recognition language, handed to the browser's SpeechRecognition. */
  sttLang: string;
  /** The browser TTS voice to read answers aloud; "" means the default. */
  ttsVoiceURI: string;
  ttsRate: number;
  /** Try to read a finished voice answer aloud automatically. */
  readAloud: boolean;
}

export const DEFAULT_PREFS: AskPrefs = {
  theme: "dark",
  sttLang: "en-US",
  ttsVoiceURI: "",
  ttsRate: 1,
  readAloud: true,
};

const STORAGE_KEY = "askbagbin-prefs-v1";

export function loadPrefs(): AskPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Seed the theme from the pre-paint value the boot script already chose,
      // so a first visit defaults to whatever the rest of the site used.
      const root = document.documentElement;
      return {
        ...DEFAULT_PREFS,
        theme: root.classList.contains("light") ? "light" : "dark",
      };
    }
    const parsed = JSON.parse(stored) as Partial<AskPrefs> | null;
    return { ...DEFAULT_PREFS, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: AskPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable — the session just works with in-memory prefs */
  }
}

/** Keep the site-wide theme in lockstep with the /ask preference. */
export function applyTheme(theme: AskPrefs["theme"]) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  try {
    window.localStorage.setItem("theme", theme);
  } catch {}
}