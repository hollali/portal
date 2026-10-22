# /ask local model integration boundary

The future local model belongs behind the existing server route at
`src/app/(public)/api/ask/route.ts`. The browser must continue to call only
`/api/ask`; it must never know the model host, credentials, or provider protocol.

## Current behavior

- The route is deterministic and makes no language-model call.
- Life, birth, education, career, political record, Speakership, rulings,
  personal history, timeline, values and international roles are composed by the
  person-knowledge layer from CMS and database rows. The loader is
  `src/lib/askProfile.ts`; the composition is `src/lib/askKnowledge.ts`.
- A question that asks for one fact is answered with that fact from the same
  rows (`FACT_PATTERNS` in `src/lib/askKnowledge.ts`); when the record does not
  hold the fact, the answer says so. This is pattern matching over stored data,
  not a model call.
- Archive retrieval and ranking remain authoritative for questions about what he
  said or wrote.
- Reader-supplied links are fetched by `/api/ask/link` with SSRF protections and
  returned as marked excerpts; there is no web search.
- The route constructs citations, quotes, timelines, counts, search terms,
  inline media, and the summary from published records.
- `src/lib/askReading.ts` defines the optional reading-provider contract. Its
  default provider is disabled and makes no network call, so the current answer
  remains unchanged.
- When enabled later, the provider may contribute only `AskResult.reading`:
  generated prose explicitly labeled as interpretation, not as the Speaker's
  words. The server marks it `generated: true` and accepts `basedOn` references
  only from the evidence supplied to that request.
- Voice input and read-aloud remain browser features. Read-aloud uses
  `speechSynthesis`; no cloned voice or speech-synthesis provider is configured.

## Provider contract

An `AskReadingProvider` receives the current question, the resolved search terms
and conversation context terms, and up to ten retrieved excerpts. Each excerpt
is bounded and carries its internal archive `ref`, collection, title, and year.
It returns a short `text` and the `basedOn` refs it used. The validator drops
empty readings, unknown refs, and provider errors; search results and the
deterministic summary still return normally.

The model should not decide which records matched, answer person-knowledge
questions from its own memory, create or rewrite links, produce source
quotations, change counts, or speak in the Speaker's first person. Those remain
controlled by the database loader, retrieval and formatting code.
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
6. Do not use the model to clone or imitate the Speaker's voice. Voice output is
   a separate consent-gated feature and is not part of this integration.

No model URL, credentials, training pipeline, or model dependency is configured
by this preparation. The default remains the current deterministic archive
answer until a local provider is deliberately wired and evaluated.
