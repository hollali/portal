import { useEffect, useRef } from "react";
import type { GuideState } from "@/lib/avatarState";

/**
 * The guide's face, as a stylised 2.5D portrait.
 *
 * This is route C from `docs/avatar-sources.md`: a layered illustration, not a
 * reconstruction of a person. That is a deliberate choice, not a compromise for
 * want of an asset.
 *
 *   - It is drawn, so it cannot be mistaken for footage. The label under it —
 *     "Animated guide. This is not a recording of the Speaker." — stays true,
 *     which a photographic likeness would make false.
 *   - It belongs to nobody. Nothing here is derived from a photograph of a real
 *     person, so no likeness right, no office approval and no consent record is
 *     in play. The reference-image table stays empty on purpose.
 *   - It needs no WebGL, so a visitor on a phone or an old machine gets the same
 *     face as everyone else instead of the text-only fallback.
 *   - It is a few kilobytes of vector. The 3D route needs a model file that does
 *     not exist yet; this needs nothing.
 *
 * The 2.5D is three groups that slide by different amounts — backdrop, head,
 * near shoulder — so a small turn reads as depth rather than as a rotating
 * sprite. Mouth and lids are driven straight onto the DOM nodes from one rAF
 * loop: at nine updates a second, routing them through React state would
 * re-render the tree per syllable to move two paths.
 */

export interface GuidePortraitProps {
  state: GuideState;
  /**
   * Mouth openness, shared by reference with the component that owns the
   * captions. Same contract as the 3D scene, so the two are interchangeable.
   */
  mouthRef: React.MutableRefObject<number>;
  /** Suppresses idle motion for `prefers-reduced-motion`. */
  idleMotion: boolean;
}

/** Where the head leans per state, in the same units as the idle drift. */
const STATE_LEAN: Record<GuideState, number> = {
  idle: 0,
  listening: 0.3,
  thinking: -0.35,
  speaking: 0.12,
  "no-result": -0.18,
  media: 0,
};

/** Blink every 2–6s. A fixed cycle reads as a machine by the third pass. */
const BLINK_MIN = 2000;
const BLINK_MAX = 6000;
const BLINK_CLOSE = 110;
const BLINK_OPEN = 95;

export default function GuidePortrait({ state, mouthRef, idleMotion }: GuidePortraitProps) {
  const backRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const nearRef = useRef<SVGGElement>(null);
  const innerRef = useRef<SVGEllipseElement>(null);
  const lipRef = useRef<SVGPathElement>(null);
  const lidLeftRef = useRef<SVGGElement>(null);
  const lidRightRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const inner = innerRef.current;
    const lip = lipRef.current;
    const lidL = lidLeftRef.current;
    const lidR = lidRightRef.current;
    const back = backRef.current;
    const head = headRef.current;
    const near = nearRef.current;
    if (!inner || !lip || !lidL || !lidR || !back || !head || !near) return;

    let raf = 0;
    let mouth = 0;
    let blink = 0;
    let blinkStart = -1;
    let next = 0;

    const draw = (turn: number) => {
      // Three planes at different rates. The gap between them is the whole
      // illusion; at one rate it is a flat sticker.
      back.setAttribute("transform", `translate(${(turn * 2.6).toFixed(2)} 0)`);
      head.setAttribute(
        "transform",
        `translate(${(turn * 6.4).toFixed(2)} ${(Math.abs(turn) * -1.6).toFixed(2)}) rotate(${(turn * 2.2).toFixed(2)} 100 120)`,
      );
      near.setAttribute("transform", `translate(${(turn * 3.8).toFixed(2)} 0)`);
      inner.setAttribute("ry", Math.max(0.4, mouth * 7.4).toFixed(2));
      lip.setAttribute("transform", `translate(0 ${(mouth * 3.4).toFixed(2)})`);
      const lid = (-12 * (1 - blink)).toFixed(2);
      lidL.setAttribute("transform", `translate(0 ${lid})`);
      lidR.setAttribute("transform", `translate(0 ${lid})`);
    };

    // One frame, no loop: the resting pose still has to be painted, otherwise a
    // visitor who prefers reduced motion gets a face with no eyes and no mouth.
    const still = () => {
      mouth = mouthRef.current;
      draw(STATE_LEAN[state] ?? 0);
    };

    if (!idleMotion) {
      still();
      // The mouth still has to follow speech for a reduced-motion visitor:
      // silence-behind-a-talking-guide is a lie, and the captions are the point.
      const id = window.setInterval(() => {
        mouth += (mouthRef.current - mouth) * 0.4;
        draw(0);
      }, 90);
      return () => window.clearInterval(id);
    }

    let last = 0;
    const loop = (t: number) => {
      if (last && t - last > 400) next = 0; // a backgrounded tab should not eat the blink
      last = t;
      mouth += (mouthRef.current - mouth) * 0.35;

      if (!next) next = t + BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN);
      if (blinkStart < 0 && t >= next) blinkStart = t;
      if (blinkStart >= 0) {
        const into = t - blinkStart;
        if (into < BLINK_CLOSE) blink = into / BLINK_CLOSE;
        else if (into < BLINK_CLOSE + BLINK_OPEN) blink = 1 - (into - BLINK_CLOSE) / BLINK_OPEN;
        else {
          blink = 0;
          blinkStart = -1;
          next = 0;
        }
      }

      const drift =
        Math.sin(t / 2600) * 0.5 + Math.sin(t / 1100 + 1.3) * 0.22 + Math.sin(t / 4700) * 0.12;
      draw(Math.max(-1, Math.min(1, drift + (STATE_LEAN[state] ?? 0)) * 0.55));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [idleMotion, mouthRef, state]);

  return (
    <svg
      data-testid="guide-portrait"
      viewBox="0 0 200 240"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <clipPath id="gp-face">
          <path d="M100 58c24 0 42 18 42 48 0 26-14 50-42 62-28-12-42-36-42-62 0-30 18-48 42-48Z" />
        </clipPath>
        <linearGradient id="gp-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--p-text-1)" stopOpacity="0.86" />
          <stop offset="1" stopColor="var(--p-text-1)" stopOpacity="0.62" />
        </linearGradient>
      </defs>

      {/* Back plane */}
      <g ref={backRef}>
        <circle cx="100" cy="118" r="88" fill="var(--p-surface-2)" />
        <circle cx="100" cy="118" r="88" fill="none" stroke="var(--p-border-2)" strokeWidth="1.5" />
        <path
          d="M28 240c2-44 30-62 72-62s70 18 72 62Z"
          fill="color-mix(in srgb, var(--primary) 16%, var(--p-surface))"
        />
      </g>

      {/* Head */}
      <g ref={headRef}>
        <ellipse cx="55" cy="113" rx="6" ry="11" fill="var(--p-surface)" />
        <ellipse cx="145" cy="113" rx="6" ry="11" fill="var(--p-surface)" />

        <path
          d="M100 58c24 0 42 18 42 48 0 26-14 50-42 62-28-12-42-36-42-62 0-30 18-48 42-48Z"
          fill="var(--p-surface)"
          stroke="var(--p-border-3)"
          strokeWidth="1.5"
        />
        {/* One-sided shading is what keeps it reading as a drawing with a light
            source rather than a flat mask. */}
        <path
          d="M120 60c16 12 22 32 22 46 0 26-14 50-42 62 20-20 30-42 30-64 0-16-4-32-10-44Z"
          fill="var(--p-text-1)"
          opacity="0.07"
          clipPath="url(#gp-face)"
        />

        <path
          d="M56 104c-2-34 18-54 44-54s46 20 44 54c-4-12-12-20-22-22-10-2-26 4-38 4s-24-6-28 18Z"
          fill="url(#gp-hair)"
        />

        <path d="M74 99c6-4 17-4 23 0" fill="none" stroke="var(--p-text-1)" strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />
        <path d="M103 99c6-4 17-4 23 0" fill="none" stroke="var(--p-text-1)" strokeWidth="2.4" strokeLinecap="round" opacity="0.75" />

        <ellipse cx="85" cy="111" rx="9" ry="5" fill="var(--p-surface)" stroke="var(--p-text-1)" strokeWidth="1.4" opacity="0.95" />
        <circle cx="85" cy="111" r="3.1" fill="var(--p-text-1)" />
        <ellipse cx="115" cy="111" rx="9" ry="5" fill="var(--p-surface)" stroke="var(--p-text-1)" strokeWidth="1.4" opacity="0.95" />
        <circle cx="115" cy="111" r="3.1" fill="var(--p-text-1)" />

        <g ref={lidLeftRef}>
          <rect x="74" y="105" width="22" height="12" fill="var(--p-surface)" />
        </g>
        <g ref={lidRightRef}>
          <rect x="104" y="105" width="22" height="12" fill="var(--p-surface)" />
        </g>

        <path d="M96 124c2 6 6 6 8 0" fill="none" stroke="var(--p-text-1)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

        <ellipse ref={innerRef} cx="100" cy="153" rx="12" ry="0.4" fill="var(--p-text-1)" opacity="0.82" />
        <path d="M88 152c5-5 19-5 24 0" fill="none" stroke="var(--p-text-1)" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
        <path
          ref={lipRef}
          d="M88 152c5 6 19 6 24 0"
          fill="none"
          stroke="var(--p-text-1)"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>

      {/* Near plane */}
      <g ref={nearRef}>
        <path
          d="M28 240c2-44 30-62 72-62s70 18 72 62Z"
          fill="var(--primary)"
          opacity="0.14"
        />
        <path d="M100 240v-30" fill="none" stroke="var(--p-text-1)" strokeWidth="1.4" opacity="0.18" />
      </g>
    </svg>
  );
}