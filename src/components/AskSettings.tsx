"use client";

/**
 * /ask settings — the archive's stand-in for the reference app's Preferences.
 *
 * Sections mirror the reference (appearance, search, voice, privacy) but only
 * expose what this page can actually change. Controls are native selects,
 * checkboxes-switches and buttons, kept large enough for touch from the start
 * rather than retro-fitted.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Headphones,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Sun,
  Trash2,
} from "lucide-react";
import type { AskPrefs } from "@/lib/askPrefs";

const STT_LANGUAGES = [
  "en-US",
  "en-GB",
  "en-AU",
  "en-NG",
  "fr-FR",
  "es-ES",
  "de-DE",
  "pt-BR",
] as const;

const RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;

export interface AskSettingsProps {
  prefs: AskPrefs;
  onPrefsChange: (next: AskPrefs) => void;
  onClearHistory: () => void;
  notify: (message: string, opts?: { tone?: "success" | "error" | "info" }) => void;
}

function subscribeNoop() {
  return () => {};
}

export default function AskSettings({
  prefs,
  onPrefsChange,
  onClearHistory,
}: AskSettingsProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  // `speechSynthesis` only exists in the browser, and the server render of this
  // client island must agree with the first client render — feature detection
  // therefore comes from a store rather than state set inside an effect.
  const ttsSupported = useSyncExternalStore(
    subscribeNoop,
    () => "speechSynthesis" in window,
    () => false,
  );

  useEffect(() => {
    if (!ttsSupported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    // The browser normally has the voice list ready by the time this runs, but
    // schedules it again in case the engine reports asynchronously.
    const pending = window.setTimeout(load, 0);
    synth.addEventListener("voiceschanged", load);
    return () => {
      window.clearTimeout(pending);
      synth.removeEventListener("voiceschanged", load);
    };
  }, [ttsSupported]);

  const update = (changes: Partial<AskPrefs>) => {
    onPrefsChange({ ...prefs, ...changes });
  };

  return (
    <section className="ask-settings-page" aria-label="Ask the archive settings">
      <header className="ask-screen-heading">
        <span className="ask-eyebrow">Preferences</span>
        <h1 className="ask-screen-title">Settings</h1>
        <p className="ask-screen-subtitle">Fine-tune how the archive works for you.</p>
      </header>

      <nav className="ask-settings-index" aria-label="Settings sections">
        <a href="#ask-settings-appearance">Appearance</a>
        <a href="#ask-settings-answers">Search &amp; answers</a>
        <a href="#ask-settings-voice">Voice</a>
        <a href="#ask-settings-privacy">Privacy</a>
      </nav>

      <div className="ask-settings-sections">
        <section id="ask-settings-appearance" className="ask-settings-section">
          <header className="ask-settings-section-heading">
            <span className="ask-settings-icon">
              <Sun size={17} aria-hidden />
            </span>
            <div>
              <h2>Appearance</h2>
              <p>Choose a comfortable look for reading the archive.</p>
            </div>
          </header>
          <div className="ask-settings-row">
            <div className="ask-settings-row-copy">
              <strong>Theme</strong>
              <span>Applies across the whole site, not just this page.</span>
            </div>
            <select
              className="ask-settings-control"
              aria-label="Theme"
              value={prefs.theme}
              onChange={event => update({ theme: event.target.value as AskPrefs["theme"] })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </section>

        <section id="ask-settings-answers" className="ask-settings-section">
          <header className="ask-settings-section-heading">
            <span className="ask-settings-icon">
              <Sparkles size={17} aria-hidden />
            </span>
            <div>
              <h2>Search &amp; answers</h2>
              <p>How every answer is drawn from the published records.</p>
            </div>
          </header>
          <div className="ask-settings-row">
            <div className="ask-settings-row-copy">
              <strong>What /ask searches</strong>
              <span>
                The archive&rsquo;s published speeches, letters, papers, milestones and
                testimonials — with news and media linked as sources.
              </span>
            </div>
            <span className="ask-settings-value">Published records</span>
          </div>
          <div className="ask-settings-row">
            <div className="ask-settings-row-copy">
              <strong>Photographs</strong>
              <span>Held and browsable, but uncaptioned and undated, so they are not searched.</span>
            </div>
            <span className="ask-settings-value">Browsable only</span>
          </div>
        </section>

        <section id="ask-settings-voice" className="ask-settings-section">
          <header className="ask-settings-section-heading">
            <span className="ask-settings-icon">
              <Headphones size={17} aria-hidden />
            </span>
            <div>
              <h2>Voice</h2>
              <p>Voice questions and read-aloud answers run in your browser.</p>
            </div>
          </header>
          <div className="ask-settings-row">
            <div className="ask-settings-row-copy">
              <strong>Speech recognition language</strong>
              <span>The browser listens in this language during a voice session.</span>
            </div>
            <select
              className="ask-settings-control"
              aria-label="Speech recognition language"
              value={prefs.sttLang}
              onChange={event => update({ sttLang: event.target.value })}
            >
              {STT_LANGUAGES.map(lang => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
          <div className="ask-settings-row">
            <div className="ask-settings-row-copy">
              <strong>Read answers aloud</strong>
              <span>After a voice question, speak the reply automatically.</span>
            </div>
            <label className="ask-setting-switch">
              <input
                type="checkbox"
                checked={prefs.readAloud}
                onChange={event => update({ readAloud: event.target.checked })}
              />
              <span aria-hidden />
              <span className="sr-only">Read answers aloud</span>
            </label>
          </div>
          <div className="ask-settings-row">
            <div className="ask-settings-row-copy">
              <strong>Reading voice</strong>
              <span>
                {ttsSupported
                  ? voices.length
                    ? "The browser voice used to read answers aloud."
                    : "This browser has no voices installed to choose from yet."
                  : "This browser cannot read answers aloud."}
              </span>
            </div>
            <select
              className="ask-settings-control"
              aria-label="Reading voice"
              disabled={!ttsSupported || voices.length === 0}
              value={prefs.ttsVoiceURI}
              onChange={event => update({ ttsVoiceURI: event.target.value })}
            >
              <option value="">Browser default</option>
              {voices.map(voice => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </div>
          <div className="ask-settings-row">
            <div className="ask-settings-row-copy">
              <strong>Speaking pace</strong>
              <span>How leisurely the read-aloud answer is.</span>
            </div>
            <select
              className="ask-settings-control"
              aria-label="Speaking pace"
              disabled={!ttsSupported}
              value={prefs.ttsRate}
              onChange={event => update({ ttsRate: Number(event.target.value) })}
            >
              {RATES.map(rate => (
                <option key={rate} value={rate}>
                  {rate === 1 ? "Normal (1×)" : `${rate}×`}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section id="ask-settings-privacy" className="ask-settings-section">
          <header className="ask-settings-section-heading">
            <span className="ask-settings-icon">
              <ShieldCheck size={17} aria-hidden />
            </span>
            <div>
              <h2>Privacy</h2>
              <p>Your conversations stay in this browser.</p>
            </div>
          </header>
          <div className="ask-settings-row">
            <div className="ask-settings-row-copy">
              <strong>Conversation storage</strong>
              <span>Saved in this browser&rsquo;s local storage under this site&rsquo;s domain.</span>
            </div>
            <span className="ask-settings-value">Local only</span>
          </div>
          <div className="ask-settings-row ask-settings-row-danger">
            <div className="ask-settings-row-copy">
              <strong>Delete all conversations</strong>
              <span>Removes every saved chat from this browser. This cannot be undone.</span>
            </div>
            <button
              type="button"
              className="ask-settings-danger"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm("Delete every conversation in this browser?")
                ) {
                  onClearHistory();
                }
              }}
            >
              <Trash2 size={14} aria-hidden /> Clear history
            </button>
          </div>
        </section>

        <p className="ask-settings-note">
          <SlidersHorizontal size={14} aria-hidden /> Preferences are saved in this browser
          and apply to the whole site ({prefs.theme} theme, voice included).
        </p>
      </div>
    </section>
  );
}