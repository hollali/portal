import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Timeline · AlbanBagbin',
  description: 'A chronological view of the life and public career of Rt. Hon. Alban Bagbin.',
}

const CATEGORY_LABEL: Record<string, string> = {
  'early-life': 'Early Life',
  education: 'Education',
  career: 'Career & Politics',
  parliament: 'Parliament',
  national: 'National Service',
}

export default async function TimelinePage() {
  const rows = await prisma.milestone.findMany({
    where: { status: 'published' },
    orderBy: [{ year: 'asc' }, { order: 'asc' }],
  })

  const entries = rows.map(r => ({
    ...r,
    period: r.period || r.year,
    label: CATEGORY_LABEL[r.category || 'career'] || 'Career',
  }))

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Timeline</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>A life in chronological order</h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '38rem', margin: 0 }}>
            From 1957 to the Speaker&apos;s chair — the full arc. Corresponding documents live in the <Link href="/archives" style={{ color: 'var(--primary)' }}>archives</Link>.
          </p>
        </div>
      </section>

      <section className="p-section" style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        {entries.length === 0 && (
          <p style={{ color: 'var(--p-text-3)' }}>The timeline is being compiled. Check back soon.</p>
        )}
        <div style={{ position: 'relative', paddingLeft: '2.25rem' }}>
          <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'var(--p-border)' }} />
          {entries.map(e => (
            <div key={e.id} className="stagger-item" style={{ position: 'relative', marginBottom: '2.25rem' }}>
              <span style={{ position: 'absolute', left: '-2.25rem', top: 4, width: 16, height: 16, borderRadius: '50%', background: 'var(--primary)', border: '3px solid var(--p-bg)', boxShadow: '0 0 0 2px var(--p-border-3)' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.4rem' }}>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary)' }}>{e.year}</span>
                <span style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--p-text-4)' }}>{e.label}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)', marginBottom: '0.35rem' }}>{e.title}</div>
              {e.description && <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--p-text-2)', lineHeight: 1.7, maxWidth: '36rem' }}>{e.description}</p>}
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}