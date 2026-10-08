/**
 * Everything the animated guide says in its own voice, in one file.
 *
 * Two kinds of words leave the guide's mouth, and they must never be confused:
 *
 * 1. The lines below. Short, neutral, and about the guide itself — where it is
 *    looking, what it could not find. First person is allowed here because it is
 *    the *guide* speaking about *itself*, and the caption says so.
 * 2. Verbatim excerpts from stored records, built by `buildSpeakText`. The first
 *    person appears in those only because the Speaker said it, and the caption
 *    names the record it came from.
 *
 * Keeping this list separate from the component is deliberate: these are the
 * only sentences the Speaker's office has to approve by word, and they can be
 * reviewed, translated and replaced without touching a line of React.
 *
 * The guide never answers a question in the Speaker's voice. It introduces a
 * quotation and gets out of the way.
 */

/**
 * The standing notice. Required by the design principles: a realistic likeness
 * of a living public figure that talks to visitors can be mistaken for footage
 * of him, so the label is never conditional and never collapses.
 */
export const GUIDE_LABEL = 'Animated guide. This is not a recording of the Speaker.'

/**
 * The label for anything the archive itself did not write. Applied to
 * auto-transcripts of media once media playback ships, so a machine-made caption
 * can never be read as a published record.
 */
export const GENERATED_LABEL = 'Generated, may contain errors'

/** What the guide says, keyed by the state the visitor can see it in. */
export const GUIDE_LINES = {
  /** On load, before anything has been asked. */
  greeting: 'Welcome. Ask me about the archive.',

  /** A search is in flight. */
  searching: 'Let me look through the archive.',

  /** The visitor is in the composer. */
  listening: 'Take your time.',

  /** About to read an excerpt. Deliberately names the record, not the Speaker's mind. */
  introducing: 'Here is what the record says.',

  /** A search finished with nothing to show. */
  noResult: 'I could not find a record of that. Here is what I can show you.',

  /** A search failed or was stopped. */
  stopped: 'I stopped there. The archive is still here when you are ready.',

  /** A real recording is playing and the guide keeps quiet. */
  mediaNote: 'This is the actual recording, not the guide speaking.',
} as const

/** Neutral presenter lines for search limits, never written in the Speaker's voice. */
export function guideRestriction(label: string): string {
  return `The search was restricted to ${label}.`
}

export function guideDateRestriction(label: string): string {
  return `The search was restricted to records dated ${label}.`
}

export function guideExcludedCollections(labels: string[]): string {
  return `${labels.join(labels.length === 2 ? ' and ' : ', ')} ${labels.length === 1 ? 'carries' : 'carry'} no date, so ${labels.length === 1 ? 'it is' : 'they are'} left out of this window.`
}

export function guideUnmatchedTerms(terms: string[]): string {
  return `The archive has no published record covering ${terms.join(terms.length === 2 ? ' or ' : ', ')}.`
}

export function guideUnsearchableCollections(labels: string[]): string {
  return `${labels.join(labels.length === 2 ? ' and ' : ', ')} are held by the archive but are not searchable here.`
}

/**
 * The one short status shown beside the guide, per state.
 *
 * Separate from `GUIDE_LINES` because these are read out by screen readers on
 * every state change while the guide lines are only *spoken* when the visitor
 * asks for speech. Announcing "speaking" or "idle" tells a blind visitor nothing;
 * announcing "The guide is searching the archive" does.
 */
export const GUIDE_STATUS = {
  idle: 'The guide is waiting.',
  listening: 'The guide is listening.',
  thinking: 'The guide is searching the archive.',
  speaking: 'The guide is reading an excerpt from a record.',
  'no-result': 'The guide found no record for that question.',
  media: 'A recording is playing.',
} as const

export type GuideLine = (typeof GUIDE_LINES)[keyof typeof GUIDE_LINES]

/**
 * The label attached to a caption, so the reader can tell who is speaking.
 *
 * `guide` is the animated presenter; `speaker` is a verbatim excerpt from a
 * record, which is the only time his words are used, and only as a quotation.
 */
export type CaptionSpeaker = 'guide' | 'speaker'

export const CAPTION_ATTRIBUTION: Record<CaptionSpeaker, string> = {
  guide: 'Guide',
  speaker: 'The Speaker, quoted',
}

/**
 * The guide's own greeting, for the caption shown before speech is switched on.
 *
 * Kept as a function of nothing on purpose — the greeting must not be able to
 * interpolate a visitor's question, or a question containing a quote mark could
 * end up inside the guide's mouth rather than the visitor's.
 */
export function guideCaption(speaker: CaptionSpeaker): string {
  return CAPTION_ATTRIBUTION[speaker]
}
