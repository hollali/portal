import Link from 'next/link'
import { ArrowDown, Landmark, Quote } from 'lucide-react'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { MAN_SECTIONS } from '@/lib/man'

export const dynamic = 'force-dynamic'

export default function TheManPage() {
  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      {/* Page hero */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3.5rem, 7vw, 5.5rem) 1.5rem', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', alignItems: 'center', gap: '3rem' }} className="p-hero">
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '0.375rem 0.75rem', borderRadius: 999 }}>
              <Landmark size={12} /> The Man
            </span>
            <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.5rem, 6vw, 4rem)', letterSpacing: '-0.035em', lineHeight: 1.02, fontWeight: 800, margin: '1.25rem 0', color: 'var(--p-text-1)' }}>
              The life of a
              <br />
              <span style={{ background: 'linear-gradient(90deg,#f9d06b,#f2a900,#bf7f00)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>servant-leader</span>
            </h1>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '36rem', margin: 0 }}>
              Born in the fields of Sombo, schooled by dedication, called to the Bar, and returned to the people — four chapters trace the man behind the Speaker&apos;s chair.
            </p>
            <div style={{ marginTop: '1.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {MAN_SECTIONS.map(s => (
                <a key={s.id} href={`#${s.id}`} className="p-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--p-text-2)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, border: '1px solid var(--p-border)', borderRadius: 999, padding: '0.5rem 1rem' }}>
                  {s.title} <ArrowDown size={13} />
                </a>
              ))}
            </div>
          </div>
          <div style={{ justifySelf: 'center' }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/8/8b/Speaker_Alban_Bagbin-2_%28cropped%29.jpg"
              alt="Portrait of Alban Bagbin"
              width={380}
              height={470}
              style={{ width: '100%', maxWidth: 380, borderRadius: 16, objectFit: 'cover', aspectRatio: '4/5', border: '1px solid var(--p-border-3)', boxShadow: 'var(--p-shadow)' }}
            />
            <div style={{ marginTop: '0.75rem', padding: '1rem 1.25rem', border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 12, maxWidth: 380 }}>
              <Quote size={16} style={{ color: 'var(--primary)' }} />
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--p-text-2)', fontStyle: 'italic' }}>
                &ldquo;Born a fourth of nine children to peasant farmers, I know the meaning of hard work, of family and of the dignity of every Ghanaian.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sections */}
      {MAN_SECTIONS.map(s => (
        <section key={s.id} id={s.id} style={{ borderBottom: '1px solid var(--p-border)', background: s.id === 'education' ? 'var(--p-surface-3)' : undefined }}>
          <div className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3.5rem, 7vw, 5.5rem) 1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: '3rem' }} className="grid-2-sm">
              <div>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>{s.eyebrow}</span>
                <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 1rem', color: 'var(--p-text-1)' }}>{s.title}</h2>
                <p style={{ color: 'var(--p-text-2)', lineHeight: 1.7, fontSize: '0.98rem', margin: 0 }}>{s.intro}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {s.items.map((item, i) => (
                  <div key={item.title} className="p-card" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 12, padding: '1.25rem 1.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', color: 'var(--p-text-4)', whiteSpace: 'nowrap' }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ fontWeight: 700, fontSize: '1.02rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)' }}>{item.title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--p-text-2)' }}>{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Explore band */}
      <section className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
        <div style={{ borderRadius: 20, border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)', background: 'var(--p-cta-bg)', padding: 'clamp(2rem, 4vw, 3rem)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Continue exploring</span>
            <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', letterSpacing: '-0.03em', margin: '0.75rem 0 0', color: 'var(--p-text-1)' }}>Read him in his own words</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <Link href="/archives/speeches" style={{ background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 600, padding: '0.75rem 1.4rem', borderRadius: 999, fontSize: '0.9rem' }}>Browse speeches</Link>
            <Link href="/archives/notes" style={{ border: '1px solid color-mix(in srgb, var(--foreground) 25%, transparent)', color: 'var(--p-text-1)', textDecoration: 'none', fontWeight: 600, padding: '0.75rem 1.4rem', borderRadius: 999, fontSize: '0.9rem' }}>Notes & correspondence</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}