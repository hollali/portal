import Link from 'next/link'
import type { Metadata } from 'next'
import { BadgeCheck, Milestone as MilestoneIcon, Star } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Milestones · AlbanBagbin Archives',
  description: 'The landmark moments of a thirty-year public career.',
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType }> = {
  'early-life': { label: 'Early Life', icon: Star },
  education: { label: 'Education', icon: Star },
  career: { label: 'Career & Politics', icon: MilestoneIcon },
  parliament: { label: 'Parliament', icon: BadgeCheck },
  national: { label: 'National Service', icon: BadgeCheck },
}

export default async function MilestonesPage() {
  const rows = await prisma.milestone.findMany({
    where: { status: 'published' },
    orderBy: [{ year: 'asc' }, { order: 'asc' }],
  })

  const categoryOrder = ['early-life', 'education', 'career', 'parliament', 'national']
  const groups = categoryOrder
    .map(cat => ({ cat, entries: rows.filter(r => (r.category || 'career') === cat) }))
    .filter(g => g.entries.length > 0)

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Archive · Milestones</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>Milestones of a public career</h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '38rem', margin: 0 }}>
            From the fields of Sombo to the Speaker&apos;s chair — the moments, elections, appointments and rulings that mark thirty years of service. See the full chronological view on the <Link href="/timeline" style={{ color: 'var(--primary)' }}>timeline</Link>.
          </p>
        </div>
      </section>

      <section className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        {groups.length === 0 && (
          <p style={{ color: 'var(--p-text-3)' }}>Milestones are being compiled. Check back soon.</p>
        )}
        {groups.map(group => {
          const meta = CATEGORY_META[group.cat] || CATEGORY_META.career
          const Icon = meta.icon
          return (
            <div key={group.cat} style={{ marginBottom: '3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                  <Icon size={18} />
                </span>
                <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: '1.35rem', letterSpacing: '-0.02em', margin: 0, color: 'var(--p-text-1)' }}>{meta.label}</h2>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
                {group.entries.map(m => (
                  <div key={m.id} className="p-card" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{m.year}</span>
                      {m.period && <span style={{ fontSize: '0.68rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace' }}>{m.period}</span>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)', lineHeight: 1.35, marginBottom: '0.4rem' }}>{m.title}</div>
                    {m.description && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--p-text-2)', lineHeight: 1.6 }}>{m.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <PublicFooter />
    </div>
  )
}