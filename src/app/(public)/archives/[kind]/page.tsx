import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Download, FileText, Mic, MessagesSquare, ScrollText, SearchX } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { LIST_ROUTE_KINDS, KIND_CONFIG, type ArchiveKind, type ListRouteKind } from '@/lib/library'
import { getLibraryCounts } from '@/lib/libraryQueries'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ kind: string }>
  searchParams: Promise<{ q?: string; year?: string; theme?: string }>
}

const KIND_ICON: Record<string, React.ElementType> = {
  speech: Mic,
  paper: FileText,
  interview: MessagesSquare,
  note: ScrollText,
  letter: ScrollText,
  memo: ScrollText,
}

const LIST_COPY: Record<ListRouteKind, { eyebrow: string; heading: string; sub: string }> = {
  speeches: { eyebrow: 'Archive · Speeches', heading: 'Speeches & addresses', sub: 'Parliamentary contributions and public addresses — the Speaker in his own words.' },
  papers: { eyebrow: 'Archive · Public Papers', heading: 'Public papers', sub: 'Policy essays, presentations and writings contributed to national and international discourse.' },
  interviews: { eyebrow: 'Archive · Interviews', heading: 'Interviews', sub: 'Interviews and press engagements in which he addresses the issues of the day.' },
  notes: { eyebrow: 'Archive · Notes & Correspondence', heading: 'Notes & correspondence', sub: 'Memos, letters and official correspondence — including notices recalling Parliament — written on key national issues.' },
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind } = await params
  const listKind = kind as ListRouteKind
  if (!LIST_ROUTE_KINDS[listKind]) return { title: 'Not Found' }
  return { title: LIST_COPY[listKind].heading, description: LIST_COPY[listKind].sub }
}

export default async function ArchiveListPage({ params, searchParams }: Props) {
  const { kind } = await params
  const sp = await searchParams
  const listKind = kind as ListRouteKind
  const kinds = LIST_ROUTE_KINDS[listKind]
  if (!kinds) notFound()

  const copy = LIST_COPY[listKind]
  const q = sp.q?.trim() || ''
  const year = sp.year?.trim() || ''
  const theme = sp.theme?.trim() || ''

  const where: {
    status: string
    kind: { in: ArchiveKind[] }
    OR?: Record<string, unknown>[]
    year?: number
    theme?: string
  } = { status: 'published', kind: { in: kinds } }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { excerpt: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
      { event: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
      { person: { contains: q, mode: 'insensitive' } },
      { institution: { contains: q, mode: 'insensitive' } },
      { theme: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (year) where.year = parseInt(year) || undefined
  if (theme) where.theme = theme

  const [items, counts, years] = await Promise.all([
    prisma.archiveItem.findMany({ where, orderBy: [{ year: 'desc' }, { date: 'desc' }, { updatedAt: 'desc' }] }),
    getLibraryCounts(),
    prisma.archiveItem.findMany({ where: { status: 'published', kind: { in: kinds }, year: { not: null } }, distinct: ['year'], select: { year: true }, orderBy: { year: 'desc' } }),
  ])

  const themes = Array.from(new Set(items.map(i => i.theme).filter((t): t is string => !!t))).slice(0, 12)
  const marginCount = counts.speeches + counts.papers + counts.interviews + counts.notes

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>{copy.eyebrow}</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 0.75rem', color: 'var(--p-text-1)' }}>{copy.heading}</h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '36rem', margin: 0 }}>{copy.sub}</p>
        </div>
      </section>

      <section className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem' }}>
        {/* Filters */}
        <form method="get" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
          <input name="q" defaultValue={q} placeholder="Search in this collection…"
            style={{ flex: 1, minWidth: 220, background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.6rem 1.1rem', color: 'var(--p-text-1)', fontSize: '0.9rem', outline: 'none' }} />
          <select name="year" defaultValue={year} style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.6rem 1.1rem', color: 'var(--p-text-1)', fontSize: '0.875rem', outline: 'none' }}>
            <option value="">All years</option>
            {years.filter(y => y.year !== null).map(y => <option key={y.year} value={y.year!}>{y.year}</option>)}
          </select>
          {themes.length > 0 && (
            <select name="theme" defaultValue={theme} style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.6rem 1.1rem', color: 'var(--p-text-1)', fontSize: '0.875rem', outline: 'none' }}>
              <option value="">All themes</option>
              {themes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button type="submit" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', borderRadius: 999, padding: '0.6rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Filter</button>
          {(q || year || theme) && <Link href={`/archives/${kind}`} style={{ alignSelf: 'center', fontSize: '0.8125rem', color: 'var(--p-text-3)' }}>Clear</Link>}
        </form>

        {/* Other collections quick-links */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
          {(Object.keys(LIST_ROUTE_KINDS) as ListRouteKind[]).map(k => {
            const active = k === kind
            return (
              <Link key={k} href={`/archives/${k}`} style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? 'var(--primary-fg)' : 'var(--p-text-3)', textDecoration: 'none', background: active ? 'var(--primary)' : 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 999, padding: '0.35rem 0.85rem' }}>
                {LIST_COPY[k].heading.replace(' & ', ' & ')}
              </Link>
            )
          })}
          <Link href="/archives/milestones" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--p-text-3)', textDecoration: 'none', background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 999, padding: '0.35rem 0.85rem' }}>Milestones</Link>
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed var(--p-border)', borderRadius: 16 }}>
            <SearchX size={32} style={{ color: 'var(--p-text-4)' }} />
            <p style={{ color: 'var(--p-text-3)', margin: '1rem 0 0' }}>No items found{ q ? ` for “${q}”` : '' }. Check back as the archive is digitised.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
            {items.map(item => {
              const Icon = KIND_ICON[item.kind] || FileText
              const cfg = KIND_CONFIG[item.kind as ArchiveKind]
              return (
                <Link key={item.id} href={`/archives/${kind}/${item.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="p-card-lift" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.4rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.6875rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
                        <Icon size={13} /> {cfg?.label || item.kind}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace' }}>{item.date || item.year || ''}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif', lineHeight: 1.35, marginBottom: '0.5rem' }}>{item.title}</div>
                    {item.excerpt && (
                      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--p-text-3)', lineHeight: 1.6, flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.excerpt}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.9rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {[item.event, item.location, item.theme].filter(Boolean).slice(0, 2).map(f => (
                          <span key={f} style={{ fontSize: '0.66rem', color: 'var(--p-text-3)', border: '1px solid var(--p-border-2)', background: 'var(--p-surface-2)', borderRadius: 999, padding: '0.15rem 0.55rem' }}>{f}</span>
                        ))}
                      </div>
                      {item.filePath && <Download size={14} style={{ color: 'var(--p-text-4)' }} />}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <p style={{ marginTop: '2.5rem', fontSize: '0.8rem', color: 'var(--p-text-4)' }}>
          This collection currently holds items marked as {kinds.map(k => KIND_CONFIG[k as ArchiveKind].label.toLowerCase()).join(', ')}. Other documents live across the {marginCount} records of the Digital Archives.
        </p>
      </section>

      <PublicFooter />
    </div>
  )
}