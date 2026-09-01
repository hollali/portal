'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Image,
  Video,
  Newspaper,
  Headphones,
  Search,
  LogOut,
  LogIn,
  Menu,
  X,
  Activity,
  ScrollText,
  Users,
  Settings,
  Bell,
  ShieldCheck,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/images', label: 'Images', icon: Image },
  { href: '/videos', label: 'Videos', icon: Video },
  { href: '/news', label: 'News', icon: Newspaper },
  { href: '/audio', label: 'Audio', icon: Headphones },
  { href: '/search', label: 'Search', icon: Search },
]

const adminLinks = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
  { href: '/admin/health', label: 'Health', icon: Activity },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/admin/duplicates', label: 'Duplicates', icon: ShieldCheck },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<string>('')
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => {
        if (d.username) { setUsername(d.username); setIsAdmin(d.isAdmin); setRole(d.role || '') }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/notifications?limit=1')
      .then(r => r.json())
      .then(d => setUnread(d.unreadCount || 0))
      .catch(() => {})
  }, [isAdmin])

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' })
    setUsername(null)
    setIsAdmin(false)
    setRole('')
    window.location.href = '/login'
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // Only admins can manage users, settings, and system health
  const systemLinks = ['/admin/users', '/admin/settings', '/admin/health']
  const visibleAdminLinks = adminLinks.filter(l => role === 'admin' || !systemLinks.includes(l.href))
  const allLinks = isAdmin ? visibleAdminLinks : navLinks

  const sidebarVisible = isDesktop || open

  return (
    <>
      {/* Mobile overlay */}
      {open && !isDesktop && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 40,
          }}
        />
      )}

      {/* Hamburger button (mobile only) */}
      {!isDesktop && (
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            position: 'fixed',
            top: '0.75rem',
            left: '0.75rem',
            zIndex: 60,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            padding: '0.5rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--foreground)',
            transition: 'left 0.25s ease',
          }}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 'var(--sidebar-width)',
          height: '100vh',
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          transition: 'transform 0.25s ease',
          transform: sidebarVisible ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Activity size={16} style={{ color: 'var(--primary-fg)' }} />
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: '1.0625rem',
              letterSpacing: '-0.02em',
              color: 'var(--foreground)',
            }}
          >
            OSINT Portal
          </span>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {allLinks.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`nav-item${active ? ' active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: active ? 600 : 450,
                  textDecoration: 'none',
                  color: active ? 'var(--primary-fg)' : 'var(--foreground)',
                }}
              >
                <Icon size={18} className="nav-icon" style={{ color: active ? 'var(--primary-fg)' : 'var(--muted)' }} />
                <span style={{ flex: 1 }}>{label}</span>
                {href === '/admin/notifications' && unread > 0 && (
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, color: '#fff',
                    background: 'var(--danger)', borderRadius: '999px',
                    minWidth: '18px', height: '18px', padding: '0 4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User area */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {username ? (
            <>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{username}</span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '0.375rem',
                  padding: '0.3rem 0.6rem',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.75rem',
                  transition: 'color 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'var(--danger)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              style={{
                fontSize: '0.8rem',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <LogIn size={14} /> Login
            </Link>
          )}
          </div>
        </div>
      </aside>
    </>
  )
}
