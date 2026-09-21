import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
  })
  window.localStorage.clear()
})

import PublicHeader from '@/components/PublicHeader'

describe('PublicHeader dropdown navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('opens the Media dropdown when clicked', () => {
    render(<PublicHeader />)
    const mediaBtn = screen.getByRole('button', { name: /Media/i })
    expect(mediaBtn).toBeTruthy()
    fireEvent.click(mediaBtn)
    expect(screen.getByRole('link', { name: 'Videos' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Audio' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'News' })).toHaveAttribute('href', '/news')
  })

  it('opens the Archives dropdown when clicked', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Archives/i }))
    expect(screen.getByRole('link', { name: 'Speeches' })).toHaveAttribute('href', '/archives/speeches')
    expect(screen.getByRole('link', { name: 'Photo Library' })).toHaveAttribute('href', '/archives/photos')
  })

  it('closes an open dropdown on outside click', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Media/i }))
    expect(screen.getByRole('link', { name: 'Videos' })).toBeTruthy()
    fireEvent.click(document.body)
    expect(screen.queryByRole('link', { name: 'Videos' })).toBeNull()
  })

  it('switches between the two dropdowns without closing both', () => {
    render(<PublicHeader />)
    fireEvent.click(screen.getByRole('button', { name: /Media/i }))
    expect(screen.getByRole('link', { name: 'Videos' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Archives/i }))
    expect(screen.getByRole('link', { name: 'Speeches' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Videos' })).toBeNull()
  })
})