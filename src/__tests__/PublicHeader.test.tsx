import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { readFileSync } from 'node:fs'
import path from 'node:path'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
}))

/** Flips the `(min-width: 768px)` query the header reads to size itself. */
function setViewport(desktop: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      get matches() { return query.includes('768px') ? desktop : false },
      media: query,
      onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
  })
}

beforeEach(() => {
  setViewport(false)
  vi.mocked(usePathname).mockReturnValue('/')
  document.body.innerHTML = ''
  window.localStorage.clear()
})

import PublicHeader from '@/components/PublicHeader'

describe('PublicHeader section panels', () => {
  it('opens the Media panel from a single trigger and lists its collections', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Media/i }))
    expect(screen.getByRole('link', { name: /Videos/ })).toHaveAttribute('href', '/videos')
    expect(screen.getByRole('link', { name: /Audio/ })).toHaveAttribute('href', '/audio')
  })

  it('opens the Archives panel and lists every collection', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Archives/i }))
    expect(screen.getByRole('link', { name: /Speeches/ })).toHaveAttribute('href', '/archives/speeches')
    expect(screen.getByRole('link', { name: /Photo Library/ })).toHaveAttribute('href', '/archives/photos')
    expect(screen.getByRole('link', { name: /Notes & Correspondence/ })).toBeTruthy()
  })

  it('offers the section hub as the panel\'s own first row', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Archives/i }))
    expect(screen.getByRole('link', { name: /Browse all collections/ })).toHaveAttribute('href', '/archives')
  })

  it('is one control per section, not a link beside a chevron', () => {
    render(<PublicHeader />)
    // The old bar exposed "Archives" as a link to /archives *and* a separate
    // chevron button, so the same word meant two different things.
    expect(screen.queryByRole('link', { name: /^Archives$/ })).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Archives/ })).toHaveLength(1)
  })

  it('closes on an outside click', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Media/i }))
    expect(screen.getByRole('link', { name: /Videos/ })).toBeTruthy()
    fireEvent.click(document.body)
    expect(screen.queryByRole('link', { name: /Videos/ })).toBeNull()
  })

  it('switches between the two panels without leaving both open', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Media/i }))
    expect(screen.getByRole('link', { name: /Videos/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Archives/i }))
    expect(screen.getByRole('link', { name: /Speeches/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Videos/ })).toBeNull()
  })

  it('reports open state and names the panel it controls', () => {
    render(<PublicHeader />)
    const trigger = screen.getByRole('button', { name: /Media/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-controls', 'nav-panel-media')
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('nav-panel-media')).toHaveAttribute('aria-label', 'Media')
  })

  it('does not claim a menu widget it does not implement', () => {
    render(<PublicHeader />)
    // aria-haspopup promised a role="menu" popup; the panel is a list of links.
    expect(screen.getByRole('button', { name: /Media/i })).not.toHaveAttribute('aria-haspopup')
  })

  it('closes on Escape pressed on the trigger, not only inside the panel', () => {
    render(<PublicHeader />)
    const trigger = screen.getByRole('button', { name: /Media/i })
    fireEvent.click(trigger)
    expect(screen.getByRole('link', { name: /Videos/ })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('link', { name: /Videos/ })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on Escape pressed inside the panel and restores focus', () => {
    render(<PublicHeader />)
    const trigger = screen.getByRole('button', { name: /Media/i })
    fireEvent.click(trigger)
    fireEvent.keyDown(document.getElementById('nav-panel-media')!, { key: 'Escape' })
    expect(screen.queryByRole('link', { name: /Videos/ })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes on scroll so the panel does not survive the trigger leaving', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Media/i }))
    expect(screen.getByRole('link', { name: /Videos/ })).toBeTruthy()
    fireEvent.scroll(window)
    expect(screen.queryByRole('link', { name: /Videos/ })).toBeNull()
  })

  it('opens on a mouse hover but not on a touch pointer', () => {
    render(<PublicHeader />)
    const trigger = screen.getByRole('button', { name: /Media/i })
    fireEvent.pointerEnter(trigger, { pointerType: 'touch' })
    expect(screen.queryByRole('link', { name: /Videos/ })).toBeNull()

    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' })
    expect(screen.getByRole('link', { name: /Videos/ })).toBeTruthy()
  })

  it('does not close on a touch pointer leaving, which a tap produces', () => {
    render(<PublicHeader />)
    const trigger = screen.getByRole('button', { name: /Media/i })
    fireEvent.pointerEnter(trigger, { pointerType: 'mouse' })
    fireEvent.pointerLeave(trigger, { pointerType: 'touch' })
    expect(screen.getByRole('link', { name: /Videos/ })).toBeTruthy()
  })
})

describe('PublicHeader active link', () => {
  it('marks the current top-level entry', () => {
    vi.mocked(usePathname).mockReturnValue('/timeline')
    render(<PublicHeader />)
    expect(screen.getByRole('link', { name: 'Timeline' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'The Man' })).not.toHaveAttribute('aria-current')
  })

  it('leaves the wordmark to carry Home rather than spending bar width on it', () => {
    render(<PublicHeader />)
    expect(screen.queryByRole('link', { name: /^Home$/ })).toBeNull()
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
  })

  it('marks the section trigger when the route is inside that section', () => {
    vi.mocked(usePathname).mockReturnValue('/videos')
    render(<PublicHeader />)
    const trigger = screen.getByRole('button', { name: /Media/i })
    expect(trigger.closest('li')).toHaveAttribute('data-active', 'true')
    expect(trigger).toHaveAttribute('aria-current', 'page')
  })

  it('marks the collection inside an open panel', () => {
    vi.mocked(usePathname).mockReturnValue('/videos')
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Media/i }))
    expect(screen.getByRole('link', { name: /Videos/ })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark The Man as current on an unrelated route', () => {
    vi.mocked(usePathname).mockReturnValue('/archives/speeches')
    render(<PublicHeader />)
    expect(screen.getByRole('link', { name: 'The Man' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('button', { name: /Archives/i })).toHaveAttribute('aria-current', 'page')
  })
})

describe('PublicHeader mobile drawer', () => {
  it('is inert and hidden from the a11y tree while closed', () => {
    render(<PublicHeader />)
    const drawer = document.getElementById('mobile-menu')!
    expect(drawer).toHaveAttribute('inert')
    expect(drawer).toHaveAttribute('aria-hidden', 'true')
  })

  it('exposes the drawer as a modal dialog when opened', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = document.getElementById('mobile-menu')!
    expect(drawer).toHaveAttribute('role', 'dialog')
    expect(drawer).toHaveAttribute('aria-modal', 'true')
    expect(drawer).not.toHaveAttribute('inert')
    expect(within(drawer).getByRole('button', { name: 'Close menu' })).toBeTruthy()
  })

  it('moves focus into the drawer and back to the toggle on Escape', () => {
    render(<PublicHeader />)
    const toggle = screen.getByRole('button', { name: 'Open menu' })
    fireEvent.click(toggle)
    const close = document.querySelector('#mobile-menu button') as HTMLElement
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.getElementById('mobile-menu')).toHaveAttribute('inert')
    expect(document.activeElement).toBe(toggle)
  })

  it('closes the drawer and unlocks the page on Escape', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.body.style.overflow).toBe('')
  })

  it('closes the drawer on a route change', () => {
    const { rerender } = render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(document.getElementById('mobile-menu')).not.toHaveAttribute('inert')

    vi.mocked(usePathname).mockReturnValue('/themes')
    rerender(<PublicHeader />)
    expect(document.getElementById('mobile-menu')).toHaveAttribute('inert')
  })

  it('closes the drawer when the viewport grows past the breakpoint', () => {
    const listeners: Array<(e: { matches: boolean }) => void> = []
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        get matches() { return false },
        media: query,
        onchange: null,
        addListener: () => {}, removeListener: () => {},
        addEventListener: (_: string, l: (e: { matches: boolean }) => void) => { listeners.push(l) },
        removeEventListener: () => {}, dispatchEvent: () => false,
      }),
    })

    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(document.body.style.overflow).toBe('hidden')

    listeners.forEach(l => act(() => l({ matches: true })))
    expect(document.getElementById('mobile-menu')).toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('')
  })

  it('marks the current page in the drawer', () => {
    vi.mocked(usePathname).mockReturnValue('/parliament')
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    // /parliament is a collection inside the Archives group, so the group has
    // to be expanded before the link is in the DOM at all.
    fireEvent.click(screen.getByRole('button', { name: 'Expand Archives' }))
    const link = screen.getByRole('link', { name: /Parliamentary Legacy/i })
    expect(link).toHaveAttribute('aria-current', 'page')
  })

  it('offers every desktop nav entry in the drawer', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    // Scoped to the drawer: the desktop bar is still in the DOM (CSS hides it
    // below 768px), so an unscoped query would match both copies.
    const drawer = within(document.getElementById('mobile-menu')!)
    for (const label of ['The Man', 'Timeline', 'Ask Bagbin Archive']) {
      expect(drawer.getByRole('link', { name: label })).toBeInTheDocument()
    }
    // Home lives in the drawer brand, not as a row of its own, so a phone still
    // has a route back to the front page.
    expect(drawer.getByRole('link', { name: 'AlbanBagbin' })).toHaveAttribute('href', '/')
    // Both disclosure groups are reachable, each with its hub.
    expect(drawer.getByRole('link', { name: 'Archives' })).toBeInTheDocument()
    expect(drawer.getByRole('link', { name: 'Media' })).toBeInTheDocument()
  })

  it('is the first focusable element, for keyboard users', () => {
    render(<PublicHeader />)
    const skip = screen.getByRole('link', { name: /skip to main content/i })
    expect(skip).toHaveAttribute('href', '#content')
    const focusable = document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    expect(focusable[0]).toBe(skip)
  })
})

/**
 * jsdom does not load globals.css, so the header's visibility at each width is
 * decided entirely by these two utility classes and nothing in a DOM test can
 * see it. Asserted against the stylesheet text instead, because the hamburger
 * once rendered at every width purely because its class had no base rule.
 */
describe('PublicHeader responsive visibility contract', () => {
  const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

  /** The block for `selector` that is *not* nested in a media query. */
  function baseRule(selector: string): string {
    const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    for (const [, header, body] of blocks) {
      if (header.includes(selector) && !/^\s*@/.test(header)) {
        if (new RegExp(`(^|[\\s,])${selector}([\\s,{]|$)`).test(header)) return body
      }
    }
    return ''
  }

  /** Index of `needle`, or -1. Used to tell "before" from "inside" a query. */
  function at(needle: string): number {
    return css.indexOf(needle)
  }

  it('hides .show-sm by default so the hamburger cannot appear on desktop', () => {
    expect(baseRule('.show-sm')).toMatch(/display:\s*none/)
  })

  it('shows .show-sm again only inside a max-width query', () => {
    const block = css.slice(at('@media (max-width: 767px)'))
    expect(block).toMatch(/\.show-sm\s*\{[^}]*display:\s*inline-flex/)
    expect(css.slice(0, at('@media (max-width: 767px)'))).not.toMatch(/\.show-sm\s*\{[^}]*display:\s*inline-flex/)
  })

  it('declares .show-sm after .p-icon-btn so the base rule wins on equal specificity', () => {
    expect(at('.p-icon-btn {')).toBeGreaterThan(-1)
    expect(at('.show-sm {')).toBeGreaterThan(at('.p-icon-btn {'))
  })

  it('hides the desktop nav below the breakpoint', () => {
    expect(css.slice(at('@media (max-width: 767px)'))).toMatch(/\.hide-sm\s*\{[^}]*display:\s*none/)
  })

  it('mounts the toggle with show-sm and the bar with hide-sm', () => {
    render(<PublicHeader />)
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveClass('show-sm')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveClass('hide-sm')
  })
})

describe('PublicHeader offers no portal entry', () => {
  it('has no sign-in or dashboard row in the drawer', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = within(document.getElementById('mobile-menu')!)
    expect(drawer.queryByRole('link', { name: /sign in/i })).toBeNull()
    expect(drawer.queryByRole('link', { name: /portal|dashboard/i })).toBeNull()
  })

  it('never asks who the visitor is', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(<PublicHeader />)
    // The row it fed only chose between /login and /dashboard. With the row
    // gone the request is a per-page call that can only fail.
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('ends the drawer on the library search link', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const links = within(document.getElementById('mobile-menu')!)
      .getAllByRole('link')
      .filter(a => (a as HTMLAnchorElement).getAttribute('href') !== undefined)
    expect(links[links.length - 1]).toHaveTextContent('Search the library')
  })
})
