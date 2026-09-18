'use client'

import { useEffect, useState } from 'react'
import type { ManSection } from '@/lib/man'

export default function ChapterNav({ sections }: { sections: ManSection[] }) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '')

  useEffect(() => {
    const targets = sections
      .map(s => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId((entry.target as HTMLElement).id)
        }
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 },
    )
    targets.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav
      aria-label="Chapters"
      className="p-toc"
      style={{ position: 'sticky', top: 96, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.625rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--p-text-4)', padding: '0 0.25rem' }}>
        Chapters
      </span>
      {sections.map((s, i) => {
        const active = s.id === activeId
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            aria-current={active ? 'true' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.55rem 0.8rem',
              borderRadius: 10,
              textDecoration: 'none',
              background: active ? 'var(--primary)' : 'var(--p-surface)',
              color: active ? 'var(--primary-fg)' : 'var(--p-text-2)',
              border: '1px solid var(--p-border)',
              fontSize: '0.8125rem',
              fontWeight: 600,
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', opacity: 0.75 }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            {s.title}
          </a>
        )
      })}
    </nav>
  )
}