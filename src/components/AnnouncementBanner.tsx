'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, X, ArrowRight } from 'lucide-react'

const STORAGE_KEY = 'ab-announcement-dismissed'

interface Announcement {
  message: string
  href: string
  hrefLabel: string
}

export default function AnnouncementBanner({ announcement }: { announcement: Announcement }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (localStorage.getItem(STORAGE_KEY) === '1') setVisible(false)
      } catch {
        // storage blocked — keep the banner visible (fail-open)
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Announcement"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
        padding: '0.55rem 1.5rem',
        background: 'var(--p-surface-3)',
        borderBottom: '1px solid var(--p-border)',
        fontSize: '0.8125rem',
        color: 'var(--p-text-2)',
      }}
    >
      <Megaphone size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
      <span>{announcement.message}</span>
      <Link
        href={announcement.href}
style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
        >
          {announcement.hrefLabel} <ArrowRight size={14} />
      </Link>
      <button
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, '1')
          } catch {
            // ignore
          }
          setVisible(false)
        }}
        aria-label="Dismiss announcement"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--p-text-4)', padding: '0.15rem', display: 'inline-flex' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}