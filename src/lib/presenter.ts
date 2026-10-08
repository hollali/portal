/**
 * Pure sequencing logic for the archive presenter.
 *
 * The UI owns speech synthesis and card rendering; this module only decides
 * which part of an answer is being presented and what the reader may see.
 */

export type PresenterPhase = "idle" | "intro" | "presenting" | "limitations" | "done";

export interface PresenterInput {
  cardCount: number;
  limitationCount: number;
}

export interface PresenterState {
  phase: PresenterPhase;
  activeIndex: number | null;
  visibleCards: number[];
  spokenCharIndex: number;
  limitationIndex: number | null;
  paused: boolean;
  muted: boolean;
}

export type PresenterEvent =
  | { type: "START" }
  | { type: "SPEECH_BOUNDARY"; charIndex: number }
  | { type: "SPEECH_END" }
  | { type: "SKIP" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "REPLAY" }
  | { type: "SHOW_ALL" }
  | { type: "SET_MUTED"; muted: boolean };

const uniqueIndexes = (count: number) => Array.from({ length: Math.max(0, count) }, (_, index) => index);

function firstPhase(input: PresenterInput): PresenterPhase {
  if (input.cardCount > 0) return "intro";
  if (input.limitationCount > 0) return "limitations";
  return "done";
}

export function createPresenter(): PresenterState {
  return {
    phase: "idle",
    activeIndex: null,
    visibleCards: [],
    spokenCharIndex: 0,
    limitationIndex: null,
    paused: false,
    muted: false,
  };
}

function begin(input: PresenterInput, state: PresenterState): PresenterState {
  const phase = firstPhase(input);
  return {
    ...state,
    phase,
    activeIndex: phase === "presenting" ? 0 : null,
    limitationIndex: phase === "limitations" ? 0 : null,
    visibleCards: phase === "presenting" ? [0] : [],
    spokenCharIndex: 0,
  };
}

function afterCard(input: PresenterInput, state: PresenterState): PresenterState {
  const next = (state.activeIndex ?? -1) + 1;
  if (next < input.cardCount) {
    return {
      ...state,
      phase: "presenting",
      activeIndex: next,
      visibleCards: [...state.visibleCards, next],
      spokenCharIndex: 0,
    };
  }
  if (input.limitationCount > 0) {
    return {
      ...state,
      phase: "limitations",
      activeIndex: null,
      limitationIndex: 0,
      spokenCharIndex: 0,
    };
  }
  return { ...state, phase: "done", activeIndex: null, spokenCharIndex: 0 };
}

function afterLimitation(input: PresenterInput, state: PresenterState): PresenterState {
  const next = (state.limitationIndex ?? -1) + 1;
  if (next < input.limitationCount) {
    return { ...state, limitationIndex: next, spokenCharIndex: 0 };
  }
  return { ...state, phase: "done", limitationIndex: null, spokenCharIndex: 0 };
}

export function presenterReducer(
  input: PresenterInput,
  state: PresenterState,
  event: PresenterEvent,
): PresenterState {
  switch (event.type) {
    case "START":
      return state.phase === "idle" ? begin(input, state) : state;
    case "REPLAY":
      return begin(input, { ...createPresenter(), muted: state.muted });
    case "SPEECH_BOUNDARY":
      return state.phase === "idle" || state.phase === "done"
        ? state
        : { ...state, spokenCharIndex: Math.max(0, event.charIndex) };
    case "SPEECH_END":
      if (state.phase === "intro") {
        return input.cardCount > 0
          ? { ...state, phase: "presenting", activeIndex: 0, visibleCards: [0], spokenCharIndex: 0 }
          : afterLimitation(input, { ...state, phase: "limitations", limitationIndex: 0 });
      }
      if (state.phase === "presenting") return afterCard(input, state);
      if (state.phase === "limitations") return afterLimitation(input, state);
      return state;
    case "SKIP":
      if (state.phase === "intro") {
        return input.cardCount > 0
          ? { ...state, phase: "presenting", activeIndex: 0, visibleCards: [0], spokenCharIndex: 0 }
          : { ...state, phase: "done", limitationIndex: null };
      }
      if (state.phase === "presenting") return afterCard(input, state);
      if (state.phase === "limitations") return afterLimitation(input, state);
      return state;
    case "PAUSE":
      return { ...state, paused: true };
    case "RESUME":
      return { ...state, paused: false };
    case "SHOW_ALL":
      return {
        ...state,
        phase: "done",
        activeIndex: null,
        limitationIndex: null,
        visibleCards: uniqueIndexes(input.cardCount),
        spokenCharIndex: 0,
        paused: false,
      };
    case "SET_MUTED":
      return event.muted
        ? {
            ...state,
            muted: true,
            phase: "done",
            activeIndex: null,
            limitationIndex: null,
            visibleCards: uniqueIndexes(input.cardCount),
            spokenCharIndex: 0,
          }
        : { ...state, muted: false };
  }
}
