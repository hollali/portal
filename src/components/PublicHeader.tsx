'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Landmark, LogIn, Menu, X } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

export const PUBLIC_NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/images', label: 'Images' },
  { href: '/videos', label: 'Videos' },
  { href: '/audio', label: 'Audio' },
  { href: '/news', label: 'News' },
  { href: '/search', label: 'Search' },
]

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'color-mix(in srgb, var(--p-bg) 82%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--p-border)',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }} className="p-header-inner">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-fg)' }}>
            <Landmark size={18} strokeWidth={2.4} />
          </span>
          <span className="p-brand-word" style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), var(--font-inter), sans-serif' }}>
            AlbanBagbin
          </span>
        </Link>

        <nav className="hide-sm" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {PUBLIC_NAV.map(n => (
            <Link key={n.href} href={n.href} style={{ fontSize: '0.875rem', color: 'var(--p-text-2)', textDecoration: 'none', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--p-text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--p-text-2)')}>
              {n.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="hide-sm"><ThemeToggle /></div>
          <Link href="/login"
            className="p-admin-btn"
            style={{
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: 'var(--p-text-2)',
              background: 'transparent',
              padding: '0.5rem 0.75rem',
              borderRadius: 999,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: '1px solid var(--p-border)',
              transition: 'color 0.2s, border-color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--p-text-1)'; e.currentTarget.style.borderColor = 'var(--p-text-3)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--p-text-2)'; e.currentTarget.style.borderColor = 'var(--p-border)' }}
          >
            <LogIn size={14} /> Sign in
          </Link>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="show-sm"
            style={{ display: 'none', background: 'none', border: '1px solid var(--p-border-3)', borderRadius: 8, padding: '0.5rem', color: 'var(--p-text-1)', cursor: 'pointer' }}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-bg)', padding: '0.75rem 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {PUBLIC_NAV.map(n => (
            <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} style={{ color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '1rem', padding: '0.5rem 0' }}>
              {n.label}
            </a>
          ))}
          <div style={{ padding: '0.5rem 0' }}><ThemeToggle /></div>
        </div>
      )}
    </header>
  )
}
