'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { Search as SearchIcon, Mic, FileText, MessagesSquare, ScrollText, Award, Milestone as MilestoneIcon } from 'lucide-react'
import { KIND_CONFIG, type ArchiveKind } from '@/lib/library'

interface ArchiveHit { id: number; kind: string; title: string; slug: string; date: string | null; year: number | null; excerpt: string | null }
interface MiscHit { id: number; title: string; description?: string; year?: string }
interface TestimonialHit { id: number; author: string; role?: string; quote: string }
interface MediaHit { id: number; title?: string | null; url?: string | null; source?: string | null; sourceName?: string | null; date?: string | null; channel?: string | null; artist?: string | null }

interface SearchResults {
  total: number
  archive: { items: ArchiveHit[]; total: number }
  milestones: { items: MiscHit[]; total: number }
  testimonials: { items: TestimonialHit[]; total: number }
  images: { items: MediaHit[]; total: number }
  videos: { items: MediaHit[]; total: number }
  news: { items: MediaHit[]; total: number }
  audio: { items: MediaHit[]; total: number }
}

const KIND_ICON: Record<string, React.ElementType> = { speech: Mic, paper: FileText, interview: MessagesSquare, note: ScrollText, letter: ScrollText, memo: ScrollText }

function SearchBox() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)

  const run = (q: string) => {
    if (!q.trim()) { setResults(null); return }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      .then(r => r.json())
      .then(d => { setResults(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    const q0 = searchParams.get('q') || ''
    setQuery(q0)
    if (q0) run(q0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const groupTitle = (label: string, href: string | null, total: number) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--p-text-1)' }}>
        {href ? <Link href={href} style={{ color: 'inherit' }}>{label} ({total})</Link> : <>{label} ({total})</>}
      </h2>
    </div>
  )

  return (
    <div>
      <form
        onSubmit={e => { e.preventDefault(); run(query) }}
        style={{ display: 'flex', gap: '0.6rem', maxWidth: 640, margin: '0 0 2rem' }}
      >
        <input
          placeholder="Search speeches, letters, milestones, media…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ flex: 1, background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.7rem 1.2rem', color: 'var(--p-text-1)', fontSize: '1rem', outline: 'none' }}
        />
        <button type="submit" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', borderRadius: 999, padding: '0.7rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <SearchIcon size={16} /> Search
        </button>
      </form>

      {loading && <p style={{ color: 'var(--p-text-3)' }}>Searching…</p>}

      {results && !loading && (
        <>
          <p style={{ color: 'var(--p-text-3)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {results.total.toLocaleString()} result{results.total === 1 ? '' : 's'} for &ldquo;<strong style={{ color: 'var(--p-text-1)' }}>{query}</strong>&rdquo;
          </p>

          {results.archive.total > 0 && (
            <section className="card" style={{ marginBottom: '1rem' }}>
              {groupTitle('Archives', '/archives', results.archive.total)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {results.archive.items.map(a => {
                  const Icon = KIND_ICON[a.kind] || FileText
                  const cfg = KIND_CONFIG[a.kind as ArchiveKind]
                  const route = a.kind === 'note' || a.kind === 'letter' || a.kind === 'memo' ? 'notes' : `${a.kind}s`
                  return (
                    <Link key={a.id} href={`/archives/${route}/${a.slug}`} style={{ textDecoration: 'none', display: 'block', padding: '0.6rem 0.25rem', borderBottom: '1px solid var(--border)' }} className="last:border-none">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--p-text-1)' }}>
                        <Icon size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        {a.title}
                        <span style={{ fontSize: '0.68rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{cfg?.label} · {a.date || a.year || ''}</span>
                      </div>
                      {a.excerpt && <p style={{ fontSize: '0.8rem', color: 'var(--p-text-3)', margin: '0.2rem 0 0 1.2rem' }}>{a.excerpt.slice(0, 140)}…</p>}
                    </Link>
                  )
                })}
              </div>
            </section>
          )}

          {results.milestones.total > 0 && (
            <section className="card" style={{ marginBottom: '1rem' }}>
              {groupTitle('Milestones', '/archives/milestones', results.milestones.total)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {results.milestones.items.map(m => (
                  <div key={m.id} style={{ padding: '0.35rem 0.25rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--p-text-1)' }}>
                      <MilestoneIcon size={14} style={{ color: 'var(--primary)' }} />
                      <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.8rem' }}>{m.year}</span>
                      {m.title}
                    </div>
                    {m.description && <p style={{ fontSize: '0.8rem', color: 'var(--p-text-3)', margin: '0.2rem 0 0 1.2rem' }}>{m.description.slice(0, 140)}…</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.testimonials.total > 0 && (
            <section className="card" style={{ marginBottom: '1rem' }}>
              {groupTitle('Testimonials', '/archives/testimonials', results.testimonials.total)}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {results.testimonials.items.map(t => (
                  <div key={t.id} style={{ padding: '0.35rem 0.25rem', borderBottom: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--p-text-2)', fontStyle: 'italic' }}>&ldquo;{t.quote.slice(0, 160)}…&rdquo;</p>
                    <div style={{ fontSize: '0.78rem', color: 'var(--p-text-3)', marginTop: '0.2rem' }}>
                      <Award size={12} style={{ verticalAlign: 'middle', color: 'var(--primary)' }} /> {t.author}{t.role ? ` · ${t.role}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {results.images.total > 0 && (
            <section className="card" style={{ marginBottom: '1rem' }}>
              {groupTitle('Photos', '/archives/photos', results.images.total)}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.6rem' }}>
                {results.images.items.map(img => (
                  <Link key={img.id} href={`/images/${img.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--p-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {img.url?.split('/').pop() || `#${img.id}`}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--p-text-4)' }}>{img.source}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results.videos.total > 0 && (
            <section className="card" style={{ marginBottom: '1rem' }}>
              {groupTitle('Videos', '/videos', results.videos.total)}
              {results.videos.items.slice(0, 5).map(v => (
                <Link key={v.id} href={`/videos/${v.id}`} style={{ textDecoration: 'none', display: 'block', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--p-text-1)' }}>{v.title || `#${v.id}`}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--p-text-4)' }}>{v.source} · {v.channel}</div>
                </Link>
              ))}
            </section>
          )}

          {results.news.total > 0 && (
            <section className="card" style={{ marginBottom: '1rem' }}>
              {groupTitle('News Clippings', '/news', results.news.total)}
              {results.news.items.slice(0, 5).map(n => (
                <Link key={n.id} href={`/news/${n.id}`} style={{ textDecoration: 'none', display: 'block', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--p-text-1)' }}>{n.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--p-text-4)' }}>{n.sourceName} · {n.date}</div>
                </Link>
              ))}
            </section>
          )}

          {results.audio.total > 0 && (
            <section className="card" style={{ marginBottom: '1rem' }}>
              {groupTitle('Audio', '/audio', results.audio.total)}
              {results.audio.items.slice(0, 5).map(a => (
                <Link key={a.id} href={`/audio/${a.id}`} style={{ textDecoration: 'none', display: 'block', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--p-text-1)' }}>{a.title || `#${a.id}`}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--p-text-4)' }}>{a.source} · {a.artist}</div>
                </Link>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default function PublicSearchPage() {
  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />
      <main className="p-section" style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Search</span>
        <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', margin: '0.75rem 0 1.75rem', color: 'var(--p-text-1)' }}>
          Search the library
        </h1>
        <Suspense fallback={null}>
          <SearchBox />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  )
}