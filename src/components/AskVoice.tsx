"use client";

/**
 * The voice half of /ask — a port of the desktop assistant's Voice page that
 * runs entirely in the browser instead of through a local Python service.
 *
 * Speech recognition uses the browser's Web Speech API (SpeechRecognition) and
 * answers are read aloud with speechSynthesis, both configured from the reader's
 * /ask preferences. Layout mirrors the reference: a ring visual with level bars,
 * a live transcription card, an answer card, and start / stop controls.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  AudioLines,
  CircleAlert,
  LoaderCircle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { AskPrefs } from "@/lib/askPrefs";

type VoiceStatus =
  | "unsupported"
  | "idle"
  | "listening"
  | "submitting"
  | "answered"
  | "speaking"
  | "error";

export interface AskVoiceHandle {
  /** The reader sent a question; `onResult` resolves the answer for this page. */
  ask: (
    question: string,
    options?: { onResult?: (result: unknown) => void; onError?: () => void },
  ) => Promise<void>;
  /** Open the chat transcript. */
  onBackToChat: () => void;
  notify: (message: string, opts?: { tone?: "success" | "error" | "info" }) => void;
  prefs: AskPrefs;
}

function speechRecognitionSupported() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

const LANGUAGE_OPTIONS = [
  "en-US",
  "en-GB",
  "en-AU",
  "en-NG",
  "fr-FR",
  "es-ES",
  "de-DE",
  "pt-BR",
] as const;

function subscribeNoop() {
  return () => {};
}

export default function AskVoice({ ask, onBackToChat, notify, prefs }: AskVoiceHandle) {
  // Feature detection is a client-side concern that must agree between the
  // server render and the first client render, so it comes from a store
  // instead of a state initializer or an effect.
  const recognitionSupported = useSyncExternalStore(
    subscribeNoop,
    () => speechRecognitionSupported(),
    () => false,
  );
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [lastAnswer, setLastAnswer] = useState("");
  const [error, setError] = useState("");

  // What we present to the reader: an unsupported browser cannot ever leave
  // the "unsupported" state no matter what the recognition state machine says.
  const view: VoiceStatus = recognitionSupported ? status : "unsupported";

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const sessionRef = useRef(0);
  const stoppedRef = useRef(false);
  const statusRef = useRef<VoiceStatus>("idle");
  const transcriptRef = useRef("");
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterim("");
    setError("");
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        notify("This browser cannot read the answer aloud.", { tone: "error" });
        return;
      }
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance(text);
      const voiceURI = prefsRef.current.ttsVoiceURI;
      if (voiceURI) {
        const match = window.speechSynthesis
          .getVoices()
          .find(voice => voice.voiceURI === voiceURI);
        if (match) utterance.voice = match;
      }
      utterance.lang = prefsRef.current.sttLang;
      utterance.rate = prefsRef.current.ttsRate;
      utterance.onstart = () => {
        if (statusRef.current === "answered" || statusRef.current === "speaking") {
          setStatus("speaking");
        }
      };
      utterance.onend = () => {
        if (statusRef.current === "speaking") setStatus("answered");
      };
      utterance.onerror = () => {
        if (statusRef.current === "speaking") setStatus("answered");
      };
      window.speechSynthesis.speak(utterance);
    },
    [stopSpeaking, notify],
  );

  const endRecognition = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) {
      try {
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.abort();
      } catch {
        /* already ended */
      }
    }
  }, []);

  const submit = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text) return;
      stopSpeaking();
      setStatus("submitting");
      try {
        await ask(text, {
          onResult: result => {
            const summary =
              result && typeof result === "object" && "summary" in result &&
              typeof (result as { summary?: unknown }).summary === "string"
                ? (result as { summary: string }).summary
                : "";
            setLastAnswer(summary);
            setStatus("answered");
            if (prefsRef.current.readAloud && summary) speak(summary);
          },
          onError: () => {
            setError("The archive could not be reached. The question is still in your chat — try again from there.");
            setStatus("error");
          },
        });
      } finally {
        // The transcript is consumed by the chat now; keep it on this page so
        // the reader can see what was said, but leave the mic free for the next
        // question.
        endRecognition();
      }
    },
    [ask, endRecognition, stopSpeaking, speak],
  );

  const start = useCallback(() => {
    if (!speechRecognitionSupported()) {
      setStatus("unsupported");
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus("unsupported");
      return;
    }
    if (recognitionRef.current) return;

    const session = ++sessionRef.current;
    stoppedRef.current = false;
    resetTranscript();
    statusRef.current = "idle";
    setStatus("idle");

    const rec = new SR();
    rec.lang = prefsRef.current.sttLang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (session !== sessionRef.current) return;
      statusRef.current = "listening";
      setStatus("listening");
    };
    rec.onresult = event => {
      if (session !== sessionRef.current) return;
      let final = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += piece;
        else interimText += piece;
      }
      if (final) setTranscript(final);
      setInterim(interimText);
    };
    rec.onerror = event => {
      if (session !== sessionRef.current) return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access is blocked. Allow the mic in the browser bar, or use the text box below.");
        statusRef.current = "error";
        setStatus("error");
      } else if (event.error === "no-speech") {
        setError("No speech was heard. Tap start and try again.");
        statusRef.current = "idle";
        setStatus("idle");
      } else if (event.error === "aborted") {
        // The reader ended the session — stay idle rather than reporting an error.
        statusRef.current = "idle";
        setStatus("idle");
      } else if (event.error === "network") {
        setError("The browser speech-recognition service could not be reached. Check your connection, or return to chat and type the question.");
        statusRef.current = "error";
        setStatus("error");
      } else if (event.error === "audio-capture") {
        setError("No microphone is available. Check your device connection and browser permissions.");
        statusRef.current = "error";
        setStatus("error");
      } else if (event.error === "language-not-supported") {
        setError(`This browser does not support ${prefsRef.current.sttLang || "the selected language"}. Change it in Settings or type the question.`);
        statusRef.current = "error";
        setStatus("error");
      } else {
        setError(`Voice recognition failed (${event.error}). Try again or use the text box.`);
        statusRef.current = "error";
        setStatus("error");
      }
    };
    rec.onend = () => {
      if (session !== sessionRef.current) return;
      if (recognitionRef.current === rec) recognitionRef.current = null;
      if (statusRef.current === "error") return;
      // Natural end with a finished question: submit it automatically. A stop
      // the reader asked for falls through to the `stoppedRef` guard below.
      if (!stoppedRef.current && transcriptRef.current.trim()) {
        void submit(transcriptRef.current);
        return;
      }
      statusRef.current = "idle";
      setStatus("idle");
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      recognitionRef.current = null;
      setError("Could not start browser voice recognition. Check microphone permission and use HTTPS or localhost.");
      statusRef.current = "error";
      setStatus("error");
    }
  }, [resetTranscript, submit]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    endRecognition();
  }, [endRecognition]);

  const askAnother = useCallback(() => {
    stopSpeaking();
    resetTranscript();
    setLastAnswer("");
    setStatus("idle");
    start();
  }, [start, resetTranscript, stopSpeaking]);

  const statusLabel: Record<VoiceStatus, string> = {
    unsupported: "Voice isn’t available here",
    idle: "Ready when you are",
    listening: "Listening",
    submitting: "Thinking through it",
    answered: "Answer ready",
    speaking: "Speaking",
    error: "The mic needs attention",
  };

  const description: Record<VoiceStatus, string> = {
    unsupported: "This browser has no speech recognition. Ask in the text box instead.",
    idle: "Tap start, then say a question about the archive.",
    listening: "Go ahead — say a question, then stop or tap “End session”.",
    submitting: "Your question is being searched against the archive’s records.",
    answered: lastAnswer ? "Read the answer aloud, ask another, or head back to the chat." : "The archive answered — see the chat for the full reply.",
    speaking: "The archive is reading its answer aloud.",
    error: error || "Restart the session to try again.",
  };

  const active = ["listening", "submitting", "speaking"].includes(view);

  return (
    <section className="ask-voice-page" aria-label="Voice session">
      <div className="ask-voice-top">
        <button type="button" className="ask-voice-back" onClick={onBackToChat}>
          <ArrowLeft size={15} aria-hidden /> Back to chat
        </button>
        <span
          className={`ask-voice-status ${view === "unsupported" ? "" : "connected"}`}
          aria-live="polite"
        >
          <i aria-hidden />
          {view === "unsupported" ? "Not supported here" : "Browser voice connected"}
        </span>
      </div>

      <div className="ask-voice-center">
        <div className={`ask-voice-visual ${active ? "active" : ""} state-${view}`} aria-hidden>
          <div className="ask-voice-ring ask-voice-ring-one" />
          <div className="ask-voice-ring ask-voice-ring-two" />
          <div className="ask-voice-ring ask-voice-ring-three" />
          <div className="ask-voice-disc">
            <AudioLines size={29} strokeWidth={1.6} />
          </div>
          <div className="ask-voice-levels">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${(i % 8) * 0.12}s` }} />
            ))}
          </div>
        </div>

        <span className="ask-eyebrow ask-voice-eyebrow">Voice session</span>
        <h1 className="ask-voice-title">{statusLabel[view]}</h1>
        <p className="ask-voice-description">{description[view]}</p>

        {(transcript || interim) && view !== "idle" && view !== "unsupported" && (
          <div className="ask-voice-card ask-voice-transcript">
            <span>Live transcription</span>
            <p>
              {transcript}
              {interim && <em>{interim}</em>}
            </p>
          </div>
        )}

        {lastAnswer && (view === "answered" || view === "speaking") && (
          <div className="ask-voice-card ask-voice-response">
            <span>Archive answer</span>
            <p>{lastAnswer}</p>
          </div>
        )}

        {error && (
          <div className="ask-voice-error" role="alert">
            <CircleAlert size={15} aria-hidden /> {error}
          </div>
        )}

        <div className="ask-voice-controls">
          {view === "idle" && (
            <button
              type="button"
              className="ask-voice-btn ask-voice-primary"
              onClick={start}
            >
              <Mic size={17} aria-hidden /> Start listening
            </button>
          )}
          {view === "error" && (
            <button
              type="button"
              className="ask-voice-btn ask-voice-primary"
              onClick={start}
            >
              <Mic size={17} aria-hidden /> Try again
            </button>
          )}
          {view === "listening" && (
            <>
              <button
                type="button"
                className="ask-voice-btn ask-voice-primary"
                onClick={stop}
              >
                <MicOff size={17} aria-hidden /> End session
              </button>
              <button
                type="button"
                className="ask-voice-btn ask-voice-secondary"
                onClick={() => void submit(transcript)}
                disabled={!transcript.trim()}
              >
                Ask what was said
              </button>
            </>
          )}
          {view === "submitting" && (
            <span className="ask-voice-busy">
              <LoaderCircle size={17} className="ask-voice-spin" aria-hidden />
              Searching the archive…
            </span>
          )}
          {view === "answered" && (
            <>
              <button
                type="button"
                className="ask-voice-btn ask-voice-primary"
                onClick={() => speak(lastAnswer)}
                disabled={!lastAnswer.trim()}
              >
                <Volume2 size={17} aria-hidden /> Read the answer aloud
              </button>
              <button
                type="button"
                className="ask-voice-btn ask-voice-secondary"
                onClick={askAnother}
              >
                <Mic size={17} aria-hidden /> Ask another
              </button>
            </>
          )}
          {view === "speaking" && (
            <button
              type="button"
              className="ask-voice-btn ask-voice-primary"
              onClick={stopSpeaking}
            >
              <VolumeX size={17} aria-hidden /> Stop speaking
            </button>
          )}
        </div>

        <p className="ask-voice-privacy">
          Speech recognition is handled by your browser. Voice mode sends a completed
          question to the archive automatically; composer dictation waits for Send.
        </p>

        {view === "unsupported" && (
          <p className="ask-voice-privacy">
            Supported in Chrome, Edge and Safari. Language: {prefs.sttLang || "en-US"}.
          </p>
        )}

        {LANGUAGE_OPTIONS.length > 0 && view === "listening" && (
          <p className="ask-voice-language">
            Listening in <strong>{prefs.sttLang || "en-US"}</strong> — change it in Settings.
          </p>
        )}
      </div>
    </section>
  );
}
