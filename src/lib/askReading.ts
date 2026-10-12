import type { AskReading } from '@/lib/askQuery'

/** A bounded, retrieved source excerpt available to a future answer model. */
export interface AskReadingEvidence {
  /** Stable source reference; currently the internal archive href. */
  ref: string
  collection: string
  title: string
  year: number | null
  passage: string
}

/** Only turn-specific context is sent; the client transcript is never forwarded. */
export interface AskReadingInput {
  question: string
  searchTerms: string[]
  contextTerms: string[]
  evidence: AskReadingEvidence[]
}

/** Provider output deliberately omits `generated`; the server adds that marker. */
export interface AskReadingDraft {
  text: string
  basedOn: string[]
}

/**
 * Server-only extension point for an interpretive reading of retrieved evidence.
 * Implementations must return references from `input.evidence` and honor abort.
 */
export interface AskReadingProvider {
  generate(
    input: AskReadingInput,
    options?: { signal?: AbortSignal },
  ): Promise<AskReadingDraft | null>
}

const MAX_READING_LENGTH = 2400
const MAX_EVIDENCE = 10

/**
 * Safe default until a local provider is configured: no generation, no network
 * call, and no change to the existing deterministic answer.
 */
export const noAskReadingProvider: AskReadingProvider = {
  async generate() {
    return null
  },
}

/**
 * Run an optional provider and validate the generated reading against the
 * sources actually supplied. Provider failures never take down archive search.
 */
export async function generateAskReading(
  input: AskReadingInput,
  provider: AskReadingProvider = noAskReadingProvider,
  options?: { signal?: AbortSignal },
): Promise<AskReading | undefined> {
  const seenRefs = new Set<string>()
  const evidence = input.evidence.filter(item => {
    if (
      !item.ref.startsWith('/') ||
      item.ref.startsWith('//') ||
      !item.passage.trim() ||
      seenRefs.has(item.ref)
    ) return false
    seenRefs.add(item.ref)
    return true
  }).slice(0, MAX_EVIDENCE)
  if (evidence.length === 0 || options?.signal?.aborted) return undefined

  try {
    const draft = await provider.generate({ ...input, evidence }, options)
    if (!draft || typeof draft.text !== 'string' || !Array.isArray(draft.basedOn)) {
      return undefined
    }

    const text = draft.text.trim().slice(0, MAX_READING_LENGTH)
    const availableRefs = new Set(evidence.map(item => item.ref))
    const basedOn = [...new Set(draft.basedOn.filter(
      (ref): ref is string => typeof ref === 'string' && availableRefs.has(ref),
    ))]

    // An interpretation without a traceable source is not safe to present.
    if (!text || basedOn.length === 0) return undefined

    return { text, generated: true, basedOn }
  } catch {
    // The curated, deterministic summary and citation cards remain usable if a
    // future model is unavailable, times out, or rejects its response.
    return undefined
  }
}
