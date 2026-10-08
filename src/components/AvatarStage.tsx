"use client";

/**
 * The animated guide that presents /ask answers.
 *
 * A presenter, not an oracle. It shows and says what /api/ask already returned:
 * a pose while the archive is being searched, and a verbatim excerpt from a
 * stored record once an answer lands. It never answers a question in the
 * Speaker's voice, never speaks in the first person on its own authority, and
 * never reads generated text — the sentence it is given is built by
 * `buildSpeakText`, which has no access to `AskResult.reading`.
 *
 * Four things are load-bearing here and easy to break by accident:
 *
 * 1. The label is unconditional. A realistic likeness of a living public figure
 *    that talks to visitors can be mistaken for footage of him, so "Animated
 *    guide. This is not a recording of the Speaker." is rendered whatever state
 *    the component is in.
 * 2. The text answer and its citation cards are always present alongside it.
 *    The guide is optional, and muting it removes the voice, not the evidence.
 * 3. Speech never autoplays before a gesture. iOS will not speak without one,
 *    and a visitor who has not asked for sound should not get any.
 * 4. It falls back to captions alone. No WebGL, no speech engine, or a visitor
 *    who prefers reduced motion all get the same thing: the words, with nothing
 *    pretending to be a person.
 *
 * This file does not import three.js. Everything a visitor without WebGL sees —
 * the label, the captions, the voice, the controls — is here, and the scene is
 * fetched as its own chunk only after the WebGL probe has said yes.
 */

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2, Square, Volume2, VolumeX } from "lucide-react";
import {
  CAPTION_ATTRIBUTION,
  GUIDE_LABEL,
  GUIDE_LINES,
  GUIDE_STATUS,
  type CaptionSpeaker,
} from "@/lib/guideLines";
import { guideState, stateAllowsIdleMotion, type GuideState } from "@/lib/avatarState";

/**
 * The figure, in a chunk of its own.
 *
 * Loaded only once `glOk` is true, so a browser with no WebGL never fetches a
 * renderer. `ssr: false` because it reads `document` to find out how many pixels
 * it is allowed to shade.
 */
const GuideScene = dynamic(() => import("./GuideScene"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
      <Loader2 size={18} aria-hidden style={{ color: "var(--p-text-4)" }} />
    </div>
  ),
});

const PortraitAvatar = dynamic(() => import("./PortraitAvatar"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
      <Loader2 size={18} aria-hidden style={{ color: "var(--p-text-4)" }} />
    </div>
  ),
});

/** A missing or rejected photo must never turn the answer area into a crash. */
class PortraitErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // The captions remain the useful fallback; avoid surfacing asset details to visitors.
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: "1rem",
            textAlign: "center",
            color: "var(--p-text-4)",
            fontSize: "0.72rem",
          }}
        >
          Portrait unavailable. Captions remain available.
        </div>
      );
    }
    return this.props.children;
  }
}


export interface AvatarStageProps {
  /**
   * The verbatim line the guide may read, from `buildSpeakText`. Empty or absent
   * means it has nothing to say — which is the correct state for a record with
   * no quotable text, such as a photograph.
   */
  text?: string | null;
  /** The record the quote came from, shown in the caption and never spoken. */
  source?: { title: string; href?: string | null } | null;
  /**
   * What the page is doing, when the page owns it. The transcript lives in
   * AskConsole, so loading and composing are that component's state rather than
   * this one's.
   */
  context?: Parameters<typeof guideState>[0];
  /** Overrides the state derived from `context`. The page owns it so speech can report back. */
  state?: GuideState;
  /** The approved `.glb`. Omit it and the official photo portrait is shown instead. */
  modelUrl?: string | null;
  /**
   * Hides the figure entirely, keeping only the captions.
   *
   * Prefer `figureClassName` where the reason is a viewport rather than a
   * decision: this component must not branch on screen size, and the page that
   * does know the breakpoint can hide the figure with CSS without rendering a
   * second copy of this component that would mean a second WebGL context.
   */
  showFigure?: boolean;
  /**
   * Classes for the figure's box, so the page can place it with CSS — typically
   * `hidden md:block`. A figure hidden this way never mounts the scene chunk,
   * which is the point: a reader on a phone should not download a mesh.
   */
  figureClassName?: string;
  /** Overrides the WebGL probe. Tests pass `false` to exercise the fallback. */
  canRender3D?: boolean;
  /** Overrides the speech-engine probe. */
  canSpeak?: boolean;
  className?: string;
  onSpeakingChange?: (speaking: boolean) => void;
  /** Optional single presenter segment, used while cards are revealed in order. */
  presentationText?: string | null;
  presentationSpeaker?: CaptionSpeaker;
  onSpeechBoundary?: (charIndex: number) => void;
  onSpeechEnd?: () => void;
  onSpeechError?: () => void;
  presentationAction?: { type: "stop" | "pause" | "resume"; token: number };
}

/** Does this browser have a WebGL context we can draw into? */
export function webglAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return false;
    // Probing with a real context and keeping it would hold a GL context for the
    // lifetime of a component that may never draw anything.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Can this browser actually speak?
 *
 * Checks for the constructor as well as the engine. A `speechSynthesis` object
 * with no `SpeechSynthesisUtterance` to hand it is not a voice, and finding that
 * out inside the first `speak()` call means an exception in a click handler
 * rather than a caption the visitor can still read.
 */
export function speechAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    !!window.speechSynthesis &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

/**
 * One caption line: who is speaking, what they said, and where it came from.
 *
 * The attribution is part of the caption rather than a property of the scene
 * because it is the only thing that distinguishes the guide's own words from
 * the Speaker's. Both come out of the same neutral voice; only the caption says
 * which is which.
 */
interface CaptionLine {
  key: string;
  speaker: CaptionSpeaker;
  text: string;
  source?: string | null;
}

/**
 * Whether a box is on screen, so the figure is never mounted where nobody can
 * see it.
 *
 * CSS `display: none` is not enough. Hiding the figure on a phone is how this
 * page avoids paying for a mesh, but a hidden element still mounts — React does
 * not know it is invisible, and neither does react-three-fiber, so the canvas
 * gets created and a WebGL context with it. A box that is `display: none` has no
 * area, so it never intersects, and that is the signal used here.
 *
 * The same test does a second job: a reader who has not reached the guide does
 * not pay for it until they do.
 */
function useOnScreen(ref: React.RefObject<HTMLElement | null>, rootMargin = "300px"): boolean {
  // False wherever an observer exists, so a figure that is off screen or hidden
  // by CSS is never mounted on the first frame and then unmounted a moment
  // later. Environments with no observer at all (jsdom, old browsers) assume
  // visible, which is the safe direction to be wrong in.
  const [onScreen, setOnScreen] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    // No IntersectionObserver means no way to know, and a figure missing on a
    // browser that could have drawn one is the worse failure of the two.
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      entries => setOnScreen(entries.some(entry => entry.isIntersecting)),
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return onScreen;
}

/** A local English voice, so the guide does not read in a borrowed accent. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechAvailable() ? window.speechSynthesis.getVoices() : [];
  if (!voices.length) return null;
  return (
    voices.find(v => v.localService && /^en[-_]GB/i.test(v.lang)) ??
    voices.find(v => v.localService && /^en[-_]/i.test(v.lang)) ??
    voices.find(v => /^en/i.test(v.lang)) ??
    null
  );
}

/**
 * Drives `speechSynthesis` one segment at a time.
 *
 * Chained rather than concatenated, so the guide's introduction and the quote
 * are two separate utterances. Joining them into one string would put the
 * Speaker's words in the same breath as the guide's — the exact ambiguity the
 * labelling scheme exists to prevent — and it would leave nowhere to put the
 * pause before a quotation.
 *
 * `onPulse` reports a syllable starting, which is all the mouth needs.
 */
function useGuideSpeech({
  segments,
  canSpeak,
  onSpeakingChange,
  onPulse,
  onSpeechBoundary,
  onSpeechEnd,
  onSpeechError,
}: {
  segments: CaptionLine[];
  canSpeak: boolean;
  onSpeakingChange?: (speaking: boolean) => void;
  onPulse: (open: number) => void;
  onSpeechBoundary?: (charIndex: number) => void;
  onSpeechEnd?: () => void;
  onSpeechError?: () => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [cueIndex, setCueIndex] = useState(0);
  const [hasVoice, setHasVoice] = useState(() => (typeof window === "undefined" ? false : !!pickVoice()));
  const segmentsRef = useRef(segments);
  const cancelledRef = useRef(false);

  // Held in refs so `stop` and `play` stay referentially stable. An inline
  // callback from the parent would otherwise change identity on every render,
  // and the effect that decides whether to speak would then re-run every render
  // and cancel the utterance it had just started. The refs are refreshed in an
  // effect rather than during render, so they are never a side channel out of a
  // render that React might discard.
  const onSpeakingRef = useRef(onSpeakingChange);
  const onPulseRef = useRef(onPulse);
  const onBoundaryRef = useRef(onSpeechBoundary);
  const onEndRef = useRef(onSpeechEnd);
  const onErrorRef = useRef(onSpeechError);
  useEffect(() => {
    segmentsRef.current = segments;
    onSpeakingRef.current = onSpeakingChange;
    onPulseRef.current = onPulse;
    onBoundaryRef.current = onSpeechBoundary;
    onEndRef.current = onSpeechEnd;
    onErrorRef.current = onSpeechError;
  });

  const settle = useCallback(() => {
    setSpeaking(false);
    setCueIndex(0);
    onSpeakingRef.current?.(false);
    onPulseRef.current(0);
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    if (speechAvailable()) window.speechSynthesis.cancel();
    settle();
  }, [settle]);

  const pause = useCallback(() => {
    if (speechAvailable()) window.speechSynthesis.pause();
  }, []);

  const resume = useCallback(() => {
    if (speechAvailable()) window.speechSynthesis.resume();
  }, []);

  const play = useCallback(() => {
    if (!canSpeak || typeof window.SpeechSynthesisUtterance !== "function") return;
    // A paused engine is a resumed one, not a fresh read. Restarting would
    // replay the introduction the visitor already heard.
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setSpeaking(true);
      onSpeakingRef.current?.(true);
      return;
    }
    if (!segmentsRef.current.length) return;

    window.speechSynthesis.cancel();
    cancelledRef.current = false;
    setCueIndex(0);

    const speakFrom = (i: number) => {
      if (cancelledRef.current) return;
      if (i >= segmentsRef.current.length) {
        settle();
        return;
      }
      const segment = segmentsRef.current[i];
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = "en-GB";
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.onstart = () => {
        setSpeaking(true);
        setCueIndex(i);
        onSpeakingRef.current?.(true);
      };
       utterance.onboundary = event => {
         setCueIndex(i);
         onPulseRef.current(1);
         onBoundaryRef.current?.(event.charIndex);
       };
       utterance.onend = () => {
         if (cancelledRef.current) return;
         onEndRef.current?.();
         setCueIndex(i);
        // The beat before a quotation: long enough to register as a change of
        // speaker, short enough not to read as a stall.
        window.setTimeout(() => speakFrom(i + 1), segment.speaker === "guide" ? 420 : 0);
      };
      utterance.onerror = () => {
        if (cancelledRef.current) return;
        onErrorRef.current?.();
        settle();
      };
      window.speechSynthesis.speak(utterance);
    };

    speakFrom(0);
  }, [canSpeak, settle]);

  // Voice lists arrive asynchronously in most browsers, so `voiceschanged` is
  // the source of truth for `hasVoice`. The initial read is lazy rather than in
  // this effect because it does not need to wait for anything.
  useEffect(() => {
    if (!canSpeak) return;
    const synth = window.speechSynthesis;
    const onVoices = () => setHasVoice(!!pickVoice());
    synth.addEventListener("voiceschanged", onVoices);
    return () => synth.removeEventListener("voiceschanged", onVoices);
  }, [canSpeak]);

  useEffect(() => () => stop(), [stop]);

  return { speaking, cueIndex, hasVoice, play, stop, pause, resume };
}

/**
 * Mouth openness, kept in a ref rather than in state.
 *
 * It changes several times a second for as long as the guide is talking, and
 * routing that through React would re-render the canvas tree on every syllable
 * to move one blendshape. `useFrame` reads it directly instead.
 */
function useMouth(ref: React.MutableRefObject<number>, speaking: boolean) {
  const fallback = useRef<ReturnType<typeof setInterval> | null>(null);

  // Browsers that never fire `onboundary` — Safari among them — would otherwise
  // leave a talking guide with a shut mouth. This is the stand-in, and it only
  // runs while speech is actually in flight.
  useEffect(() => {
    if (!speaking) {
      if (fallback.current) clearInterval(fallback.current);
      fallback.current = null;
      return;
    }
    fallback.current = setInterval(() => {
      ref.current = ref.current > 0.05 ? Math.max(0, ref.current - 0.45) : 0.18 + Math.random() * 0.45;
    }, 110);
    return () => {
      if (fallback.current) clearInterval(fallback.current);
      fallback.current = null;
    };
  }, [ref, speaking]);
}

/**
 * Whether the visitor has interacted with the page yet.
 *
 * Browsers refuse to start speech before a gesture, and a guide that begins
 * talking the instant an answer lands on a phone it cannot yet speak from is
 * worse than one that waits for the tap that asked the question. Once this flips,
 * the guide may speak on its own.
 */
function useUnlocked(): boolean {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    const unlock = () => setUnlocked(true);
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);
  return unlocked;
}

/** The visitor's motion preference, as a live value. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/** Pauses the render loop while the tab is hidden. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}

export default function AvatarStage({
  text = null,
  source = null,
  context,
  state: controlledState,
  modelUrl = null,
  showFigure = true,
  figureClassName,
  canRender3D,
  canSpeak,
  className,
  onSpeakingChange,
  presentationText,
  presentationSpeaker = "speaker",
  onSpeechBoundary,
  onSpeechEnd,
  onSpeechError,
  presentationAction,
}: AvatarStageProps) {
  // Probed once, lazily. This component is only ever mounted on the client —
  // the page loads it with `ssr: false` — so `document` already exists by the
  // time a state initializer runs, and there is no reason to spend a render
  // discovering something that will not change: whether this browser can open a
  // WebGL context or reach a speech engine is a property of the device. The
  // `canRender3D` / `canSpeak` props exist so a caller (or a test) can force the
  // answer; changing one afterwards wants a remount, not a re-probe.
  const [{ glOk, voiceOk }] = useState(() => ({
    glOk: canRender3D ?? webglAvailable(),
    voiceOk: canSpeak ?? speechAvailable(),
  }));
  const hasModel = Boolean(modelUrl);

  const reducedMotion = usePrefersReducedMotion();
  const unlocked = useUnlocked();
  const pageVisible = usePageVisible();
  const mouthRef = useRef(0);
  const figureRef = useRef<HTMLDivElement>(null);
  const figureOnScreen = useOnScreen(figureRef);

  const derived = useMemo(() => guideState(context), [context]);
  const state = controlledState ?? derived;

  /**
   * What the guide has to say, as caption-sized segments.
   *
   * An answer with nothing quotable produces no quotation segment, which is what
   * makes the guide fall silent over a photograph instead of describing it.
   *
   * The quotation is present whenever there is one and the guide is not
   * currently reporting a gap or yielding to a recording — *not* only while it
   * is speaking. Captions are the whole experience for a visitor with no speech
   * engine, and on a rest state of "idle" they would otherwise show a greeting
   * while the actual quotation sat on the citation card unread.
   */
  const segments = useMemo<CaptionLine[]>(() => {
    if (presentationText !== undefined) {
      return presentationText
        ? [{ key: "presentation", speaker: presentationSpeaker, text: presentationText, source: source?.title ?? null }]
        : [];
    }
    const quoteable = state !== "thinking" && state !== "no-result" && state !== "media";
    if (text && quoteable) {
      return [
        { key: "intro", speaker: "guide", text: GUIDE_LINES.introducing },
        { key: "quote", speaker: "speaker", text, source: source?.title ?? null },
      ];
    }
    if (state === "thinking") return [{ key: "searching", speaker: "guide", text: GUIDE_LINES.searching }];
    if (state === "no-result") return [{ key: "noresult", speaker: "guide", text: GUIDE_LINES.noResult }];
    if (state === "media") return [{ key: "media", speaker: "guide", text: GUIDE_LINES.mediaNote }];
    if (state === "idle") return [{ key: "greeting", speaker: "guide", text: GUIDE_LINES.greeting }];
    return [];
  }, [presentationSpeaker, presentationText, state, text, source]);

  const speech = useGuideSpeech({
    segments,
    canSpeak: voiceOk,
    onSpeakingChange,
    onPulse: open => {
      mouthRef.current = open;
    },
    onSpeechBoundary,
    onSpeechEnd,
    onSpeechError,
  });
  useMouth(mouthRef, speech.speaking);

  // Speak only after the visitor has interacted, so no answer arrives talking at
  // somebody who has not touched the page.
  const speechText = presentationText !== undefined ? presentationText : text;
  const spokenRef = useRef<string | null>(null);
  const actionTokenRef = useRef(0);
  useEffect(() => {
    if (!presentationAction || presentationAction.token === actionTokenRef.current) return;
    actionTokenRef.current = presentationAction.token;
    if (presentationAction.type === "stop") {
      spokenRef.current = null;
      speech.stop();
    } else if (presentationAction.type === "pause") {
      speech.pause();
    } else {
      speech.resume();
    }
  }, [presentationAction, speech]);

  useEffect(() => {
    if (!voiceOk || !unlocked) return;
    if (state === "speaking" && speechText && spokenRef.current !== speechText) {
      spokenRef.current = speechText;
      speech.play();
      return;
    }
    // A new question supersedes the old answer mid-sentence, and silence beats
    // a quotation about the previous question read over the new one.
    if (state !== "speaking") {
      spokenRef.current = null;
      speech.stop();
    }
  }, [state, speechText, voiceOk, unlocked, speech]);

  const idleMotion = !reducedMotion && stateAllowsIdleMotion(state);
  const drawPortrait = showFigure && pageVisible;
  // All conditions must hold before a renderer or texture is fetched.
  const drawScene = drawPortrait && glOk && figureOnScreen;

  /**
   * What the caption shows right now.
   *
   * While the guide is talking this is the segment being spoken, so the caption
   * tracks the voice. Before it starts it is the *last* segment — the quotation
   * — because a caption resting on "Here is what the record says" tells a
   * visitor nothing about what is about to be read, and with no speech engine at
   * all it would be the only thing they ever see.
   */
  const active = speech.speaking
    ? segments[speech.cueIndex] ?? segments[0] ?? null
    : segments[segments.length - 1] ?? null;

  const canPlay = voiceOk && segments.length > 0;

  return (
    <section
      aria-label="Animated guide"
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
        padding: "0.8rem",
        background: "var(--p-surface)",
        border: "1px solid var(--p-border)",
        borderRadius: 18,
        boxShadow: "var(--p-shadow)",
        // Fill whatever the host gives us and never spill out of it. On a phone
        // the host is a fixed-height bar and this flexes to the room the
        // dismiss button leaves; the caption is the only part allowed to give
        // way, otherwise a long excerpt shoves the controls out of the card —
        // or worse, pushes the whole transcript down.
        flex: "1 1 auto",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {showFigure && (
        <div
           aria-hidden
           ref={figureRef}
           data-testid={!hasModel ? "guide-portrait" : undefined}
           className={figureClassName}
          style={{
            position: "relative",
            aspectRatio: "4 / 5",
            borderRadius: 12,
            overflow: "hidden",
            background:
              "radial-gradient(120% 80% at 50% 12%, color-mix(in srgb, var(--primary) 9%, transparent), transparent 70%), var(--p-surface-2)",
            border: "1px solid var(--p-border-2)",
          }}
        >
          {drawScene ? hasModel ? (
            <GuideScene modelUrl={modelUrl} state={state} mouthRef={mouthRef} idleMotion={idleMotion} />
          ) : (
            <PortraitErrorBoundary>
              <PortraitAvatar idleMotion={idleMotion} />
            </PortraitErrorBoundary>
          ) : drawPortrait ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: "var(--p-text-4)",
              }}
            >
              <Loader2 size={18} aria-hidden />
            </div>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.55rem",
                padding: "1rem",
                textAlign: "center",
              }}
            >
              <Loader2 size={18} style={{ color: "var(--p-text-4)" }} />
              <span style={{ fontSize: "0.72rem", lineHeight: 1.45, color: "var(--p-text-4)", maxWidth: "19rem" }}>
                The guide is paused while this tab is in the background.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Unconditional. Not a caption, not a tooltip, not dismissible — the one
          thing a visitor must never be able to miss. */}
      <p
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.4rem",
          margin: 0,
          fontSize: "0.7rem",
          lineHeight: 1.45,
          fontFamily: "var(--font-mono), monospace",
          color: "var(--p-text-3)",
          flexShrink: 0,
        }}
      >
        <VolumeX size={12} style={{ marginTop: "0.15rem", flexShrink: 0, color: "var(--primary)" }} />
        <span>{GUIDE_LABEL}</span>
      </p>

      {/* Captions travel with the voice and replace it entirely when there is no
          voice, so the guide is never decoration over silence. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          // No min height: inside a fixed-height rail this box has to be the
          // one that gives way, or the controls below it get pushed out of the
          // card. It scrolls instead, and an auto-height rail simply lets it
          // size to its content.
          minHeight: 0,
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.3rem",
          padding: "0.6rem 0.7rem",
          borderRadius: 12,
          background: "var(--p-surface-2)",
          border: "1px solid var(--p-border-2)",
          // Scrolling beats growing when the box has a fixed height. The full
          // excerpt is always one tap away in the citation card underneath, so
          // nothing is lost by showing the first of it.
          overflowY: "auto",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.62rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--primary)",
          }}
        >
          {active ? CAPTION_ATTRIBUTION[active.speaker] : "Guide"}
        </span>
        <span style={{ fontSize: "0.8125rem", lineHeight: 1.55, color: "var(--p-text-1)" }}>
          {active?.text ?? (state === "idle" ? GUIDE_LINES.greeting : GUIDE_STATUS[state])}
        </span>
        {active?.source && (
          <span style={{ fontSize: "0.7rem", color: "var(--p-text-4)" }}>
            From{" "}
            {source?.href ? (
              <a href={source.href}>{active.source}</a>
            ) : (
              active.source
            )}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", flexShrink: 0 }}>
        <button
          type="button"
          onClick={speech.speaking ? speech.stop : speech.play}
          disabled={!canPlay}
          aria-label={speech.speaking ? "Stop the guide" : "Read this aloud"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            minHeight: 44,
            padding: "0 0.8rem",
            borderRadius: 999,
            border: "1px solid var(--p-border-3)",
            background: "var(--p-surface-2)",
            color: "var(--p-text-2)",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: canPlay ? "pointer" : "not-allowed",
            opacity: canPlay ? 1 : 0.55,
          }}
        >
          {speech.speaking ? <Square size={12} aria-hidden /> : <Volume2 size={13} aria-hidden />}
          <span>{speech.speaking ? "Stop" : "Read aloud"}</span>
        </button>
        {/* Explains the voice choice. On a phone that sentence costs a whole
            line the caption needs, and the disabled button already says
            "no speech here" — so it only earns its place once there is room. */}
        <span className="max-sm:hidden" style={{ fontSize: "0.7rem", lineHeight: 1.4, color: "var(--p-text-4)" }}>
          {voiceOk === false
            ? "This browser has no speech engine, so the guide stays in captions."
            : speech.hasVoice
              ? GUIDE_STATUS[state]
              : "Read aloud uses this device's own voice."}
        </span>
      </div>
    </section>
  );
}
