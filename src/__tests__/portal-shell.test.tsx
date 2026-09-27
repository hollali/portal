import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { usePathname } from 'next/navigation'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/admin/users'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
}))

vi.mock('@/lib/jsonFetch', () => ({
  jsonFetch: vi.fn(async (url: string) => {
    if (url === '/api/me') return { username: 'ops', isAdmin: true, role: 'admin', userId: 1 }
    if (url.includes('/api/admin/notifications')) return { unreadCount: 0 }
    return null
  }),
}))

/** Flips the `(min-width: 768px)` query the shell and sidebar read. */
function setViewport(desktop: boolean) {
  const listeners = new Set<() => void>()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      get matches() { return query.includes('768px') ? desktop : false },
      media: query,
      onchange: null,
      addListener: (l: () => void) => listeners.add(l),
      removeListener: (l: () => void) => listeners.delete(l),
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
      dispatchEvent: () => false,
    }),
  })
  return listeners
}

async function renderShell() {
  const PortalShell = (await import('@/components/PortalShell')).default
  return render(<PortalShell><p>page body</p></PortalShell>)
}

let desktop: boolean
beforeEach(() => {
  desktop = true
  setViewport(true)
  vi.mocked(usePathname).mockReturnValue('/admin/users')
})
afterEach(() => vi.clearAllMocks())

describe('PortalShell — structure', () => {
  it('provides a skip link as the first focusable element', async () => {
    await renderShell()
    const skip = screen.getByRole('link', { name: /skip to main content/i })
    expect(skip).toHaveAttribute('href', '#main')
    expect(document.querySelector('a')).toBe(skip)
  })

  it('points the skip link at the main landmark', async () => {
    await renderShell()
    expect(document.querySelector('main')).toHaveAttribute('id', 'main')
  })

  it('renders the main landmark with children', async () => {
    await renderShell()
    expect(screen.getByRole('main')).toHaveTextContent('page body')
  })

  it('exposes a single navigation landmark', async () => {
    await renderShell()
    expect(screen.getAllByRole('navigation').length).toBeGreaterThanOrEqual(1)
  })
})

describe('Sidebar — active state', () => {
  it('marks exactly the active link with aria-current="page"', async () => {
    await renderShell()
    await waitFor(() => expect(screen.getByRole('link', { name: /^Users/ })).toBeInTheDocument())
    const current = screen.getAllByRole('link').filter(a => a.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Users')
  })

  it('does not mark /admin active while on a nested admin route', async () => {
    vi.mocked(usePathname).mockReturnValue('/admin/users')
    await renderShell()
    const adminLink = screen.getByRole('link', { name: /^Dashboard/ })
    expect(adminLink).not.toHaveAttribute('aria-current')
  })

  it('marks the parent active for a nested media route', async () => {
    vi.mocked(usePathname).mockReturnValue('/admin/media/images')
    await renderShell()
    await waitFor(() => {
      const link = document.querySelector('a[href="/admin/media/images"]')!
      expect(link).toHaveAttribute('aria-current', 'page')
    })
  })
})

describe('Sidebar — mobile drawer', () => {
  beforeEach(() => { desktop = false; setViewport(false) })

  it('hides the drawer from assistive tech and the tab order when closed', async () => {
    await renderShell()
    const nav = await waitFor(() => {
      const el = document.querySelector('aside')!
      expect(el).toBeInTheDocument()
      return el
    })
    expect(nav).toHaveAttribute('aria-hidden', 'true')
    expect(nav).toHaveAttribute('inert')
    // Sanity check that it really is excluded from the a11y tree, not just
    // annotated: testing-library resolves no role inside an inert subtree.
    expect(screen.queryByRole('link', { name: /^Images/ })).not.toBeInTheDocument()
    expect(nav.querySelector('a[href="/admin/media/images"]')).toBeInTheDocument()
  })

  it('shows a menu button on mobile and not on desktop', async () => {
    await renderShell()
    expect(await screen.findByRole('button', { name: /open navigation/i })).toBeInTheDocument()
  })

  it('opens the drawer and removes aria-hidden', async () => {
    await renderShell()
    fireEvent.click(await screen.findByRole('button', { name: /open navigation/i }))
    const nav = document.querySelector('aside')!
    await waitFor(() => expect(nav).not.toHaveAttribute('inert'))
    expect(nav).not.toHaveAttribute('aria-hidden')
  })

  it('closes on Escape', async () => {
    await renderShell()
    fireEvent.click(await screen.findByRole('button', { name: /open navigation/i }))
    const nav = document.querySelector('aside')!
    await waitFor(() => expect(nav).not.toHaveAttribute('inert'))

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(nav).toHaveAttribute('inert'))
  })

  it('exposes a close button inside the open drawer', async () => {
    await renderShell()
    fireEvent.click(await screen.findByRole('button', { name: /open navigation/i }))
    expect(await screen.findByRole('button', { name: /close navigation/i })).toBeInTheDocument()
  })

  it('closes when the close button is pressed', async () => {
    await renderShell()
    fireEvent.click(await screen.findByRole('button', { name: /open navigation/i }))
    fireEvent.click(await screen.findByRole('button', { name: /close navigation/i }))
    await waitFor(() => expect(document.querySelector('aside')).toHaveAttribute('inert'))
  })

  it('locks body scroll while the drawer is open', async () => {
    await renderShell()
    expect(document.body.style.overflow).toBe('')
    fireEvent.click(await screen.findByRole('button', { name: /open navigation/i }))
    await waitFor(() => expect(document.body.style.overflow).toBe('hidden'))
  })
})

describe('Topbar', () => {
  it('renders a search landmark with an accessible name', async () => {
    await renderShell()
    expect(await screen.findByRole('search')).toBeInTheDocument()
    expect(screen.getByLabelText(/search the portal/i)).toBeInTheDocument()
  })

  it('shows a breadcrumb trail for the current route', async () => {
    await renderShell()
    await waitFor(() => expect(document.querySelector('nav[aria-label="Breadcrumb"]')).toBeInTheDocument())
    const crumbs = document.querySelector('nav[aria-label="Breadcrumb"]')!
    expect(crumbs).toBeInTheDocument()
    expect(crumbs).toHaveTextContent('Admin')
    expect(crumbs).toHaveTextContent('Users')
    expect(crumbs.querySelector('[aria-current="page"]')).toHaveTextContent('Users')
  })

  it('exposes an account menu button', async () => {
    await renderShell()
    await waitFor(() => expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument())
  })
})
