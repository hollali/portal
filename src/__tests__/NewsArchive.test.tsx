import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFile } from 'node:fs/promises'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}))

import NewsArchive from '@/components/NewsArchive'

function clipping(id: number, title: string) {
  return {
    id,
    title,
    url: `https://example.test/${id}`,
    source: 'GhanaWeb',
    sourceName: 'GhanaWeb',
    query: null,
    date: '2026-04-2' + (id % 9),
    collectedAt: null,
    snippet: `Clipping ${id} summary text.`,
    notes: null,
    tags: null,
  }
}

async function renderArchive() {
  render(<NewsArchive />)
  return screen.findByRole('button', { name: /Open Clipping headline 2/i })
}

describe('news lead card', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [clipping(2, 'Clipping headline 2'), clipping(1, 'Clipping headline 1')],
          total: 2,
          page: 1,
          perPage: 24,
          sources: ['GhanaWeb'],
          facets: {},
        }),
      })),
    )
  })

  /**
   * The lead "Latest" card is the one grid in this component that cannot be
   * collapsed by `minmax(min(100%, …), 1fr)` like its siblings, because it is a
   * fixed two-pane split. It therefore needs an explicit breakpoint, and the
   * breakpoint can only reach the inline `gridTemplateColumns` through a class
   * name. Drop the class — or mistype it — and the card silently goes back to
   * fitting a snippet and two action pills into ~116px on a phone, one word per
   * line. jsdom cannot evaluate a media query, so this asserts the hook the
   * query hangs off rather than the collapsed geometry.
   */
  it('carries the hooks the mobile breakpoint collapses and re-divides it with', async () => {
    await renderArchive()

    const card = screen.getByRole('button', { name: /Open Clipping headline 2/i })
    expect(card).toHaveClass('news-lead-card')

    // The pane whose left border has to become a top border once stacked.
    const aside = card.querySelector('.news-lead-aside')
    expect(aside).not.toBeNull()

    // Both class names must exist in the stylesheet, or the hooks are dead code.
    const css = await readFile('src/app/globals.css', 'utf8')
    expect(css).toMatch(/\.news-lead-card\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/)
    expect(css).toMatch(/\.news-lead-aside\s*\{[^}]*border-top:\s*1px solid/)
  })

  it('leads with the newest clipping and keeps the rest in the grid', async () => {
    await renderArchive()

    // The lead card spans the full row, so it is the only card that carries the
    // lead class; its siblings must stay unhooked or they would stack too.
    expect(document.querySelectorAll('.news-lead-card')).toHaveLength(1)
    expect(await screen.findByText('Clipping headline 1')).toBeInTheDocument()
  })
})