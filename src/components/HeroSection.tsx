'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Landmark, ArrowUpRight, Quote } from 'lucide-react'

export interface HeroStats {
  value: number
  label: string
}

interface HeroSectionProps {
  stats: HeroStats[]
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = value.toLocaleString()
    if (prefersReducedMotion()) return

    let raf = 0
    const start = performance.now()
    const dur = 950
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      el.textContent = Math.round(value * eased).toLocaleString()
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</span>
}

export default function HeroSection({ stats }: HeroSectionProps) {
  const heroRef = useRef<HTMLElement>(null)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const [lit, setLit] = useState(false)

  useEffect(() => {
    if (prefersReducedMotion()) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const heroEl = heroRef.current
        const px = parallaxRef.current
        if (!heroEl || !px) return
        const r = heroEl.getBoundingClientRect()
        if (r.bottom < 0 || r.top > window.innerHeight) return
        const y = (window.innerHeight - r.top) * 0.05
        px.style.transform = `translateY(${Math.max(-16, Math.min(16, y))}px)`
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || prefersReducedMotion()) return
    const el = heroRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--spot-x', `${e.clientX - r.left}px`)
    el.style.setProperty('--spot-y', `${e.clientY - r.top}px`)
    setLit(true)
  }

  return (
    <section
      id="content"
      ref={heroRef}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setLit(false)}
      style={{ position: 'relative', overflow: 'hidden', isolation: 'isolate' }}
    >
      {/* Layer 0 — base wash */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: [
          'radial-gradient(1100px 520px at 82% -8%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 62%)',
          'radial-gradient(820px 460px at 6% 112%, rgba(29,66,137,0.20), transparent 60%)',
          'var(--p-bg)',
        ].join(', '),
      }} />

      {/* Layer 1 — faint archival dot texture */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: 'radial-gradient(color-mix(in srgb, var(--p-text-1) 6%, transparent) 1px, transparent 1.6px)',
        backgroundSize: '26px 26px',
        maskImage: 'radial-gradient(900px 620px at 70% 30%, black, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(900px 620px at 70% 30%, black, transparent 80%)',
      }} />

      {/* Layer 2 — cursor spotlight */}
      <div aria-hidden className={lit ? 'hero-spotlit' : ''}
        style={{
          position: 'absolute', inset: 0, zIndex: 1, opacity: 0, transition: 'opacity 0.35s ease',
          background: 'radial-gradient(520px circle at var(--spot-x, 50%) var(--spot-y, 18%), color-mix(in srgb, var(--primary) 10%, transparent), transparent 66%)',
        }} />

      {/* Layer 3 — oversized year watermark */}
      <div aria-hidden className="hero-watermark" style={{
        position: 'absolute', right: '-2rem', top: '50%', transform: 'translateY(-50%)', zIndex: 0,
        fontFamily: 'var(--font-serif), Georgia, serif', fontWeight: 500, fontStyle: 'italic',
        fontSize: 'clamp(11rem, 26vw, 21rem)', lineHeight: 1, letterSpacing: '-0.02em',
        color: 'color-mix(in srgb, var(--p-text-1) 4%, transparent)', pointerEvents: 'none', userSelect: 'none',
        maskImage: 'linear-gradient(90deg, black 40%, transparent 88%)',
        WebkitMaskImage: 'linear-gradient(90deg, black 40%, transparent 88%)',
      }}>
        1993
      </div>

      <div className="p-hero p-section" style={{
        position: 'relative', zIndex: 2, maxWidth: 1180, margin: '0 auto',
        padding: 'clamp(4.5rem, 9vw, 7rem) 1.5rem clamp(3rem, 6vw, 5rem)',
        display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', alignItems: 'center', gap: '3rem',
      }}>
        {/* ── Copy column ─────────────────────────────── */}
        <div>
          <span className="p-eyebrow hero-rise" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            fontFamily: 'var(--font-mono), monospace', fontSize: '0.625rem', letterSpacing: '0.17em',
            textTransform: 'uppercase', color: 'var(--primary)',
            border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
            background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
            padding: '0.35rem 0.85rem', borderRadius: 999, animationDelay: '60ms',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)' }} />
            Speaker · Eighth Parliament of Ghana
          </span>

          <h1 className="p-hero-title hero-rise" style={{
            animationDelay: '140ms', fontFamily: 'var(--font-display), var(--font-inter), sans-serif',
            fontSize: 'clamp(2.6rem, 6.6vw, 5rem)', lineHeight: 0.92, letterSpacing: '-0.04em',
            fontWeight: 800, margin: '1.5rem 0 1.25rem', color: 'var(--p-text-1)',
          }}>
            The digital library
            <br />
            of{' '}
            <span className="hero-shimmer" style={{
              fontFamily: 'var(--font-serif), Georgia, serif',
              fontStyle: 'italic', fontWeight: 520,
              fontSize: '0.94em', lineHeight: 1.08, letterSpacing: '-0.01em',
              background: 'linear-gradient(92deg, var(--shimmer-a) 0%, var(--shimmer-b) 38%, var(--shimmer-c) 55%, var(--shimmer-d) 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              backgroundSize: '200% 100%',
            }}>
              Rt. Hon. Alban Bagbin
            </span>
          </h1>

          <p className="hero-rise" style={{
            animationDelay: '220ms', fontSize: '1.0625rem', lineHeight: 1.65, color: 'var(--p-text-2)',
            maxWidth: '34rem', margin: '0 0 2rem',
          }}>
            Speeches, public papers, interviews, letters, photographs and milestones from a thirty-year career —
            indexed, dated and preserved as the living record of Ghana&apos;s eighth Speaker.
          </p>

          <div className="p-cta-buttons hero-rise" style={{ animationDelay: '300ms', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            <Link href="/archives" className="hero-cta" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)',
              color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 600, padding: '0.8rem 1.5rem',
              borderRadius: 999, fontSize: '0.9375rem', minHeight: 44,
            }}>
              Explore the archives <ArrowUpRight size={16} />
            </Link>
            <Link href="/the-man" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--p-text-2)',
              textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', padding: '0.5rem 0.35rem',
              minHeight: 44, transition: 'color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--p-text-1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--p-text-2)')}>
              The Man <ArrowUpRight size={14} style={{ color: 'var(--primary)' }} />
            </Link>
          </div>

          <div className="p-hero-facts hero-rise" style={{ animationDelay: '380ms', display: 'flex', flexWrap: 'wrap', gap: '2.25rem', marginTop: '2.75rem' }}>
            {stats.map(s => (
              <div key={s.label}>
                <div style={{ fontWeight: 800, fontSize: '1.55rem', color: 'var(--primary)', fontFamily: 'var(--font-display), sans-serif', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  <CountUp value={s.value} />
                </div>
                <div style={{ fontSize: '0.66rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: '0.3rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Portrait column ─────────────────────────── */}
        <div className="hero-float" style={{ position: 'relative', justifySelf: 'center', width: '100%', maxWidth: 420, display: 'flex', justifyContent: 'center', animationDelay: '200ms' }}>
          <div ref={parallaxRef} style={{ transition: 'transform 0.15s ease-out' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
              <div style={{ padding: 10, borderRadius: '210px 210px 20px 20px', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', boxShadow: 'var(--p-shadow), 0 0 0 1px color-mix(in srgb, var(--primary) 22%, transparent)' }}>
                <Image
                  src="/images/bagbin-speaker.jpg"
                  alt="Alban Bagbin, Speaker of the Parliament of Ghana"
                  width={779}
                  height={917}
                  priority
                  sizes="(max-width: 640px) 88vw, 400px"
                  style={{ width: '100%', aspectRatio: '4/5', objectFit: 'cover', borderRadius: '200px 200px 12px 12px', display: 'block' }}
                />
              </div>

              <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.625rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--p-text-4)', marginTop: '0.85rem', textAlign: 'center' }}>
                Alban Sumana Kingsford Bagbin · MP since 1993
              </div>

              <div aria-hidden className="hero-stamp" style={{ position: 'absolute', left: -26, bottom: 44, zIndex: 3 }}>
                <div style={{ width: 92, height: 92, borderRadius: '50%', border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)', background: 'color-mix(in srgb, var(--p-surface) 78%, transparent)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 100 100" width={92} height={92} style={{ position: 'absolute', color: 'var(--primary)' }}>
                    <defs>
                      <path id="stamp-circle" d="M50,50 m-36,0 a36,36 0 1,1 72,0 a36,36 0 1,1 -72,0" />
                    </defs>
                    <text style={{ fontSize: 8.6, letterSpacing: 1.6 }} fill="currentColor">
                      <textPath href="#stamp-circle">THE DIGITAL LIBRARY · ALBAN BAGBIN · EST 1993</textPath>
                    </text>
                  </svg>
                  <Landmark size={16} strokeWidth={2.2} style={{ color: 'var(--primary)' }} />
                </div>
              </div>

              <div style={{ position: 'absolute', bottom: 78, left: '50%', transform: 'translateX(-50%)', width: '82%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'color-mix(in srgb, var(--p-surface-2) 84%, transparent)', backdropFilter: 'blur(12px)', border: '1px solid var(--p-border-3)', borderRadius: 12, padding: '0.7rem 1rem', boxShadow: 'var(--p-shadow)' }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Speaker since</div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--p-text-1)' }}>7 January 2021</div>
                </div>
                <Quote size={20} style={{ color: 'var(--primary)' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
      <div aria-hidden className="hero-scrollcue" style={{ position: 'absolute', left: '50%', bottom: '1.4rem', transform: 'translateX(-50%)', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.58rem', fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--p-text-4)' }}>Scroll</span>
        <span className="hero-scrollcue-line" style={{ width: 1, height: 34, background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary) 70%, transparent), transparent)' }} />
      </div>
    </section>
  )
}