import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhotoLightbox } from '@/app/(public)/archives/photos/page'

const photo = {
  id: 1290,
  src: 'https://example.test/photo.jpg',
  year: 2019,
  event: null,
  location: null,
  person: null,
  institution: null,
  parliament: null,
  theme: null,
  caption: null,
  source: 'Bing',
  sourceUrl: 'https://example.test/photo.jpg',
  query: '"Alban Bagbin" speaker parliament Ghana',
  collectedAt: '2026-04-27T08:02:35.047537',
  dateTaken: null,
  notes: null,
  tags: null,
  curated: false,
  storedLocally: false,
  imageHash: 'b240fc6ccdce8dcc',
  faceDetected: null,
  faceCount: null,
  faceMatch: null,
  faceMatchScore: null,
  faceMatchDistance: null,
  bestReferencePath: null,
}

function renderLightbox(overrides: Partial<Parameters<typeof PhotoLightbox>[0]> = {}) {
  const props = {
    photo,
    index: 0,
    total: 3,
    onClose: vi.fn(),
    onPrev: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  }
  return { ...render(<PhotoLightbox {...props} />), props }
}

describe('PhotoLightbox', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('exposes dialog semantics and an accessible name', () => {
    renderLightbox()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    // Falls back to the catalogue id when there is no caption.
    expect(dialog).toHaveAccessibleName('Photograph #1290')
  })

  it('names every icon-only control', () => {
    renderLightbox({ index: 1 })
    expect(screen.getByRole('button', { name: 'Close photo viewer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeInTheDocument()
  })

  it('hides previous on the first photo and next on the last', () => {
    const { unmount } = renderLightbox({ index: 0, total: 3 })
    expect(screen.queryByRole('button', { name: 'Previous photo' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next photo' })).toBeInTheDocument()
    unmount()

    renderLightbox({ index: 2, total: 3 })
    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const { props } = renderLightbox()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('navigates with the arrow keys and respects the ends', () => {
    const { props } = renderLightbox({ index: 1, total: 3 })
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(props.onPrev).toHaveBeenCalledTimes(1)
    expect(props.onNext).toHaveBeenCalledTimes(1)
  })

  it('does not navigate past either end', () => {
    const { props } = renderLightbox({ index: 0, total: 3 })
    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(props.onPrev).not.toHaveBeenCalled()

    const last = renderLightbox({ index: 2, total: 3 })
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(last.props.onNext).not.toHaveBeenCalled()
  })

  it('locks background scroll while open and restores it on unmount', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = renderLightbox()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('moves focus in on open and restores it to the trigger on close', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { unmount } = renderLightbox()
    expect(document.activeElement).not.toBe(trigger)
    expect(screen.getByRole('button', { name: 'Close photo viewer' })).toHaveFocus()

    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('shows the source and the full detail set', () => {
    renderLightbox()
    // The header line is three sibling text nodes, so match on the whole string.
    expect(screen.getByText(/Source: Bing/)).toBeInTheDocument()
    expect(screen.getByText(/1 of 3/)).toBeInTheDocument()
    expect(screen.getByText('About this photograph')).toBeInTheDocument()
    expect(screen.getByText('Provenance')).toBeInTheDocument()
    expect(screen.getByText('Catalogue ID')).toBeInTheDocument()
    // Collected is a raw ISO string in the database; it must be humanised.
    expect(screen.getByText(/27 April 2026/)).toBeInTheDocument()
    expect(screen.queryByText(/2026-04-27T08:02/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View on the web' })).toHaveAttribute(
      'href',
      'https://example.test/photo.jpg'
    )
  })

  it('flags a photograph that has not been described', () => {
    // No descriptive facets at all — which is the real state of the library.
    renderLightbox({ photo: { ...photo, year: null, event: null } })
    expect(screen.getByText(/has not been fully described/)).toBeInTheDocument()
  })

  it('does not flag a described photograph', () => {
    renderLightbox()
    expect(screen.queryByText(/has not been fully described/)).not.toBeInTheDocument()
  })

  it('falls back to a recoverable placeholder when the image fails', () => {
    renderLightbox()
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('Image unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Try the original source' })).toBeInTheDocument()
  })

  it('closes only when the backdrop itself is clicked', () => {
    const { props } = renderLightbox()
    fireEvent.click(screen.getByRole('dialog'))
    expect(props.onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
