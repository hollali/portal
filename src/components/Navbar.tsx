'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function Navbar() {
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => {
        if (d.username) { setUsername(d.username); setIsAdmin(d.isAdmin) }
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' })
    setUsername(null)
    setIsAdmin(false)
    window.location.href = '/login'
  }

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/images', label: 'Images' },
    { href: '/videos', label: 'Videos' },
    { href: '/news', label: 'News' },
    { href: '/audio', label: 'Audio' },
    { href: '/search', label: 'Search' },
    { href: '/duplicates', label: 'Duplicates' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link href="/" style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--foreground)', textDecoration: 'none' }}>
            OSINT Portal
          </Link>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  background: pathname === l.href ? 'var(--primary)' : 'transparent',
                  color: pathname === l.href ? 'white' : 'var(--foreground)',
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {username ? (
            <>
              <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{username}</span>
              <button onClick={handleLogout} style={{ fontSize: '0.875rem', cursor: 'pointer', background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.25rem 0.75rem', color: 'var(--foreground)' }}>
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" style={{ fontSize: '0.875rem', textDecoration: 'none' }}>Login</Link>
          )}
        </div>
      </div>
    </nav>
  )
}
