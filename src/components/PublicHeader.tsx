'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Landmark, Menu, X, ChevronDown, Search, Sparkles, ArrowRight,
  Home, UserRound, Milestone, Mic, FileText, MessagesSquare, ScrollText,
  Award, Image as ImageIcon, Lightbulb, Newspaper, Clapperboard, Video,
  AudioLines, type LucideIcon,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import AnnouncementBanner from '@/components/AnnouncementBanner'

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

const MOBILE_PRIMARY = [
  { href: '/', label: 'Home' },
  { href: '/the-man', label: 'The Man' },
  { href: '/timeline', label: 'Timeline' },
]

const MOBILE_ICONS: Record<string, LucideIcon> = {
  '/': Home,
  '/the-man': UserRound,
  '/timeline': Milestone,
  '/ask': Sparkles,
  '/archives/speeches': Mic,
  '/archives/papers': FileText,
  '/archives/interviews': MessagesSquare,
  '/archives/notes': ScrollText,
  '/archives/milestones': Milestone,
  '/archives/testimonials': Award,
  '/archives/photos': ImageIcon,
  '/parliament': Landmark,
  '/themes': Lightbulb,
  '/news': Newspaper,
  '/media': Clapperboard,
  '/videos': Video,
  '/audio': AudioLines,
  '/search': Search,
}

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const lastYRef = useRef(0)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const el = headerRef.current
      if (!el) return
      const y = window.scrollY
      const goingDown = y > lastYRef.current
      lastYRef.current = y
      el.dataset.scrolled = y > 4 ? 'true' : 'false'
      el.dataset.hidden = y < 90 || openMenu || searchOpen || menuOpen || !goingDown ? 'false' : 'true'
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [openMenu, searchOpen, menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600, padding: '0.35rem 0.85rem' }}>
            {hubLabel} <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <AnnouncementBanner
        announcement={{
          message: 'Explore the digitised public archive',
          href: '/archives',
          hrefLabel: 'Browse collections',
        }}
      />
      <header ref={headerRef} className="p-header" aria-label="Site">
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

        <nav ref={dropdownRef} className="hide-sm" style={{ display: 'flex', alignItems: 'center', gap: '1.1rem' }} aria-label="Primary">
          {navLink('/', 'Home')}
          {navLink('/the-man', 'The Man')}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setOpenMenu('archives')}
            onMouseLeave={() => setOpenMenu(null)}
          >
            {dropdownTrigger('archives', 'Archives', '/archives')}
            {dropdownPanel('archives', ARCHIVE_LINKS, '/archives', 'Browse all collections')}
          </div>
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setOpenMenu('media')}
            onMouseLeave={() => setOpenMenu(null)}
          >
            {dropdownTrigger('media', 'Media', '/media')}
            {dropdownPanel('media', MEDIA_LINKS, '/media', 'Open the media hub')}
          </div>
          {navLink('/timeline', 'Timeline')}
          <Link
            href="/ask"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--p-text-1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--primary)')}
          >
            <Sparkles size={14} /> Ask
          </Link>
          <button
            onClick={() => setSearchOpen(o => !o)}
            aria-expanded={searchOpen}
            aria-controls="site-search"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem', color: 'var(--p-text-2)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--p-text-1)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--p-text-2)')}
          >
            <Search size={14} /> Search
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setSearchOpen(o => !o)}
            aria-expanded={searchOpen}
            aria-controls="site-search"
            className="show-sm"
            style={{ display: 'none', background: 'none', border: '1px solid var(--p-border-3)', borderRadius: 8, padding: '0.5rem', color: 'var(--p-text-1)', cursor: 'pointer' }}
          >
            <Search size={18} />
          </button>
          <ThemeToggle square />
          <button onClick={() => setMenuOpen(o => !o)} className="show-sm" aria-expanded={menuOpen} aria-controls="mobile-menu" style={{ display: 'none', background: 'none', border: '1px solid var(--p-border-3)', borderRadius: 8, padding: '0.5rem', color: 'var(--p-text-1)', cursor: 'pointer' }}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div id="site-search" style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-2)', padding: '0.85rem 1.5rem' }}>
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

      </header>

      <div className={`drawer-backdrop${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden={!menuOpen} />
      <div id="mobile-menu" className={`drawer${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen} role="dialog" aria-modal="true">
        <div style={{ position: 'sticky', top: 0, background: 'var(--p-surface)', borderBottom: '1px solid var(--p-border)', padding: '0.9rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-fg)' }}>
              <Landmark size={16} strokeWidth={2.4} />
            </span>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif' }}>AlbanBagbin</span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            style={{ background: 'none', border: '1px solid var(--p-border-3)', borderRadius: 8, padding: '0.45rem', color: 'var(--p-text-1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '0.75rem 1rem 2rem' }}>
          <div className="drawer-group">
            {[...MOBILE_PRIMARY, { href: '/ask', label: 'Ask Bagbin Archive' }].map(item => {
              const Icon = MOBILE_ICONS[item.href] || Home
              const accent = item.href === '/ask'
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="drawer-link" data-accent={accent || undefined}>
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {accent && <Sparkles size={13} style={{ marginLeft: 'auto' }} />}
                </Link>
              )
            })}
          </div>

          <p className="drawer-label">Archives</p>
          <div className="drawer-group">
            {ARCHIVE_LINKS.map(item => {
              const Icon = MOBILE_ICONS[item.href] || ScrollText
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="drawer-link">
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>

          <p className="drawer-label">Media</p>
          <div className="drawer-group">
            {[MEDIA_LINKS.find(m => m.href === '/media'), MEDIA_LINKS.find(m => m.href === '/videos'), MEDIA_LINKS.find(m => m.href === '/audio')].map(item => {
              if (!item) return null
              const Icon = MOBILE_ICONS[item.href] || Clapperboard
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="drawer-link">
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>

          <Link href="/search" onClick={() => setMenuOpen(false)} className="drawer-link">
            <Search size={17} />
            <span>Search the library</span>
          </Link>

          <Link href="/archives" onClick={() => setMenuOpen(false)} className="drawer-hub">
            Browse all collections <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </>
  )
}