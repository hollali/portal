import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import AskConsole from '@/components/AskConsole'
import type { AskResult } from '@/lib/askQuery'


/**
 * The transparency layer only earns its keep if it actually reaches the reader.
 * A partial answer that renders exactly like a confident one is the failure
 * these tests exist to prevent.
 */

const FULL: AskResult = {
  summary: 'Closest match: “Digital Democracy and the Modern Parliament”.',
  terms: ['digitalisation', 'youth'],
  match: 'all',
  citations: [
    {
      kind: 'paper',
      kindLabel: 'Public Paper',
      collection: 'documents',
      collectionLabel: 'Archive documents',
      title: 'Digital Democracy and the Modern Parliament',
      href: '/archives/papers/digital-democracy',
      year: 2023,
      excerpt: 'Reflections on digital tools and the youth.',
      hasTranscript: true,
      matched: ['digitalisation'],
    },
  ],
  timeline: [],
  testimonials: [],
  collectionCounts: [{ collection: 'documents', label: 'Archive documents', count: 4 }],
  matchedTerms: ['digitalisation'],
  unmatched: [],
  totalMatched: 12,
  suggested: ['What has the archive on “Governance”?'],
}

const PARTIAL: AskResult = {
  ...FULL,
  match: 'any',
  matchedTerms: ['mining'],
  unmatched: ['cryptocurrency'],
  summary: 'No single item covers your whole question.',
}

const COMBINED: AskResult = {
  ...FULL,
  match: 'any',
  matchedTerms: ['digitalisation', 'youth'],
  unmatched: [],
}

const DEAD_END: AskResult = {
  ...FULL,
  match: 'none',
  terms: [],
  matchedTerms: [],
  citations: [],
  collectionCounts: [],
  totalMatched: 0,
}

let answer: AskResult = FULL

beforeEach(() => {
  window.localStorage.clear()
  // The page writes `?q=` into the address bar, so every test starts from /ask.
  window.history.replaceState(null, '', '/ask')
  answer = FULL
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => answer } as Response
      }
      return { ok: true, json: async () => ({ suggested: [] }) } as Response
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function ask(question: string, initialQuery: string | null = null) {
  render(<AskConsole initialQuery={initialQuery} />)
  const input = await screen.findByPlaceholderText(/Ask about a speech/i)
  fireEvent.change(input, { target: { value: question } })
  fireEvent.click(screen.getByLabelText('Send question'))
}

/** Every question the reader has actually sent, in order. */
function postedQuestions(): string[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(call => (call[1] as RequestInit | undefined)?.method === 'POST')
    .map(call => (JSON.parse(String((call[1] as RequestInit).body)).question as string))
}

/**
 * A POST that stays pending until released and rejects when aborted, the way a
 * real request does. Without the abort listener the mock keeps a superseded
 * request alive, and the test then passes for the wrong reason: the console
 * behaves the same whether or not the request it withdrew was ever cancelled.
 */
function deferredPosts(result: AskResult = FULL) {
  const pending: Array<() => void> = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ suggested: [] }) } as Response)
      }
      return new Promise<Response>((resolve, reject) => {
        const signal = init.signal as AbortSignal | undefined
        const cancel = () => reject(new DOMException('Aborted', 'AbortError'))
        if (signal?.aborted) return cancel()
        signal?.addEventListener('abort', cancel)
        pending.push(() => {
          signal?.removeEventListener('abort', cancel)
          resolve({ ok: true, json: async () => result } as Response)
        })
      })
    }),
  )
  return { all: () => pending.forEach(release => release()) }
}

describe('/ask answer transparency', () => {
  it('shows which terms were searched for', async () => {
    await ask('digitalisation youth')
    expect(await screen.findByText('searched for')).toBeInTheDocument()
    // A term appears in the readout and again on the citation it matched, so
    // this asserts both are present rather than that either is unique.
    expect(screen.getAllByText('digitalisation').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('youth')).toBeInTheDocument()
  })

  it('highlights where the matched term landed in the citation text', async () => {
    // The record says "digital", not "digitalisation" — it matched the query
    // term through its alias. The highlight has to follow the alias too, or the
    // "matched: digitalisation" chip is a claim the page cannot back up.
    await ask('digitalisation youth')
    const marks = await screen.findAllByText(/^digital/i, { selector: 'mark' })
    expect(marks.map(m => m.textContent)).toContain('Digital')
    expect(marks.map(m => m.textContent)).toContain('digital')
  })

  it('reports per-citation which terms it matched', async () => {
    await ask('digitalisation youth')
    expect(await screen.findByText('matched')).toBeInTheDocument()
  })

  it('does not claim partiality when every term was covered', async () => {
    await ask('digitalisation youth')
    await screen.findByText('searched for')
    expect(screen.queryByText(/Partial answer/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Combined answer/)).not.toBeInTheDocument()
  })

  it('warns that an answer is partial and names the uncovered term', async () => {
    answer = PARTIAL
    await ask('cryptocurrency mining')
    expect(await screen.findByText('Partial answer.')).toBeInTheDocument()
    expect(screen.getAllByText('cryptocurrency').length).toBeGreaterThan(0)
  })

  it('distinguishes a combined answer from a partial one', async () => {
    answer = COMBINED
    await ask('digitalisation youth')
    expect(await screen.findByText('Combined answer.')).toBeInTheDocument()
    expect(screen.queryByText('Partial answer.')).not.toBeInTheDocument()
  })

  it('admits when the response is only a sample of what matched', async () => {
    // 12 records matched but only 1 is rendered, so the reader is told 11 are
    // not on screen rather than being left to assume they saw everything.
    await ask('digitalisation youth')
    expect(await screen.findByText('11 more not shown')).toBeInTheDocument()
  })

  it('does not claim a sample when everything matched is shown', async () => {
    answer = { ...FULL, totalMatched: 1 }
    await ask('digitalisation youth')
    await screen.findByText('searched for')
    expect(screen.queryByText(/more not shown/)).not.toBeInTheDocument()
  })

  it('offers follow-up questions after an answer', async () => {
    await ask('digitalisation youth')
    expect(await screen.findByText('Ask next')).toBeInTheDocument()
    expect(screen.getByText('What has the archive on “Governance”?')).toBeInTheDocument()
  })

  it('points a dead end at the pages that answer it instead of advising a rephrase', async () => {
    answer = DEAD_END
    await ask('Who was he')
    expect(await screen.findByRole('link', { name: 'Who he is' })).toHaveAttribute(
      'href',
      '/the-man',
    )
    expect(screen.getByRole('link', { name: 'Life timeline' })).toBeInTheDocument()
    expect(screen.queryByText('Ask next')).not.toBeInTheDocument()
  })

  it('announces a short status rather than re-reading the whole answer', async () => {
    answer = PARTIAL
    await ask('cryptocurrency mining')
    const status = await screen.findByRole('status')
    await waitFor(() => expect(status).toHaveTextContent(/Partial answer/))
    expect(status).toHaveTextContent(/Nothing in the archive covers cryptocurrency/)
  })

  it('announces a successful search as found, not as a wall of prose', async () => {
    await ask('digitalisation youth')
    const status = await screen.findByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('Answer found. 1 source found.'))
  })
})

describe('/ask answers as links', () => {
  it('asks the question in a shared link without the reader retyping it', async () => {
    render(<AskConsole initialQuery="digitalisation youth" />)
    expect(await screen.findByText('digitalisation youth')).toBeInTheDocument()
    expect(await screen.findByText('searched for')).toBeInTheDocument()
  })

  it('mirrors the question asked into the address bar', async () => {
    await ask('digitalisation youth')
    await waitFor(() => expect(window.location.search).toBe('?q=digitalisation+youth'))
  })

  it('drops the question from the address bar on a new conversation', async () => {
    await ask('digitalisation youth')
    fireEvent.click(screen.getByRole('button', { name: /New conversation/ }))
    await waitFor(() => expect(window.location.search).toBe(''))
  })

  it('does not re-ask the question already at the top of a restored transcript', async () => {
    // Landing on a shared link for the conversation you were already in should
    // not append a duplicate turn, and must not spend another request doing it.
    window.localStorage.setItem(
      'askbagbin-chat-v1',
      JSON.stringify([
        { role: 'user', content: 'What did he say about the youth?' },
        { role: 'assistant', content: 'Closest match: something', result: FULL },
      ]),
    )
    render(<AskConsole initialQuery="What did he say about the youth?" />)
    await screen.findByText('searched for')
    expect(screen.getAllByText('What did he say about the youth?')).toHaveLength(1)
    const posts = vi
      .mocked(fetch)
      .mock.calls.filter(call => (call[1] as RequestInit | undefined)?.method === 'POST')
    expect(posts).toHaveLength(0)
  })

  it('offers the exhaustive result list when the answer is only the strongest few', async () => {
    // /ask caps what it shows, so the reader needs a way to the rest of the
    // matches rather than mistaking the cap for the whole archive.
    await ask('digitalisation youth')
    const link = await screen.findByRole('link', { name: /See every match in Search/ })
    expect(link).toHaveAttribute('href', '/search?q=digitalisation%20youth')
  })
})

/**
 * Six defects in the interaction layer, each of which makes the page look like it
 * is answering the reader when it is not.
 */
describe('/ask interaction defects', () => {
  it('leaves the question field a visible focus ring', async () => {
    // The site rings `*:focus-visible` in globals.css. An inline `outline` outranks
    // it, and this field carried `outline: "none"` — so the one control every
    // visitor has to use had no keyboard focus indicator at all. jsdom resolves
    // neither `:focus` nor `:focus-visible` in getComputedStyle, so the guard is
    // on the suppression itself, which is the thing that was wrong.
    await ask('digitalisation youth')
    const input = await screen.findByPlaceholderText(/Ask about a speech/i)
    expect(input.style.outline).not.toBe('none')
  })

  it('retries the question its own turn failed on', async () => {
    // Every failure carries a "Try again". Handing it the newest question in the
    // transcript meant asking A, failing, asking B and succeeding left A's retry
    // re-running B — a button beside one error that quietly asks a different one.
    let fail = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          if (fail) return { ok: false, status: 500 } as Response
          return { ok: true, json: async () => FULL } as Response
        }
        return { ok: true, json: async () => ({ suggested: [] }) } as Response
      }),
    )
    render(<AskConsole />)
    const input = await screen.findByPlaceholderText(/Ask about a speech/i)

    fireEvent.change(input, { target: { value: 'QUESTION-ONE' } })
    fireEvent.click(screen.getByLabelText('Send question'))
    await screen.findByText(/could not be reached/i)

    fail = false
    fireEvent.change(input, { target: { value: 'QUESTION-TWO' } })
    fireEvent.click(screen.getByLabelText('Send question'))
    await screen.findByText(/Closest match/)

    // Both turns still have a retry button; the old one has to ask its own
    // question, not the one above it.
    fireEvent.click(screen.getAllByRole('button', { name: /try again/i })[0])
    await waitFor(() =>
      expect(
        vi
          .mocked(fetch)
          .mock.calls.filter(call => (call[1] as RequestInit | undefined)?.method === 'POST')
          .map(call => (JSON.parse(String((call[1] as RequestInit).body)).question as string)),
      ).toEqual(['QUESTION-ONE', 'QUESTION-TWO', 'QUESTION-ONE']),
    )
  })

  it('sends a question typed while a search is still running', async () => {
    // The composer is deliberately left enabled mid-search so a follow-up can be
    // drafted. Enter used to be swallowed with no feedback at all, leaving the
    // reader with a typed question and no way to send it.
    const release = deferredPosts()
    render(<AskConsole />)
    const input = await screen.findByPlaceholderText(/Ask about a speech/i)

    fireEvent.change(input, { target: { value: 'first question' } })
    fireEvent.click(screen.getByLabelText('Send question'))
    await screen.findByLabelText('Stop searching')

    fireEvent.change(input, { target: { value: 'second question' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(postedQuestions()).toEqual(['first question', 'second question']))
    // The abandoned question leaves the transcript with its answer: a question
    // with nothing under it is the dangling state the stop turn exists to avoid.
    expect(screen.queryByText('first question')).not.toBeInTheDocument()

    release.all()
    expect(await screen.findByText(/Closest match/)).toBeInTheDocument()
    expect(screen.getByText('second question')).toBeInTheDocument()
  })

  it('keeps the composer in its searching state when the replaced request settles', async () => {
    // The superseded request finishing after its replacement must not report the
    // search as finished. That swaps the Stop button back to Send while the new
    // search is still running, so the reader is left with no way to stop it.
    const release = deferredPosts()
    render(<AskConsole />)
    const input = await screen.findByPlaceholderText(/Ask about a speech/i)

    fireEvent.change(input, { target: { value: 'first question' } })
    fireEvent.click(screen.getByLabelText('Send question'))
    await screen.findByLabelText('Stop searching')

    fireEvent.change(input, { target: { value: 'second question' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(postedQuestions()).toHaveLength(2))

    // The first request has now rejected with its AbortError, so its cleanup has
    // run. The search is still in flight and has to say so.
    await act(async () => {})
    expect(screen.getByLabelText('Stop searching')).toBeInTheDocument()

    release.all()
    await waitFor(() => expect(screen.queryByLabelText('Stop searching')).not.toBeInTheDocument())
    expect(await screen.findByText(/Closest match/)).toBeInTheDocument()
  })

  it('labels the sections of an answer as headings', async () => {
    // The answer is a document. With `div`s, a screen reader navigating by heading
    // found nothing inside it.
    await ask('digitalisation youth')
    expect(
      await screen.findByRole('heading', { name: /1 item in the archive/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /searched across the archive/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /ask next/i })).toBeInTheDocument()
  })

  it('announces a copy confirmation rather than only showing it', async () => {
    // "Copied" replacing "Copy sources" is a visual-only confirmation: nothing
    // tells a screen reader it happened, so the button looks unchanged in effect.
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
    await ask('digitalisation youth')
    const button = await screen.findByRole('button', { name: /Copy sources/ })
    expect(button.querySelector('[aria-live="polite"]')).toHaveTextContent('Copy sources')

    fireEvent.click(button)
    await waitFor(() =>
      expect(button.querySelector('[aria-live="polite"]')).toHaveTextContent('Copied'),
    )
  })

  it('renders two testimonials from one author without a key collision', async () => {
    // `rankCandidates` deliberately returns both quotes from an author who has
    // given two, so keying testimonials by author collided and left React
    // reconciling two siblings that claimed to be the same node.
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a) => {
      errors.push(String(a[0]));
    });
answer = {
      ...FULL,
      testimonials: [
        { quote: 'First quote from him.', author: 'Ama B', role: 'Member' },
        { quote: 'Second quote from her.', author: 'Ama B', role: 'Member' },
      ],
    }
    await ask('digitalisation youth')
    expect(await screen.findByText('First quote from him.')).toBeInTheDocument()
    expect(screen.getByText('Second quote from her.')).toBeInTheDocument()
    expect(errors.filter(e => /same key/i.test(e))).toHaveLength(0)
    spy.mockRestore();
  })
})

describe('/ask with a transcript saved by an older version', () => {
  /**
   * The crash this guards against: `loadHistory` only ever checked `role` and
   * `content`, so a result persisted before the current response shape existed
   * was restored verbatim and the renderer threw on the first missing field,
   * taking down the whole page for anyone with an older conversation saved.
   */
  const STALE = [
    { role: 'user', content: 'What did he say about the youth?' },
    {
      role: 'assistant',
      content: 'Closest match: something',
      result: {
        summary: 'Closest match: something',
        terms: ['youth'],
        match: 'all',
        citations: [
          {
            kind: 'speech',
            kindLabel: 'Speech',
            title: 'On the youth',
            href: '/archives/speeches/on-the-youth',
            year: 2019,
            excerpt: 'A word about youth.',
            hasTranscript: true,
            // no `matched`
          },
        ],
        timeline: [],
        testimonials: [],
        // no collectionCounts, matchedTerms, unmatched, totalMatched
      },
    },
  ]

  it('restores the transcript instead of throwing', async () => {
    window.localStorage.setItem('askbagbin-chat-v1', JSON.stringify(STALE))
    expect(() => render(<AskConsole />)).not.toThrow()
    expect(await screen.findByText('On the youth')).toBeInTheDocument()
  })

  it('still shows the terms the old shape did carry, without inventing the rest', async () => {
    window.localStorage.setItem('askbagbin-chat-v1', JSON.stringify(STALE))
    render(<AskConsole />)
    expect(await screen.findByText('On the youth')).toBeInTheDocument()

    // `terms` existed in the old response, so the readout is honest to show it.
    expect(screen.getByText('searched for')).toBeInTheDocument()
    // `collectionCounts` and per-citation `matched` did not, and nothing
    // fabricates them.
    expect(screen.queryByText('Searched across the archive')).not.toBeInTheDocument()
    expect(screen.queryByText('matched')).not.toBeInTheDocument()
    expect(screen.queryByText(/more not shown/)).not.toBeInTheDocument()
  })

  it('drops a corrupt transcript rather than rendering it', async () => {
    window.localStorage.setItem('askbagbin-chat-v1', 'not json at all')
    render(<AskConsole />)
    expect(await screen.findByPlaceholderText(/Ask about a speech/i)).toBeInTheDocument()
    expect(screen.queryByText('On the youth')).not.toBeInTheDocument()
  })
})
