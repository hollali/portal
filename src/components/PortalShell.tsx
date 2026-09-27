'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { ToastProvider } from '@/components/ui/Toast'

const DESKTOP_QUERY = '(min-width: 768px)'

/**
 * Client boundary for the portal shell. Keeps `layout.tsx` a server component
 * while owning the three pieces of cross-cutting state the chrome needs:
 * the toast queue, the mobile nav drawer, and whether we are on desktop.
 *
 * The drawer lives here rather than in `Sidebar` so the Topbar's menu button
 * and the Sidebar share one `open` flag — previously both rendered their own
 * hamburger and they could disagree.
 */
export default function PortalShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const shellRef = useRef<HTMLDivElement>(null)

  // Track the desktop breakpoint so the drawer is never opened on a wide
  // viewport, and never trapped there.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const onChange = () => {
      setIsDesktop(mq.matches)
      if (mq.matches) setNavOpen(false)
    }
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Close the drawer on navigation.
  useEffect(() => {
    const close = () => setNavOpen(false)
    window.addEventListener('popstate', close)
    return () => window.removeEventListener('popstate', close)
  }, [])

  // Lock body scroll while the drawer covers the page.
  useEffect(() => {
    if (!navOpen || isDesktop) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [navOpen, isDesktop])

  const closeNav = useCallback(() => setNavOpen(false), [])

  return (
    <ToastProvider>
      <div ref={shellRef} className="portal-shell">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>

        <Sidebar open={navOpen} isDesktop={isDesktop} onClose={closeNav} />

        <div className="portal-shell__body">
          <Topbar onOpenNav={() => setNavOpen(true)} isDesktop={isDesktop} />
          <main id="main" tabIndex={-1} className="page-enter portal-shell__main">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
