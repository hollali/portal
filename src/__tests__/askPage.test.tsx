import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
