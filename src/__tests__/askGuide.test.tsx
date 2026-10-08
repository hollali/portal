import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AskConsole from '@/components/AskConsole'
import { GUIDE_LABEL, GUIDE_LINES } from '@/lib/guideLines'
import { buildSpeakText } from '@/lib/speakText'
import type { AskCitation, AskResult } from '@/lib/askQuery'

/**
 * The guide on /ask, from the page's side.
 *
 * What matters here is not the animation but the promises the page makes around
 * it: it is off unless something asked for it, it says what it is, it reads only
 * what a stored record says, and a reader can send it away without losing
 * anything.
 */

const CITATION: AskCitation = {
  kind: 'document',
  kindLabel: 'Speech',
  collection: 'documents',
  collectionLabel: 'Speeches',
  title: 'Address on the state of the nation',
  href: '/archives/documents/state-of-the-nation',
  year: 2021,
  excerpt: 'The budget is not a statement of what we intend to do.',
  hasTranscript: true,
  matched: ['budget'],
}

const ANSWER: AskResult = {
  summary: 'Closest match: “Address on the state of the nation”.',
  terms: ['budget'],
  match: 'all',
  citations: [CITATION],
  timeline: [],
  testimonials: [],
  collectionCounts: [{ collection: 'documents', label: 'Speeches', count: 1 }],
  matchedTerms: ['budget'],
  unmatched: [],
  totalMatched: 1,
  suggested: [],
}

let answer: AskResult = ANSWER

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/ask')
  answer = ANSWER
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: true, json: async () => answer } as Response
      return { ok: true, json: async () => ({ suggested: [] }) } as Response
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function ask(question: string) {
  fireEvent.change(await screen.findByPlaceholderText(/Ask about a speech/i), {
    target: { value: question },
  })
  fireEvent.click(screen.getByLabelText('Send question'))
}

describe('the guide is opt-in on the page', () => {
  it('is absent unless the server asked for it', async () => {
    render(<AskConsole />)
    await screen.findByPlaceholderText(/Ask about a speech/i)
    expect(screen.queryByText(GUIDE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /show the guide/i })).not.toBeInTheDocument()
  })

  it('shows the answer in full with no guide at all', async () => {
    render(<AskConsole />)
    await ask('budget')
    expect(await screen.findByText('searched for')).toBeInTheDocument()
    expect(screen.getAllByText(/Address on the state of the nation/).length).toBeGreaterThan(0)
  })
})

describe('the guide presents what the answer already says', () => {
  it('carries the label before anything has been asked', async () => {
    render(<AskConsole guide />)
    expect(await screen.findByText(GUIDE_LABEL)).toBeInTheDocument()
  })

  it('reads the top citation, word for word', async () => {
    render(<AskConsole guide />)
    await ask('budget')
    // The caption is the quote, attributed to the Speaker and linked to the record.
    expect(await screen.findByText('The Speaker, quoted')).toBeInTheDocument()
    expect(screen.getByText(buildSpeakText(CITATION))).toBeInTheDocument()
    // The guide's caption links to the same record the citation card does. Two
    // links to one record is the point: the guide is a route to the evidence,
    // not a substitute for it.
    const links = screen.getAllByRole('link', { name: CITATION.title })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute('href', CITATION.href)
  })

  it('says nothing to read when the answer is a dead end', async () => {
    answer = { ...ANSWER, citations: [], match: 'none', totalMatched: 0 }
    render(<AskConsole guide />)
    await ask('budget')
    expect(await screen.findByText(GUIDE_LINES.noResult)).toBeInTheDocument()
    // It explains the gap rather than borrowing a quote from another question.
    expect(screen.queryByText('The Speaker, quoted')).not.toBeInTheDocument()
  })

  it('says nothing to read when the top record is a photograph', async () => {
    answer = {
      ...ANSWER,
      citations: [{ ...CITATION, kindLabel: 'Photograph', excerpt: null }],
    }
    render(<AskConsole guide />)
    await ask('budget')
    await waitFor(() => expect(screen.getByText(GUIDE_LINES.greeting)).toBeInTheDocument())
    // Nothing is invented to fill the silence.
    expect(screen.queryByText('The Speaker, quoted')).not.toBeInTheDocument()
  })

  it('shows no photograph by default, but keeps the label and captions', async () => {
    // The likeness is off until the Speaker's office approves it. The guide still
    // speaks its captions and presents excerpts; only the face is withheld.
    render(<AskConsole guide />)
    expect(await screen.findByText(GUIDE_LABEL)).toBeInTheDocument()
    expect(screen.getByText(GUIDE_LINES.greeting)).toBeInTheDocument()
    expect(screen.queryByTestId('guide-portrait')).not.toBeInTheDocument()
  })

  it('shows the photograph only when the portrait is approved', async () => {
    render(<AskConsole guide portrait />)
    expect(await screen.findByTestId('guide-portrait')).toBeInTheDocument()
    expect(screen.getByText(GUIDE_LABEL)).toBeInTheDocument()
  })
})

describe('a reader can send the guide away without losing the answer', () => {
  it('removes it and remembers that it did', async () => {
    render(<AskConsole guide />)
    await screen.findByText(GUIDE_LABEL)
    fireEvent.click(screen.getByRole('button', { name: /hide the guide/i }))
    expect(screen.queryByText(GUIDE_LABEL)).not.toBeInTheDocument()
    expect(window.localStorage.getItem('askbagbin-guide-dismissed')).toBe('1')
  })

  it('leaves the transcript and the citations exactly where they were', async () => {
    render(<AskConsole guide />)
    await ask('budget')
    await screen.findByText('The Speaker, quoted')
    fireEvent.click(screen.getByRole('button', { name: /hide the guide/i }))
    expect(screen.getAllByText(/Address on the state of the nation/).length).toBeGreaterThan(0)
    expect(screen.getByText('searched for')).toBeInTheDocument()
  })

  it('offers it back, and brings it back', async () => {
    render(<AskConsole guide />)
    await screen.findByText(GUIDE_LABEL)
    fireEvent.click(screen.getByRole('button', { name: /hide the guide/i }))
    fireEvent.click(screen.getByRole('button', { name: /show the guide/i }))
    expect(await screen.findByText(GUIDE_LABEL)).toBeInTheDocument()
    expect(window.localStorage.getItem('askbagbin-guide-dismissed')).toBeNull()
  })

  it('stays gone on the next visit, rather than coming back unasked', async () => {
    window.localStorage.setItem('askbagbin-guide-dismissed', '1')
    render(<AskConsole guide />)
    await screen.findByPlaceholderText(/Ask about a speech/i)
    expect(screen.queryByText(GUIDE_LABEL)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show the guide/i })).toBeInTheDocument()
  })
})