import type { Metadata } from 'next'
import { Quote, User } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Testimonials · AlbanBagbin Archives',
  description: 'What prominent figures in Ghana and the world have said of Rt. Hon. Alban Bagbin.',
}

export default async function TestimonialsPage() {
  const items = await prisma.testimonial.findMany({
    where: { status: 'published' },
    orderBy: [{ sortOrder: 'asc' }, { year: 'desc' }],
  })

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Archive · Testimonials</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>What others have said</h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '38rem', margin: 0 }}>
            Tributes and assessments from prominent figures and institutions in Ghana and the world.
          </p>
        </div>
      </section>

      <section className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        {items.length === 0 && (
          <p style={{ color: 'var(--p-text-3)' }}>Testimonials are being compiled. Check back soon.</p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
          {items.map(t => (
            <figure key={t.id} className="p-card" style={{ margin: 0, border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.6rem', display: 'flex', flexDirection: 'column' }}>
              <Quote size={22} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
              <blockquote style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--p-text-1)', fontStyle: 'italic', flex: 1 }}>&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--p-border-2)' }}>
                {t.photoUrl ? (
                  <img src={t.photoUrl} alt={t.author} width={42} height={42} style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--p-border-3)' }} />
                ) : (
                  <span style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p-text-4)' }}><User size={18} /></span>
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--p-text-1)' }}>{t.author}</div>
                  {t.role && <div style={{ fontSize: '0.72rem', color: 'var(--p-text-3)', lineHeight: 1.4 }}>{t.role}</div>}
                  {t.year && <div style={{ fontSize: '0.62rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace', marginTop: '0.15rem' }}>{t.year}{t.source ? ` · ${t.source}` : ''}</div>}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}