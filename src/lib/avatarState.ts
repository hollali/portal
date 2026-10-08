/**
 * The guide's state machine, as a pure function.
 *
 * The presentation on /ask is an animation and a voice, both of which are
 * trivially wrong to get subtly wrong: a guide that keeps talking over a real
 * recording, or one that shows the "thinking" pose after the answer has already
 * landed, tells the visitor the page is out of sync with its own answer. Putting
 * the precedence here — in one reviewable function with one test per branch —
 * is what keeps that from being a judgement call inside a render loop.
 *
 * Precedence runs from "must not be interrupted" down to "least interesting":
 *
 *   media    a real recording is playing, so the guide stops talking entirely
 *   speaking the guide is mid-sentence
 *   thinking a search is in flight
 *   no-result a search finished and there is nothing to show
 *   listening the visitor is in the composer
 *   idle     nothing is happening
 */
export type GuideState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'no-result' | 'media'

export interface GuideContext {
  /** The visitor has focus in the question field and has typed something. */
  composing?: boolean
  /** A request to /api/ask is in flight. */
  searching?: boolean
  /** The guide is speaking right now. */
  speaking?: boolean
  /** At least one search has finished, whatever it found. */
  searched?: boolean
  /** The last answer carried at least one citation. */
  hasResult?: boolean
  /** A real photo, video or audio recording is playing. */
  mediaPlaying?: boolean
}

/**
 * Which state the guide should be in, given what the page is doing.
 *
 * `speaking` outranks `searching` deliberately: a follow-up question can be
 * fired while the previous excerpt is still being read, and the visitor watching
 * a speaking avatar flip to a thinking pose mid-sentence reads that as the page
 * losing its place, not as a new question starting.
 */
export function guideState(ctx: GuideContext = {}): GuideState {
  if (ctx.mediaPlaying) return 'media'
  if (ctx.speaking) return 'speaking'
  if (ctx.searching) return 'thinking'
  // Only an answer that has actually come back empty counts as a dead end. On
  // first load nothing has been searched for, which is idle, not a failure the
  // guide should apologise for.
  if (ctx.searched && !ctx.hasResult) return 'no-result'
  if (ctx.composing) return 'listening'
  return 'idle'
}

/**
 * How animated the guide is allowed to be.
 *
 * Every state that moves returns `false`. A guide that drifts, blinks and tilts
 * while a real recording plays is competing with the thing the visitor asked to
 * see, and the visitor who prefers reduced motion did not ask for either.
 */
export function stateAllowsIdleMotion(state: GuideState): boolean {
  return state === 'idle' || state === 'listening'
}