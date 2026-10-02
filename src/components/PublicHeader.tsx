'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Landmark, Menu, X, ChevronDown, Search, Sparkles, ArrowRight, Home,
  type LucideIcon,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import AnnouncementBanner from '@/components/AnnouncementBanner'
import { PRIMARY_NAV, ASK_HREF, SEARCH_HREF, EXTRA_ICONS, type NavPanel } from '@/lib/siteNav'

/**
 * The drawer repeats PRIMARY_NAV rather than the sitemap. A flat list of all
 * 21 destinations was ~570px of scroll on a 667px phone, pushed the search
 * link below the fold, and re-presented the collections in a worse form than
 * the `/archives` and `/media` hub pages already do — cards with live counts.
 * So the two panels become expandable groups and everything else matches the
 * desktop bar one for one, in the same order.
 *
 * Derived rather than retyped, so a section cannot appear on the desktop bar
 * and be missing from the drawer — invisible until someone opens the menu on a
 * phone. That drift is not hypothetical: it is why the drawer used to carry
 * icons the desktop bar did not.
 */
type DrawerEntry =
  | { kind: 'link'; href: string; label: string; icon: LucideIcon; accent?: boolean }
  | NavPanel

const DRAWER_NAV: DrawerEntry[] = [
  ...PRIMARY_NAV,
  { kind: 'link', href: ASK_HREF, label: 'Ask Bagbin Archive', icon: Sparkles, accent: true },
]

/**
 * Href → icon for the drawer, assembled from the same tree the desktop panels
 * render so the two cannot disagree about what an icon means.
 */
const DRAWER_ICONS: Record<string, LucideIcon> = (() => {
  const map: Record<string, LucideIcon> = { ...EXTRA_ICONS }
  for (const entry of PRIMARY_NAV) {
    if (entry.kind === 'link') map[entry.href] = entry.icon
    else {
      map[entry.hub] = entry.icon
      for (const item of entry.items) map[item.href] = item.icon
    }
  }
  return map
})()

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function PublicHeader() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  // Which drawer group is expanded. Single value, as on desktop: two open
  // groups at once would push the search link off the screen again.
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const navRef = useRef<HTMLUListElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const drawerCloseRef = useRef<HTMLButtonElement>(null)
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const lastYRef = useRef(0)

  // `/` must not read as active for every descendant, so the root is an exact
  // match and everything else also matches its own subtree.
  const isActive = useCallback(
    (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)),
    [pathname]
  )

  /** Closes without moving focus — for a link the user just activated. */
  const dismiss = useCallback(() => {
    setMenuOpen(false)
    setOpenGroup(null)
  }, [])

  /** Closes and hands focus back to the hamburger that opened it. */
  const closeMenu = useCallback(() => {
    dismiss()
    menuButtonRef.current?.focus()
  }, [dismiss])

  // Any navigation dismisses the drawer, so a back/forward step cannot leave it
  // open over the page it just returned to. Adjusting during render rather than
  // in an effect keeps the drawer from painting once on the new route.
  const [lastPath, setLastPath] = useState(pathname)
  if (lastPath !== pathname) {
    setLastPath(pathname)
    if (menuOpen) dismiss()
  }

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenMenu(null)
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
      el.dataset.hidden = y < 90 || openMenu || menuOpen || !goingDown ? 'false' : 'true'
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [openMenu, menuOpen])

  // A panel is anchored to a trigger in a sticky header that slides away on
  // scroll down. Leaving `openMenu` set meant scrolling back up revealed a panel
  // the reader had already scrolled past, still open.
  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    window.addEventListener('scroll', close, { passive: true })
    return () => window.removeEventListener('scroll', close)
  }, [openMenu])

  // Escape has to close a panel from anywhere, including while focus is still on
  // the trigger that opened it. `onMenuKeyDown` only sees keys pressed inside
  // the panel, so without this a keyboard user could open a panel and then have
  // no way to shut it without tabbing into it first.
  useEffect(() => {
    if (!openMenu) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      const key = openMenu
      setOpenMenu(null)
      triggerRefs.current[key]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openMenu])

  // The drawer is modal below 1024px, so it traps Tab, closes on Escape, and
  // hands focus back to the button that opened it. Scrolling the page behind a
  // modal drawer is the other half of that.
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerCloseRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeMenu()
        return
      }
      if (e.key !== 'Tab') return
      const node = drawerRef.current
      if (!node) return
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

    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, closeMenu])

  // Rotating a tablet or widening the window past the breakpoint hides the
  // drawer in CSS, which would otherwise strand `menuOpen === true` and leave
  // the body scroll-locked with no visible control to undo it.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) dismiss()
    }
    onChange(mq as unknown as MediaQueryListEvent)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [dismiss])

  const openPanel = (key: string, focusFirst = false) => {
    setOpenMenu(key)
    if (!focusFirst) return
    requestAnimationFrame(() => {
      panelRefs.current[key]?.querySelector<HTMLElement>('.p-panel-hub')?.focus()
    })
  }

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>('.p-panel-item, .p-panel-hub')
    )
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)
    e.preventDefault()
    let next = 0
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else if (e.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length
    else next = index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <>
      {/* First focusable in the DOM on every public page: the banner, the brand
          link and the drawer trigger all sit between a keyboard user's start
          position and the article. Rendered before the banner so it really is
          first. Every page that mounts this header also carries an
          `id="content"` target for it to jump to. */}
      <a href="#content" className="skip-link">
        Skip to main content
      </a>
      <AnnouncementBanner
        announcement={{
          message: 'Explore the digitised public archive',
          href: '/archives',
          hrefLabel: 'Browse collections',
        }}
      />
      <header ref={headerRef} className="p-header" aria-label="Site">
        <div
          className="p-header-inner"
          style={{ maxWidth: 1180, margin: '0 auto', padding: '0 1.5rem', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}
        >
          <Link href="/" className="p-brand" aria-label="Alban Bagbin Digital Library — home">
            <span className="p-brand-mark" aria-hidden>
              <Landmark size={18} strokeWidth={2.4} />
            </span>
            <span className="p-brand-text">
              <span className="p-brand-word">AlbanBagbin</span>
            </span>
          </Link>

          <nav className="hide-sm" aria-label="Primary">
            <ul className="p-nav" ref={navRef}>
              {PRIMARY_NAV.map(entry => {
                if (entry.kind === 'link') {
                  const active = isActive(entry.href)
                  return (
                    <li key={entry.href} className="p-nav-item" data-active={active ? 'true' : undefined}>
                      <Link href={entry.href} className="p-nav-link" aria-current={active ? 'page' : undefined}>
                        {entry.label}
                      </Link>
                    </li>
                  )
                }

                const { key, label, hub, hubLabel, hubDescription, icon: PanelIcon, items } = entry
                const expanded = openMenu === key
                const active = isActive(hub) || items.some(item => isActive(item.href))

                return (
                  <li
                    key={key}
                    className="p-nav-item"
                    data-active={active ? 'true' : undefined}
                    // Hover opens the panel for a mouse only. A tap fires
                    // pointerenter *and* click, so opening on every pointer
                    // type made the panel appear and vanish again on a tablet.
                    // The bridge in `.p-panel::before` keeps `pointerleave`
                    // from firing while the pointer crosses the gap down.
                    onPointerEnter={e => {
                      if (e.pointerType === 'mouse') openPanel(key)
                    }}
                    onPointerLeave={e => {
                      if (e.pointerType === 'mouse') setOpenMenu(null)
                    }}
                    // Tabbing out of the group closes it, so focus can never
                    // rest on a trigger for a panel that is no longer shown.
                    onBlur={e => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpenMenu(null)
                    }}
                  >
                    {/* One control, not a link beside a chevron. The old
                        split let the pointer land on either half and gave the
                        section two different meanings; the hub is now the
                        panel's own first row, which is unambiguous and one
                        click away. */}
                    <button
                      ref={el => { triggerRefs.current[key] = el }}
                      type="button"
                      className="p-nav-link p-nav-trigger"
                      aria-expanded={expanded}
                      aria-controls={`nav-panel-${key}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => (expanded ? setOpenMenu(null) : openPanel(key))}
                      onKeyDown={e => {
                        if (e.key !== 'ArrowDown') return
                        e.preventDefault()
                        openPanel(key, true)
                      }}
                    >
                      <PanelIcon size={15} aria-hidden className="p-nav-trigger-icon" />
                      {label}
                      <ChevronDown size={13} className="p-nav-chevron" aria-hidden />
                    </button>

                    {expanded && (
                      <div
                        ref={el => { panelRefs.current[key] = el }}
                        id={`nav-panel-${key}`}
                        className="p-panel"
                        role="group"
                        aria-label={label}
                        onKeyDown={onMenuKeyDown}
                      >
                        <Link href={hub} className="p-panel-hub" onClick={() => setOpenMenu(null)}>
                          <span className="p-panel-hub-icon" aria-hidden>
                            <PanelIcon size={16} />
                          </span>
                          <span className="p-panel-text">
                            <span className="p-panel-title">{hubLabel}</span>
                            <span className="p-panel-desc">{hubDescription}</span>
                          </span>
                          <ArrowRight size={15} aria-hidden className="p-panel-arrow" />
                        </Link>

                        <ul className="p-panel-grid">
                          {items.map(item => {
                            const ItemIcon = item.icon
                            const itemActive = isActive(item.href)
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  className="p-panel-item"
                                  aria-current={itemActive ? 'page' : undefined}
                                  onClick={() => setOpenMenu(null)}
                                >
                                  <span className="p-panel-item-icon" aria-hidden>
                                    <ItemIcon size={16} />
                                  </span>
                                  <span className="p-panel-text">
                                    <span className="p-panel-title">{item.label}</span>
                                    <span className="p-panel-desc">{item.description}</span>
                                  </span>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                )
              })}

              <li className="p-nav-item">
                <Link
                  href={ASK_HREF}
                  className="p-nav-cta"
                  aria-current={isActive(ASK_HREF) ? 'page' : undefined}
                >
                  <Sparkles size={14} aria-hidden /> Ask
                </Link>
              </li>
            </ul>
          </nav>

          <div className="p-header-actions">
            <ThemeToggle square />
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
              className="show-sm p-icon-btn"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              title={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
            </button>
          </div>
        </div>

      </header>

      <div
        className={`drawer-backdrop${menuOpen ? ' open' : ''}`}
        onClick={closeMenu}
        aria-hidden
      />
      <div
        ref={drawerRef}
        id="mobile-menu"
        className={`drawer${menuOpen ? ' open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        // Off-canvas while closed: `inert` takes its links out of the tab order
        // and `aria-hidden` keeps them out of the accessibility tree, so neither
        // is reachable behind the closed overlay.
        aria-hidden={menuOpen ? undefined : true}
        inert={!menuOpen ? true : undefined}
      >
        <div className="drawer-head">
          <Link href="/" onClick={dismiss} className="drawer-brand">
            <span className="p-brand-mark" aria-hidden>
              <Landmark size={16} strokeWidth={2.4} />
            </span>
            <span className="drawer-brand-name">AlbanBagbin</span>
          </Link>
          <button ref={drawerCloseRef} type="button" onClick={closeMenu} className="p-icon-btn" aria-label="Close menu">
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="drawer-body">
          {DRAWER_NAV.map(entry => {
            if (entry.kind === 'link') {
              const Icon = DRAWER_ICONS[entry.href] || Home
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={dismiss}
                  className="drawer-link"
                  data-accent={entry.accent || undefined}
                  aria-current={isActive(entry.href) ? 'page' : undefined}
                >
                  <Icon size={17} aria-hidden />
                  <span>{entry.label}</span>
                  {entry.accent && <Sparkles size={13} aria-hidden style={{ marginLeft: 'auto' }} />}
                </Link>
              )
            }

            const { key, label, hub, hubLabel, items } = entry
            const expanded = openGroup === key
            const Icon = DRAWER_ICONS[hub] || entry.icon
            return (
              <Fragment key={key}>
                {/* On a phone the split earns its keep: the label is a large
                    target that goes to the hub and the chevron expands in
                    place beside it. That is a deliberate difference from the
                    desktop trigger, which is a single button — a thumb can hit
                    48px without covering the text, a mouse has no reason to
                    treat the two halves as separate. */}
                <div className="drawer-split" data-open={expanded || undefined}>
                  <Link
                    href={hub}
                    onClick={dismiss}
                    className="drawer-link"
                    aria-current={isActive(hub) ? 'page' : undefined}
                  >
                    <Icon size={17} aria-hidden />
                    <span>{label}</span>
                  </Link>
                  <button
                    type="button"
                    className="drawer-expand"
                    aria-expanded={expanded}
                    aria-controls={`drawer-group-${key}`}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
                    onClick={() => setOpenGroup(expanded ? null : key)}
                  >
                    <ChevronDown size={15} aria-hidden />
                  </button>
                </div>

                {expanded && (
                  <>
                    <ul className="drawer-sublist" id={`drawer-group-${key}`} aria-label={`${label} collections`}>
                      {items.map(item => {
                        const ItemIcon = item.icon
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={dismiss}
                              className="drawer-link"
                              aria-current={isActive(item.href) ? 'page' : undefined}
                            >
                              <ItemIcon size={15} aria-hidden />
                              <span>{item.label}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                    <Link href={hub} onClick={dismiss} className="drawer-subhub">
                      {hubLabel} <ArrowRight size={13} aria-hidden />
                    </Link>
                  </>
                )}
              </Fragment>
            )
          })}

          <hr className="drawer-rule" />

          {/* The per-page filters cover filtering; this is the link to the one
              page that searches the whole library. It lives here rather than
              in the header bar because a field plus a theme toggle plus a
              hamburger is three controls competing for one row on a 375px
              screen, and nothing else on this site needs the width. */}
          <Link href={SEARCH_HREF} onClick={dismiss} className="drawer-link" aria-current={isActive(SEARCH_HREF) ? 'page' : undefined}>
            <Search size={17} aria-hidden />
            <span>Search the library</span>
          </Link>
        </div>
      </div>
    </>
  )
}
