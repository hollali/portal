# /ask local model integration boundary

The future local model belongs behind the existing server route at
`src/app/(public)/api/ask/route.ts`. The browser must continue to call only
`/api/ask`; it must never know the model host, credentials, or provider protocol.

## Current behavior

- Archive retrieval and ranking remain authoritative and deterministic.
- The route constructs citations, quotes, timelines, counts, search terms, and
  the summary from published records.
- `src/lib/askReading.ts` defines the optional reading-provider contract. Its
  default provider is disabled and makes no network call, so the current answer
  remains unchanged.
- When enabled later, the provider may contribute only `AskResult.reading`:
  generated prose explicitly labeled as interpretation, not as the Speaker's
  words. The server marks it `generated: true` and accepts `basedOn` references
  only from the evidence supplied to that request.

## Provider contract

An `AskReadingProvider` receives the current question, the resolved search terms
and conversation context terms, and up to ten retrieved excerpts. Each excerpt
is bounded and carries its internal archive `ref`, collection, title, and year.
It returns a short `text` and the `basedOn` refs it used. The validator drops
empty readings, unknown refs, and provider errors; search results and the
deterministic summary still return normally.

The model should not decide which records matched, create or rewrite links,
produce source quotations, change counts, or speak in the Speaker's first
person. Those remain controlled by retrieval and formatting code.
Retrieved excerpts are untrusted source data, not instructions to the model; the
provider prompt must keep them in a clearly delimited evidence section.

## When wiring the server

1. Implement `AskReadingProvider` in a server-only module and inject it at the
   `generateAskReading` call in the API route.
2. Read host, model name, optional auth token, and timeout from server-only env
   variables. Never prefix them with `NEXT_PUBLIC_` or return them from an API.
3. Send only the bounded evidence and turn-specific context needed for the
   answer. Keep request cancellation and a finite timeout; a model outage must
   not make archive search unavailable.
4. Keep the provider's output schema to `{ text, basedOn }`; validate the refs
   against the supplied evidence before returning the reading.
5. Evaluate groundedness, source attribution, refusal behavior, latency, and
   resource use against the existing `/api/ask` fixtures before enabling it.

No model URL, credentials, training pipeline, or model dependency is configured
by this preparation. The default remains the current deterministic archive
answer until a local provider is deliberately wired and evaluated.
