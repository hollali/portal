import type { Metadata } from 'next'
import Link from 'next/link'
import { Landmark, Scale, Vote, BookOpenCheck, Timer, ScrollText, Mic as MicIcon, ArrowUpRight, Quote, Building2, Scale3d } from 'lucide-react'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { prisma } from '@/lib/prisma'
import { getLibraryCounts } from '@/lib/libraryQueries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Parliamentary Legacy',
  description: 'The constitutional battles, landmark rulings and institutional reforms of Rt. Hon. Alban Bagbin as the Speaker of the 8th Parliament.',
}

const RULINGS = [
  { title: 'A Speaker for the whole House', tag: 'Independence', note: 'As the 8th Parliament opened with an evenly-balanced House, the Speaker declared himself the servant of the entire membership — not any single caucus — and rebuilt the legitimacy of the Chair around that neutrality.' },
  { title: 'Funding without subservience', tag: 'Separation of powers', note: 'The push for an independently-funded legislature — one that can oversee the Executive without depending on it for its own budget — became a defining constitutional project of the Speakership.' },
  { title: 'Recalling the House', tag: 'Constitutional power', note: 'Recalled an adjourned Parliament under the provisions of Article 112(3) of the Constitution, a rarely-used power asserted to bring the House back for urgent national business.' },
  { title: 'The two-party floor', tag: 'Even balance', note: 'Steered an unprecedented statistical tie in the House — 137 to 137 — through rules and improvisation that safeguarded the authority of the Chamber while keeping government business moving.' },
]

export default async function ParliamentPage() {
  const [items, milestones] = await Promise.all([
    prisma.archiveItem.findMany({
      where: { status: 'published', kind: { in: ['speech', 'paper'] } },
      orderBy: [{ year: 'desc' }, { id: 'desc' }], take: 6,
    }),
    prisma.milestone.findMany({
      where: { status: 'published', category: { in: ['parliament', 'career'] } },
      orderBy: [{ year: 'asc' }, { order: 'asc' }],
    }),
  ])

  const counts = await getLibraryCounts()

  const legacyDocs = items.filter(i => /parliament/i.test(i.institution || '') || /parliament/i.test(i.parliament || '') || /Speaker/i.test(i.title || '')).slice(0, 8)

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Parliament · The 8th House</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 1rem', color: 'var(--p-text-1)' }}>
            A Parliament that stands its ground
          </h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.65, color: 'var(--p-text-2)', maxWidth: '38rem', margin: 0 }}>
            From an evenly-balanced House to landmark rulings on the independence of the legislature — the parliamentary record of a Speaker who believed the House belongs to the people it serves.
          </p>
        </div>
      </section>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem' }}>
        {/* ── Signature rulings ── */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>The record of the chair</span>
              <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', letterSpacing: '-0.02em', margin: '0.5rem 0 0' }}>Signature rulings</h2>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))', gap: '1rem' }}>
            {RULINGS.map(r => (
              <div key={r.title} style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.35rem', height: '100%' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.6875rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary)' }}>
                  <Scale size={13} /> {r.tag}
                </span>
                <div style={{ fontWeight: 700, fontFamily: 'var(--font-display), sans-serif', fontSize: '1.02rem', color: 'var(--p-text-1)', margin: '0.5rem 0' }}>{r.title}</div>
                <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--p-text-3)' }}>{r.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Legacy documents ── */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>In the record</span>
              <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', letterSpacing: '-0.02em', margin: '0.5rem 0 0' }}>Documents of the House</h2>
            </div>
          </div>
          {legacyDocs.length === 0 ? (
            <p style={{ color: 'var(--p-text-3)' }}>Parliamentary documents are being digitised — check the archives soon.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {legacyDocs.map(item => (
                <Link key={item.id} href={`/archives/${item.kind === 'note' || item.kind === 'letter' || item.kind === 'memo' ? 'notes' : `${item.kind}s`}/${item.slug}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid var(--p-border)' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                    <ScrollText size={18} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--primary)' }}>{item.theme || item.kind}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--p-text-4)' }}>{item.year}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.97rem', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif' }}>{item.title}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Parliamentary milestones ── */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Milestones</span>
              <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', letterSpacing: '-0.02em', margin: '0.5rem 0 0' }}>A Speaker&apos;s years in the House</h2>
            </div>
            <Link href="/archives/milestones" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600 }}>All milestones <ArrowUpRight size={14} style={{ color: 'var(--primary)' }} /></Link>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 9, top: 8, bottom: 8, width: 1, background: 'var(--p-border-3)' }} />
            {milestones.slice(0, 12).map(m => (
              <div key={m.id} style={{ position: 'relative', padding: '0 0 1.75rem 2.75rem' }}>
                <span style={{ position: 'absolute', left: 0, top: 4, width: 20, height: 20, borderRadius: 999, border: '3px solid var(--p-surface)', background: 'var(--primary)', boxShadow: '0 0 0 2px var(--p-border-3)' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{m.year}</span>
                  <span style={{ fontWeight: 700, color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif' }}>{m.title}</span>
                </div>
                {m.description && <p style={{ margin: '0.3rem 0 0', fontSize: '0.84rem', color: 'var(--p-text-3)', lineHeight: 1.6 }}>{m.description}</p>}
              </div>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}