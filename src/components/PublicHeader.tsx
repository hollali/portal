'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Landmark, LogIn, Menu, X, ChevronDown, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const ARCHIVE_LINKS = [
  { href: '/archives/speeches', label: 'Speeches' },
  { href: '/archives/papers', label: 'Public Papers' },
  { href: '/archives/interviews', label: 'Interviews' },
  { href: '/archives/notes', label: 'Notes & Correspondence' },
  { href: '/archives/milestones', label: 'Milestones' },
  { href: '/archives/testimonials', label: 'Testimonials' },
  { href: '/archives/photos', label: 'Photo Library' },
  { href: '/parliament', label: 'Parliamentary Legacy' },
  { href: '/themes', label: 'Themes & Ideas' },
  { href: '/news', label: 'News Clippings' },
]

const MEDIA_LINKS = [
  { href: '/media', label: 'Media Hub' },
  { href: '/archives/photos', label: 'Photos' },
  { href: '/videos', label: 'Videos' },
  { href: '/audio', label: 'Audio' },
  { href: '/news', label: 'News' },
]

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    window.location.href = `/search?q=${encodeURIComponent(query.trim())}`
  }

  const navLink = (href: string, label: string) => (
    <Link key={href} href={href} style={{ fontSize: '0.875rem', color: 'var(--p-text-2)', textDecoration: 'none', transition: 'color 0.2s' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'var(--p-text-1)')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--p-text-2)')}>
      {label}
    </Link>
  )

  const dropdownTrigger = (key: string, label: string, hub: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
      <Link
        href={hub}
        style={{ fontSize: '0.875rem', color: 'var(--p-text-2)', textDecoration: 'none', transition: 'color 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--p-text-1)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--p-text-2)')}
      >
        {label}
      </Link>
      <button
        aria-label={`Toggle ${label} menu`}
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpenMenu(o => (o === key ? null : key)) }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.875rem',
          color: 'var(--p-text-2)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem 0.2rem', transition: 'color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--p-text-1)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--p-text-2)')}
      >
        <ChevronDown size={13} style={{ transform: openMenu === key ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
    </span>
  )

  const dropdownPanel = (key: string, items: { href: string; label: string }[], hub: string, hubLabel: string) => {
    if (openMenu !== key) return null
    return (
      <div style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '0.75rem', minWidth: 230,
        background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 12, padding: '0.5rem',
        boxShadow: 'var(--p-shadow)', display: 'flex', flexDirection: 'column', zIndex: 60,
      }}>
        {items.map(item => (
          <Link key={item.href} href={item.href} onClick={() => setOpenMenu(null)}
            style={{ color: 'var(--p-text-2)', textDecoration: 'none', fontSize: '0.875rem', padding: '0.55rem 0.85rem', borderRadius: 8, transition: 'background 0.2s, color 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--p-surface-2)'; e.currentTarget.style.color = 'var(--p-text-1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--p-text-2)' }}>
            {item.label}
          </Link>
        ))}
        <div style={{ borderTop: '1px solid var(--p-border)', margin: '0.25rem 0.2rem 0', paddingTop: '0.35rem' }}>
          <Link href={hub} onClick={() => setOpenMenu(null)}
            style={{ display: 'inline-block', color: 'var(--primary)', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600, padding: '0.35rem 0.85rem' }}>
            {hubLabel} →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'color-mix(in srgb, var(--p-bg) 82%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--p-border)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }} className="p-header-inner">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-fg)' }}>
            <Landmark size={18} strokeWidth={2.4} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span className="p-brand-word" style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), var(--font-inter), sans-serif' }}>
              AlbanBagbin
            </span>
            <span className="p-brand-tag" style={{ fontSize: '0.55rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace' }}>
              Digital Library
            </span>
          </span>
        </Link>

        <nav className="hide-sm" style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }}>
          {navLink('/', 'Home')}
          {navLink('/the-man', 'The Man')}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            {dropdownTrigger('archives', 'Archives', '/archives')}
            {dropdownPanel('archives', ARCHIVE_LINKS, '/archives', 'Browse all collections')}
          </div>
          <div style={{ position: 'relative' }}>
            {dropdownTrigger('media', 'Media', '/media')}
            {dropdownPanel('media', MEDIA_LINKS, '/media', 'Open the media hub')}
          </div>
          {navLink('/timeline', 'Timeline')}
          <button
            onClick={() => setSearchOpen(o => !o)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: 'var(--p-text-2)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--p-text-1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--p-text-2)')}
          >
            <Search size={14} /> Search
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="hide-sm"><ThemeToggle /></div>
          <Link href="/login"
            className="p-admin-btn"
            style={{
              fontSize: '0.8125rem', fontWeight: 500, color: 'var(--p-text-2)', background: 'transparent',
              padding: '0.5rem 0.75rem', borderRadius: 999, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem',
              border: '1px solid var(--p-border)', transition: 'color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--p-text-1)'; e.currentTarget.style.borderColor = 'var(--p-text-3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--p-text-2)'; e.currentTarget.style.borderColor = 'var(--p-border)' }}
          >
            <LogIn size={14} /> Sign in
          </Link>
          <button onClick={() => setMenuOpen(o => !o)} className="show-sm" style={{ display: 'none', background: 'none', border: '1px solid var(--p-border-3)', borderRadius: 8, padding: '0.5rem', color: 'var(--p-text-1)', cursor: 'pointer' }}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-2)', padding: '0.85rem 1.5rem' }}>
          <form onSubmit={submitSearch} style={{ maxWidth: 560, margin: '0 auto', display: 'flex', gap: '0.5rem' }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search speeches, letters, milestones, media..."
              style={{ flex: 1, background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.6rem 1rem', color: 'var(--p-text-1)', fontSize: '0.9rem', outline: 'none' }}
            />
            <button type="submit" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', borderRadius: 999, padding: '0.6rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              Search
            </button>
          </form>
        </div>
      )}

      {menuOpen && (
        <div style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-bg)', padding: '0.75rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {[{ href: '/', label: 'Home' }, { href: '/the-man', label: 'The Man' }, { href: '/timeline', label: 'Timeline' }, ...[...ARCHIVE_LINKS, ...MEDIA_LINKS].filter((item, idx, arr) => arr.findIndex(i => i.href === item.href) === idx)].map(item => (
            <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={{ color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '1rem', padding: '0.5rem 0' }}>
              {item.label}
            </Link>
          ))}
          <Link href="/search" onClick={() => setMenuOpen(false)} style={{ color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '1rem', padding: '0.5rem 0' }}>Search</Link>
          <div style={{ padding: '0.5rem 0' }}><ThemeToggle /></div>
        </div>
      )}
    </header>
  )
}