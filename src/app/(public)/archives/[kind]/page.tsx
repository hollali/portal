import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Download, FileText, SearchX } from 'lucide-react'
import { KIND_ICON } from '@/lib/kindIcon'
import { prisma } from '@/lib/prisma'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { LIST_ROUTE_KINDS, KIND_CONFIG, type ArchiveKind, type ListRouteKind } from '@/lib/library'
import { getLibraryCounts } from '@/lib/libraryQueries'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ kind: string }>
  searchParams: Promise<{ q?: string; year?: string; theme?: string; occasion?: string; parliament?: string }>
}

const LIST_COPY: Record<ListRouteKind, { eyebrow: string; heading: string; sub: string; noun: string; plural: string }> = {
  speeches: { eyebrow: 'Archive · Speeches', heading: 'Speeches & addresses', sub: 'Parliamentary contributions and public addresses — the Speaker in his own words.', noun: 'speech', plural: 'speeches' },
  papers: { eyebrow: 'Archive · Public Papers', heading: 'Public papers', sub: 'Policy essays, presentations and writings contributed to national and international discourse.', noun: 'public paper', plural: 'public papers' },
  interviews: { eyebrow: 'Archive · Interviews', heading: 'Interviews', sub: 'Interviews and press engagements in which he addresses the issues of the day.', noun: 'interview', plural: 'interviews' },
  notes: { eyebrow: 'Archive · Notes & Correspondence', heading: 'Notes & correspondence', sub: 'Memos, letters and official correspondence — including notices recalling Parliament — written on key national issues.', noun: 'note', plural: 'notes' },
}

type FacetKey = 'theme' | 'occasion' | 'parliament'

/**
 * Distinct values for one facet across the *whole* collection, independent of
 * the active filters. Deriving these from the filtered result set instead would
 * make each dropdown collapse to the single value the user just selected, so
 * they could never switch to a sibling option without clearing first.
 */
const FACET_QUERIES: Record<FacetKey, (kinds: ArchiveKind[]) => Promise<(string | null)[]>> = {
  theme: kinds =>
    prisma.archiveItem
      .findMany({ where: { status: 'published', kind: { in: kinds } }, distinct: ['theme'], select: { theme: true }, orderBy: { theme: 'asc' } })
      .then(rows => rows.map(r => r.theme)),
  occasion: kinds =>
    prisma.archiveItem
      .findMany({ where: { status: 'published', kind: { in: kinds } }, distinct: ['occasion'], select: { occasion: true }, orderBy: { occasion: 'asc' } })
      .then(rows => rows.map(r => r.occasion)),
  parliament: kinds =>
    prisma.archiveItem
      .findMany({ where: { status: 'published', kind: { in: kinds } }, distinct: ['parliament'], select: { parliament: true }, orderBy: { parliament: 'asc' } })
      .then(rows => rows.map(r => r.parliament)),
}

const nonEmpty = (values: (string | null)[]): string[] => values.filter((v): v is string => Boolean(v))

const CHIP_MAX = 8

const FACET_META = [
  { key: 'year', all: 'All years' },
  { key: 'theme', all: 'All themes' },
  { key: 'occasion', all: 'All occasions' },
  { key: 'parliament', all: 'All parliaments' },
] as const

type FacetName = (typeof FACET_META)[number]['key']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(value: string | null): string {
  if (!value) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!m) return value
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

function yearOf(item: { year: number | null; date: string | null }): string {
  if (item.year) return String(item.year)
  const parsed = item.date ? parseInt(item.date.slice(0, 4), 10) : NaN
  return Number.isFinite(parsed) ? String(parsed) : 'undated'
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
  const occasion = sp.occasion?.trim() || ''
  const parliament = sp.parliament?.trim() || ''

  const where: {
    status: string
    kind: { in: ArchiveKind[] }
    OR?: Record<string, unknown>[]
    year?: number
    theme?: string
    occasion?: string
    parliament?: string
  } = { status: 'published', kind: { in: kinds } }

  if (q) {
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { excerpt: { contains: q, mode: 'insensitive' } },
      { body: { contains: q, mode: 'insensitive' } },
      { event: { contains: q, mode: 'insensitive' } },
      { occasion: { contains: q, mode: 'insensitive' } },
      { location: { contains: q, mode: 'insensitive' } },
      { person: { contains: q, mode: 'insensitive' } },
      { institution: { contains: q, mode: 'insensitive' } },
      { theme: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (year) where.year = parseInt(year) || undefined
  if (theme) where.theme = theme
  if (occasion) where.occasion = occasion
  if (parliament) where.parliament = parliament

  const [items, counts, years, themes, occasions, parliaments] = await Promise.all([
    prisma.archiveItem.findMany({ where, orderBy: [{ year: 'desc' }, { date: 'desc' }, { updatedAt: 'desc' }] }),
    getLibraryCounts(),
    prisma.archiveItem.findMany({ where: { status: 'published', kind: { in: kinds }, year: { not: null } }, distinct: ['year'], select: { year: true }, orderBy: { year: 'desc' } }),
    FACET_QUERIES.theme(kinds).then(nonEmpty),
    FACET_QUERIES.occasion(kinds).then(nonEmpty),
    FACET_QUERIES.parliament(kinds).then(nonEmpty),
  ])
  const marginCount = counts.speeches + counts.papers + counts.interviews + counts.notes
  const isFiltered = Boolean(q || year || theme || occasion || parliament)
  const resultSummary = isFiltered
    ? `${items.length} result${items.length === 1 ? '' : 's'}${q ? ` for “${q}”` : ''}`
    : `${items.length} ${items.length === 1 ? copy.noun : copy.plural}`

  const basePath = `/archives/${kind}`
  const activeFacets: Record<FacetName, string> = { year, theme, occasion, parliament }
  const facetValues: Record<FacetName, string[]> = {
    year: years.map(y => y.year).filter((y): y is number => y !== null).map(String),
    theme: themes,
    occasion: occasions,
    parliament: parliaments,
  }

  const facetHref = (patch: Partial<Record<FacetName, string>>) => {
    const sp = new URLSearchParams()
    const merged = { q, ...activeFacets, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const groups: { year: string; rows: typeof items }[] = []
  for (const item of items) {
    const key = yearOf(item)
    const last = groups[groups.length - 1]
    if (last && last.year === key) last.rows.push(item)
    else groups.push({ year: key, rows: [item] })
  }

  const showKind = kinds.length > 1

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <section id="content" style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>{copy.eyebrow}</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 0.75rem', color: 'var(--p-text-1)' }}>{copy.heading}</h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '36rem', margin: 0 }}>{copy.sub}</p>

          <nav aria-label="Archive collections" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.75rem' }}>
            {(Object.keys(LIST_ROUTE_KINDS) as ListRouteKind[]).map(k => {
              const active = k === kind
              return (
                <Link key={k} href={`/archives/${k}`} aria-current={active ? 'page' : undefined} style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? 'var(--primary-fg)' : 'var(--p-text-3)', textDecoration: 'none', background: active ? 'var(--primary)' : 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 999, padding: '0.35rem 0.85rem' }}>
                  {LIST_COPY[k].heading}
                </Link>
              )
            })}
            <Link href="/archives/milestones" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--p-text-3)', textDecoration: 'none', background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 999, padding: '0.35rem 0.85rem' }}>Milestones</Link>
          </nav>
        </div>
      </section>

      <section className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem' }}>
        {/* Search, plus any facet too large to chip */}
        <form method="get" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {FACET_META.filter(f => facetValues[f.key].length > CHIP_MAX).map(f => (
            <select key={f.key} name={f.key} defaultValue={activeFacets[f.key]} aria-label={`Filter by ${f.key}`} style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.6rem 1.1rem', color: 'var(--p-text-1)', fontSize: '0.875rem', outline: 'none' }}>
              <option value="">{f.all}</option>
              {facetValues[f.key].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          ))}
          <input name="q" defaultValue={q} placeholder="Search in this collection…" aria-label="Search this collection"
            style={{ flex: 1, minWidth: 220, background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.6rem 1.1rem', color: 'var(--p-text-1)', fontSize: '0.9rem', outline: 'none' }} />
          <button type="submit" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', borderRadius: 999, padding: '0.6rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Search</button>
          {isFiltered && <Link href={basePath} style={{ alignSelf: 'center', fontSize: '0.8125rem', color: 'var(--p-text-3)' }}>Clear all</Link>}
        </form>

        {/* Facet chips — small facets only, so the values are visible without opening a menu */}
        {FACET_META.filter(f => facetValues[f.key].length > 0 && facetValues[f.key].length <= CHIP_MAX).map(f => (
          <div key={f.key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.625rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--p-text-4)', minWidth: '5.5rem' }}>{f.key}</span>
            <Link href={facetHref({ [f.key]: '' })} className="p-chip" aria-current={!activeFacets[f.key] ? "true" : undefined} style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'none', color: !activeFacets[f.key] ? 'var(--primary-fg)' : 'var(--p-text-3)', background: !activeFacets[f.key] ? 'var(--primary)' : 'transparent', border: '1px solid var(--p-border)', borderRadius: 999, padding: '0.3rem 0.7rem' }}>
              {f.all}
            </Link>
            {facetValues[f.key].map(v => {
              const on = activeFacets[f.key] === v
              return (
                <Link key={v} href={facetHref({ [f.key]: v })} className="p-chip" aria-current={on ? "true" : undefined} style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'none', color: on ? 'var(--primary-fg)' : 'var(--p-text-3)', background: on ? 'var(--primary)' : 'transparent', border: `1px solid ${on ? 'var(--primary)' : 'var(--p-border)'}`, borderRadius: 999, padding: '0.3rem 0.7rem' }}>
                  {v}
                </Link>
              )
            })}
          </div>
        ))}

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed var(--p-border)', borderRadius: 16 }}>
            <SearchX size={32} style={{ color: 'var(--p-text-4)' }} />
            <p style={{ color: 'var(--p-text-3)', margin: '1rem 0 0' }}>No items found{ q ? ` for “${q}”` : '' }. Check back as the archive is digitised.</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--p-text-3)', margin: '2rem 0 1.25rem' }}>
              {resultSummary}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              {groups.map(group => (
                <section key={group.year} aria-label={group.year === 'undated' ? 'Undated' : `Year ${group.year}`}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontFamily: 'var(--font-serif), Georgia, serif', fontStyle: 'italic', fontWeight: 500, fontSize: '1.75rem', lineHeight: 1, letterSpacing: '-0.01em', color: 'var(--p-text-1)' }}>{group.year}</h3>
                    <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--p-border)' }} />
                    <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.625rem', letterSpacing: '0.1em', color: 'var(--p-text-4)' }}>{group.rows.length}</span>
                  </div>

                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderTop: '1px solid var(--p-border-2)' }}>
                    {group.rows.map(item => {
                      const Icon = KIND_ICON[item.kind] ?? FileText
                      const cfg = KIND_CONFIG[item.kind as ArchiveKind]
                      const meta = [item.occasion ?? item.event, item.parliament].filter(Boolean).join(' · ')
                      return (
                        <li key={item.id} style={{ borderBottom: '1px solid var(--p-border-2)' }}>
                          <Link href={`/archives/${kind}/${item.slug}`} className="p-link-strong" style={{ textDecoration: 'none', color: 'inherit', display: 'grid', gridTemplateColumns: '7.5rem 1fr auto', gap: '1.25rem', alignItems: 'baseline', padding: '1.1rem 0.5rem 1.1rem 0' }}>
                            <time dateTime={item.date ?? undefined} style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.75rem', letterSpacing: '0.04em', color: 'var(--primary)' }}>{formatDate(item.date) || item.year || '—'}</time>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                                {showKind && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.625rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--p-text-4)' }}>
                                    <Icon size={12} /> {cfg?.label || item.kind}
                                  </span>
                                )}
                                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif', lineHeight: 1.3 }}>{item.title}</span>
                              </div>
                              {meta && <div style={{ fontSize: '0.75rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', marginTop: '0.3rem' }}>{meta}</div>}
                              {item.excerpt && (
                                <p style={{ margin: '0.45rem 0 0', fontSize: '0.875rem', color: 'var(--p-text-2)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.excerpt}</p>
                              )}
                            </div>

                            {item.filePath ? <Download size={15} style={{ color: 'var(--p-text-4)' }} aria-label="Downloadable document" /> : <span />}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}

        <p style={{ marginTop: '2.5rem', fontSize: '0.8rem', color: 'var(--p-text-4)' }}>
          {marginCount} published records held across speeches, papers, interviews and notes.
        </p>
      </section>

      <PublicFooter />
    </div>
  )
}