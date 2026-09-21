import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowUpRight, Compass } from 'lucide-react'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { prisma } from '@/lib/prisma'
import { CORE_THEMES, resolveThemeSlug, archiveRouteForKind } from '@/lib/library'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Themes & Ideas · AlbanBagbin',
  description: 'The core themes and ideas of Rt. Hon. Alban Bagbin — explored through his speeches, papers, interviews and correspondence.',
}

interface ThemeStat {
  label: string
  routes: string[]
  count: number
}

export default async function ThemesPage() {
  const rows = await prisma.archiveItem.findMany({
    where: { status: 'published', theme: { not: null } },
    select: { theme: true, kind: true },
    orderBy: { year: 'desc' },
  })

  const bySlug: Record<string, ThemeStat> = {}
  for (const r of rows) {
    const slug = resolveThemeSlug(r.theme)
    if (!slug) continue
    if (!bySlug[slug]) bySlug[slug] = { label: r.theme!, routes: [], count: 0 }
    bySlug[slug].count++
    const route = archiveRouteForKind(r.kind)
    if (!bySlug[slug].routes.includes(route)) bySlug[slug].routes.push(route)
  }

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <section id="content" style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>The man · Ideas</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 0.75rem', color: 'var(--p-text-1)' }}>
            Themes &amp; <span className="p-serif">ideas</span>
          </h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '40rem', margin: 0 }}>
            The strands that run through a public career — from the independence of Parliament to poverty reduction and pan-Africanism. Browse each theme through the speeches, papers, interviews and correspondence that give it voice.
          </p>
        </div>
      </section>

      <section className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
          {CORE_THEMES.map(theme => {
            const stat = bySlug[theme.slug]
            const count = stat?.count ?? 0
            const href = stat ? `/archives/${stat.routes[0]}?theme=${encodeURIComponent(stat.label)}` : null
            const card = (
              <div className="p-card-lift" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <Compass size={20} />
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.875rem', fontWeight: 700, color: count > 0 ? 'var(--p-text-2)' : 'var(--p-text-4)' }}>
                    {count.toLocaleString()} {count === 1 ? 'record' : 'records'} {count > 0 && <ArrowUpRight size={14} style={{ color: 'var(--primary)' }} />}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.625rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.4rem' }}>{theme.motto}</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)', marginBottom: '0.4rem' }}>{theme.name}</div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--p-text-3)', lineHeight: 1.6, flex: 1 }}>{theme.description}</p>
                {count > 0 && stat && (
                  <div style={{ marginTop: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {stat.routes.map(r => (
                      <span key={r}
                        style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--p-text-3)', border: '1px solid var(--p-border-2)', background: 'var(--p-surface-2)', borderRadius: 999, padding: '0.2rem 0.6rem' }}>
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
            return href ? (
              <Link key={theme.slug} href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{card}</Link>
            ) : (
              <div key={theme.slug}>{card}</div>
            )
          })}
        </div>

        <p style={{ marginTop: '2.5rem', fontSize: '0.8rem', color: 'var(--p-text-4)' }}>
          Themes are mapped as the archive is digitised — collections grow as speeches, papers, interviews and correspondence are added and tagged.
        </p>
      </section>

      <PublicFooter />
    </div>
  )
}