'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { jsonFetch } from '@/lib/jsonFetch'
import {
  LayoutDashboard,
  Image,
  Video,
  Newspaper,
  Headphones,
  Search,
  LogOut,
  LogIn,
  X,
  Activity,
  ScrollText,
  Users,
  Settings,
  Bell,
  ShieldCheck,
  FileText,
  Library,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

interface NavLink {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

interface NavSection {
  label: string | null
  links: NavLink[]
}

const publicSections: NavSection[] = [
  {
    label: null,
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/images', label: 'Images', icon: Image },
      { href: '/videos', label: 'Videos', icon: Video },
      { href: '/news', label: 'News', icon: Newspaper },
      { href: '/audio', label: 'Audio', icon: Headphones },
      { href: '/search', label: 'Search', icon: Search },
    ],
  },
]

const adminSections: NavSection[] = [
  {
    label: null,
    links: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Media',
    links: [
      { href: '/admin/media/images', label: 'Images', icon: Image },
      { href: '/admin/media/videos', label: 'Videos', icon: Video },
      { href: '/admin/media/news', label: 'News', icon: Newspaper },
      { href: '/admin/media/audio', label: 'Audio', icon: Headphones },
    ],
  },
  {
    label: 'Admin',
    links: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/content', label: 'Content', icon: FileText },
      { href: '/admin/archive', label: 'Archive', icon: Library },
      { href: '/admin/notifications', label: 'Notifications', icon: Bell },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
      { href: '/admin/health', label: 'Health', icon: Activity },
      { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
      { href: '/admin/duplicates', label: 'Duplicates', icon: ShieldCheck },
    ],
  },
]

/** Only admins can manage users, settings, and system health. */
const systemLinks = ['/admin/users', '/admin/settings', '/admin/health']

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Sidebar({
  open,
  isDesktop,
  onClose,
}: {
  open: boolean
  isDesktop: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [role, setRole] = useState<string>('')
  const [unread, setUnread] = useState(0)
  const asideRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    jsonFetch<{ username?: string; isAdmin?: boolean; role?: string }>('/api/me').then(d => {
      if (d?.username) {
        setUsername(d.username)
        setIsAdmin(d.isAdmin || false)
        setRole(d.role || '')
      }
    })
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    jsonFetch<{ unreadCount?: number }>('/api/admin/notifications?limit=1').then(d => {
      setUnread(d?.unreadCount || 0)
    })
  }, [isAdmin, pathname])

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' })
    setUsername(null)
    setIsAdmin(false)
    setRole('')
    window.location.href = '/login'
  }

  const isActive = useCallback(
    (href: string) => {
      if (href === '/') return pathname === '/'
      // `/admin` must not light up for every /admin/* route, but
      // `/admin/media/images` should light up for itself.
      if (href === '/admin') return pathname === '/admin'
      return pathname === href || pathname.startsWith(`${href}/`)
    },
    [pathname]
  )

  const sections = isAdmin
    ? adminSections.map(section => ({
        ...section,
        links:
          role === 'admin' ? section.links : section.links.filter(l => !systemLinks.includes(l.href)),
      }))
    : publicSections

  // Escape closes, Tab is trapped inside the drawer while it is modal.
  useEffect(() => {
    if (!open || isDesktop) return
    const node = asideRef.current
    if (!node) return
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => el.offsetParent !== null || el === document.activeElement
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, isDesktop, onClose])

  const visible = isDesktop || open

  return (
    <>
      {open && !isDesktop && (
        <div
          onClick={onClose}
          aria-hidden
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
        />
      )}

      <aside
        ref={asideRef}
        id="portal-nav"
        aria-label="Main navigation"
        // Off-canvas while hidden on mobile: keep it out of the tab order and
        // hide it from assistive tech instead of leaving it focusable behind
        // the overlay.
        aria-hidden={visible ? undefined : true}
        inert={!visible ? true : undefined}
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
          overscrollBehavior: 'contain',
          transition: 'transform 0.25s ease',
          transform: visible ? 'translateX(0)' : 'translateX(-100%)',
          visibility: visible ? 'visible' : 'hidden',
        }}
      >
        <div
          style={{
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <span
            aria-hidden
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
              flex: 1,
            }}
          >
            OSINT Portal
          </span>
          {!isDesktop && (
            <Button
              ref={closeRef}
              variant="ghost"
              size="sm"
              iconOnly
              onClick={onClose}
              aria-label="Close navigation"
            >
              <X size={18} aria-hidden />
            </Button>
          )}
        </div>

        <nav style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {sections.map((section, si) => (
            <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {section.label && (
                <h2
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--muted)',
                    padding: '0.75rem 0.875rem 0.25rem',
                    margin: 0,
                  }}
                >
                  {section.label}
                </h2>
              )}
              {section.links.map(({ href, label, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
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
                    <Icon
                      size={18}
                      aria-hidden
                      className="nav-icon"
                      style={{ color: active ? 'var(--primary-fg)' : 'var(--muted)' }}
                    />
                    <span style={{ flex: 1 }}>{label}</span>
                    {href === '/admin/notifications' && unread > 0 && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: 'var(--primary-fg)',
                          background: 'var(--primary)',
                          borderRadius: '999px',
                          minWidth: '18px',
                          height: '18px',
                          padding: '0 4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {unread > 99 ? '99+' : unread}
                        <span className="sr-only"> unread notifications</span>
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div
          style={{
            padding: '0.875rem 1rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div className="flex justify-center">
            <ThemeToggle />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            {username ? (
              <>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{username}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  iconLeft={<LogOut size={14} aria-hidden />}
                  style={{ color: 'var(--danger)' }}
                >
                  Logout
                </Button>
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
                <LogIn size={14} aria-hidden /> Login
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
