'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, Bell, LogOut, LogIn, UserCog, Menu } from 'lucide-react'
import { jsonFetch } from '@/lib/jsonFetch'
import { Button } from '@/components/ui/Button'
import { DropdownMenu, MenuCaret, type DropdownMenuItem } from '@/components/ui/DropdownMenu'

/**
 * Path segment -> human label. Anything not listed falls back to a title-cased
 * version of the segment, so a new route never renders a raw slug.
 */
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  media: 'Media',
  dashboard: 'Dashboard',
  images: 'Images',
  videos: 'Videos',
  news: 'News',
  audio: 'Audio',
  search: 'Search',
  content: 'Content',
  archive: 'Archive',
  users: 'Users',
  settings: 'Settings',
  health: 'Health',
  audit: 'Audit',
  duplicates: 'Duplicates',
  notifications: 'Notifications',
  photos: 'Photos',
}

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment]
  return segment
    .replace(/^\d+$/, '#')
    .replace(/-/g, ' ')
    .replace(/^./, c => c.toUpperCase())
}

export function breadcrumbFor(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; href: string }[] = []
  let acc = ''
  for (const seg of segments) {
    acc += `/${seg}`
    crumbs.push({ label: labelFor(seg), href: acc })
  }
  return crumbs
}

export default function Topbar({
  onToggleNav,
  navOpen,
  isDesktop,
}: {
  onToggleNav: () => void
  navOpen: boolean
  isDesktop: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [username, setUsername] = useState<string | null>(null)
  const [role, setRole] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [unread, setUnread] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    jsonFetch<{ username?: string; role?: string; isAdmin?: boolean }>('/api/me').then(d => {
      if (d?.username) {
        setUsername(d.username)
        setRole(d.role || '')
        setIsAdmin(d.isAdmin || false)
      }
    })
  }, [])

  const refreshUnread = () => {
    if (!isAdmin) return
    jsonFetch<{ unreadCount?: number }>('/api/admin/notifications?limit=1').then(d => {
      setUnread(d?.unreadCount || 0)
    })
  }

  useEffect(refreshUnread, [isAdmin, pathname])

  // `/` focuses search; Escape gives focus back to the page. This is the one
  // global shortcut, and it only fires when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    router.push(`/search?q=${encodeURIComponent(term)}`)
  }

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' })
    setUsername(null)
    setIsAdmin(false)
    setRole('')
    window.location.href = '/login'
  }

  const accountItems: DropdownMenuItem[] = username
    ? [
        {
          key: 'profile',
          label: <span className="text-xs" style={{ color: 'var(--muted)' }}>{username} · {role || 'member'}</span>,
          onSelect: () => {},
          disabled: true,
        },
        ...(isAdmin
          ? [{ key: 'users', label: 'User management', icon: <UserCog size={15} aria-hidden />, onSelect: () => router.push('/admin/users') }]
          : []),
        {
          key: 'logout',
          label: 'Sign out',
          icon: <LogOut size={15} aria-hidden />,
          onSelect: handleLogout,
          danger: true,
          separated: true,
        },
      ]
    : [{ key: 'login', label: 'Sign in', icon: <LogIn size={15} aria-hidden />, onSelect: () => router.push('/login') }]

  return (
    <header
      className="topbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        height: isDesktop ? 56 : 64,
        padding: '0 1rem',
        background: 'color-mix(in srgb, var(--background) 88%, transparent)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {!isDesktop && (
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onToggleNav}
          // "Hide" rather than "Close": the drawer carries its own
          // `Close navigation` button, and two controls sharing an accessible
          // name is ambiguous to announce. `aria-expanded` carries the state
          // either way.
          aria-label={navOpen ? 'Hide navigation' : 'Open navigation'}
          aria-expanded={navOpen}
          aria-controls="portal-nav"
        >
          <Menu size={18} aria-hidden />
        </Button>
      )}

      <nav aria-label="Breadcrumb" className="min-w-0 shrink">
        <ol className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
          {breadcrumbFor(pathname).map((c, i, all) => {
            const last = i === all.length - 1
            return (
              <li key={c.href} className="flex items-center gap-1.5 min-w-0">
                {last ? (
                  <span
                    aria-current="page"
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {c.label}
                  </span>
                ) : (
                  <Link
                    href={c.href}
                    className="text-sm no-underline truncate"
                    style={{ color: 'var(--muted)' }}
                  >
                    {c.label}
                  </Link>
                )}
                {!last && (
                  <span aria-hidden style={{ color: 'var(--border-strong)' }}>
                    /
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="flex-1" />

      <form role="search" onSubmit={onSearch} className="relative" style={{ minWidth: 0 }}>
        <label htmlFor="topbar-search" className="sr-only">Search the portal</label>
        <span
          aria-hidden
          className="absolute pointer-events-none"
          style={{ left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}
        >
          <Search size={15} />
        </span>
        <input
          id="topbar-search"
          ref={searchRef}
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search…"
          className="ui-input"
          // 44px on a phone: the desktop 34px density hint is a pointer target
          // there, not a tap target.
          style={{ height: isDesktop ? 34 : 44, width: 'min(34vw, 15rem)', paddingLeft: '1.9rem', paddingRight: isDesktop ? '1.6rem' : '0.75rem' }}
        />
        {/* The `/` hint is for a hardware keyboard. On a phone it sits over the
            input as decoration and eats width the field needs. */}
        {isDesktop && !q && (
          <kbd
            aria-hidden
            className="absolute pointer-events-none text-[0.65rem]"
            style={{
              right: 8, top: '50%', transform: 'translateY(-50%)',
              padding: '1px 5px', borderRadius: 4,
              border: '1px solid var(--border-strong)', color: 'var(--muted)',
            }}
          >
            /
          </kbd>
        )}
      </form>

      {isAdmin && (
        <Link
          href="/admin/notifications"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
          className="relative inline-flex items-center justify-center no-underline"
          style={{ width: 32, height: 32, borderRadius: 8, color: 'var(--muted-foreground)' }}
        >
          <Bell size={17} aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute"
              style={{
                top: 3, right: 3, minWidth: 15, height: 15, padding: '0 3px',
                borderRadius: 999, background: 'var(--danger)', color: '#fff',
                fontSize: '0.6rem', fontWeight: 700, lineHeight: '15px', textAlign: 'center',
              }}
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
      )}

      <DropdownMenu
        label="Account"
        items={accountItems}
        trigger={
          // Both children are aria-hidden (an avatar initial and a caret), so
          // the trigger needs an explicit name of its own.
          <Button variant="ghost" size="sm" aria-label="Account" style={{ gap: 6, paddingInline: 8 }}>
            <span
              aria-hidden
              className="inline-flex items-center justify-center font-bold"
              style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: '0.7rem' }}
            >
              {(username || '?').slice(0, 1).toUpperCase()}
            </span>
            <MenuCaret />
          </Button>
        }
      />
    </header>
  )
}
