'use client'

import { useEffect, useRef, useState } from 'react'
import { Quote } from 'lucide-react'

const AUTOPLAY_MS = 9700

export interface TestimonialQuote {
  quote: string
  attribution?: string | null
  role?: string | null
}

export default function TestimonialCarousel({ quotes }: { quotes: TestimonialQuote[] }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduced = useRef(false)

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  useEffect(() => {
    if (paused || reduced.current || quotes.length <= 1) return
    const t = window.setInterval(() => setActive(a => (a + 1) % quotes.length), AUTOPLAY_MS)
    return () => window.clearInterval(t)
  }, [paused, quotes.length])

  const quote = quotes[active]
  if (!quote) return null

  return (
    <div
      className="testimonial-paused"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>
        <Quote size={13} /> Testimonials
      </span>

      <blockquote style={{ margin: '1rem 0 0', fontSize: 'clamp(1.1rem, 2.4vw, 1.45rem)', lineHeight: 1.55, color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif' }}>
        {quote.quote}
      </blockquote>
      {quote.attribution && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--p-text-3)' }}>
          <span style={{ fontWeight: 700, color: 'var(--p-text-2)' }}>{quote.attribution}</span>
          {quote.role ? <span> — {quote.role}</span> : null}
        </div>
      )}

      <div role="tablist" aria-label="Testimonials" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        {quotes.map((q, i) => {
          const isActive = i === active
          return (
            <button
              key={i}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(i)}
              style={{
                position: 'relative',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono), monospace',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.5rem 0.75rem',
                borderRadius: 999,
                background: isActive ? 'var(--primary)' : 'var(--p-surface)',
                color: isActive ? 'var(--primary-fg)' : 'var(--p-text-3)',
                border: '1px solid var(--p-border)',
              }}
            >
              {String(i + 1).padStart(2, '0')}
              {isActive && (
                <span
                  key={i}
                  className="carousel-countdown"
                  style={{ position: 'absolute', left: '20%', right: '20%', bottom: -6, height: 2, background: 'var(--primary)', transformOrigin: 'left', borderRadius: 2 }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}