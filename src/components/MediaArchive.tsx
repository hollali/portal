'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { jsonFetch } from '@/lib/jsonFetch'
import { isYouTubeUrl, getYouTubeEmbedUrl, getYouTubeThumbUrl } from '@/lib/media'
import { Clapperboard, AudioLines, X, ChevronLeft, ChevronRight, Play, Search as SearchIcon, Filter } from 'lucide-react'

type Kind = 'videos' | 'audio'

interface ArchiveItem {
  id: number
  title: string | null
  src: string | null
  url: string | null
  source: string | null
  channel: string | null
  artist: string | null
  duration: number | null
  category: string | null
  caption: string | null
  year: number | null
  event: string | null
  location: string | null
  theme: string | null
}

interface FacetOption {
  value: string
  count: number
}

interface ListData {
  items: ArchiveItem[]
  total: number
  categories: { value: string; count: number }[]
  facets: Record<string, FacetOption[]>
}

const FACETS: { key: string; label: string }[] = [
  { key: 'category', label: 'Category' },
  { key: 'year', label: 'Year' },
  { key: 'event', label: 'Event' },
  { key: 'location', label: 'Location' },
  { key: 'theme', label: 'Theme' },
]

export interface MediaArchiveProps {
  kind: Kind
  eyebrow: string
  heading: string
  sub: string
  categories: readonly string[]
  defaultCategory?: string
}

export default function MediaArchive({ kind, eyebrow, heading, sub, categories, defaultCategory }: MediaArchiveProps) {
  const [data, setData] = useState<ListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<Record<string, string>>(defaultCategory ? { category: defaultCategory } : {})
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [active, setActive] = useState<ArchiveItem | null>(null)
  const PER_PAGE = 24

  const api = kind === 'videos' ? '/api/videos' : '/api/audio'

  const load = useCallback((f: Record<string, string>, query: string, p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), perPage: String(PER_PAGE) })
    for (const [k, v] of Object.entries(f)) if (v) params.set(k, v)
    if (query) params.set('q', query)
    jsonFetch<ListData>(`${api}?${params.toString()}`)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [api])

  useEffect(() => {
    const t = setTimeout(() => load(filters, q, page), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [filters, q, page, load])

  const setFilter = (key: string, value: string) => {
    setPage(1)
    setFilters(prev => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  }

  const changePage = (p: number) => {
    setPage(p)
    setActive(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeIndex = useMemo(() => (active === null ? -1 : data?.items.findIndex(p => p.id === active.id) ?? -1), [data, active])
  const totalPages = Math.ceil((data?.total ?? 0) / PER_PAGE)
  const hasFilters = Object.keys(filters).length > 0 || !!q
  const activeCategories = data?.categories?.length ? data.categories : categories.map(c => ({ value: c, count: 0 }))

  return (
    <div>
      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)', margin: '-2rem -1.5rem 0' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>{eyebrow}</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>{heading}</h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '40rem', margin: 0 }}>{sub}</p>
        </div>
      </section>

      <section className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2rem, 4vw, 3rem) 0' }}>
        {/* Search + facet filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <SearchIcon size={15} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--p-text-4)' }} />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
              placeholder={`Search ${kind === 'videos' ? 'videos' : 'recordings'} by title, caption, category…`}
              style={{ width: '100%', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.55rem 0.9rem 0.55rem 2.4rem', color: 'var(--p-text-1)', fontSize: '0.8rem', outline: 'none' }}
            />
          </div>
          {FACETS.map(f => (
            <select
              key={f.key}
              value={filters[f.key] || ''}
              onChange={e => setFilter(f.key, e.target.value)}
              style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.55rem 0.9rem', color: 'var(--p-text-1)', fontSize: '0.8rem', outline: 'none', maxWidth: 200 }}
            >
              <option value="">{f.label}: all</option>
              {(data?.facets[f.key] || []).map(o => (
                <option key={o.value} value={o.value}>{o.value} ({o.count})</option>
              ))}
            </select>
          ))}
        </div>

        {/* Category chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', alignSelf: 'center' }}>
            <Filter size={12} /> Browse
          </span>
          {activeCategories.map(c => {
            const active = filters.category === c.value
            return (
              <button
                key={c.value}
                onClick={() => setFilter('category', active ? '' : c.value)}
                style={{
                  fontSize: '0.75rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: active ? 'var(--primary-fg)' : 'var(--p-text-3)', textDecoration: 'none',
                  background: active ? 'var(--primary)' : 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 999,
                  padding: '0.35rem 0.85rem', cursor: 'pointer',
                }}
              >
                {c.value}{c.count ? ` (${c.count})` : ''}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            {loading ? 'Loading…' : `${(data?.total ?? 0).toLocaleString()} item${data?.total === 1 ? '' : 's'} in the archive`}
          </span>
          {hasFilters && (
            <button onClick={() => { setFilters(defaultCategory ? { category: defaultCategory } : {}); setQ(''); setPage(1) }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
              Reset filters
            </button>
          )}
        </div>

        {!loading && (data?.items.length ?? 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed var(--p-border)', borderRadius: 16 }}>
            <p style={{ color: 'var(--p-text-3)' }}>Nothing matches this filter yet — the archive is still being digitised.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
            {data?.items.map(item => (
              <button key={item.id} onClick={() => setActive(item)} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div className="p-card-lift" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ aspectRatio: '16/10', position: 'relative', background: '#000', overflow: 'hidden' }}>
                    {kind === 'videos' && item.src && isYouTubeUrl(item.src) ? (
                      <img src={getYouTubeThumbUrl(item.src) || ''} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(140deg, color-mix(in srgb, var(--primary) 30%, #000 40%), #000)' }}>
                        {kind === 'videos' ? <Clapperboard size={34} style={{ color: 'color-mix(in srgb, var(--primary) 70%, white)' }} /> : <AudioLines size={34} style={{ color: 'color-mix(in srgb, var(--primary) 70%, white)' }} />}
                      </div>
                    )}
                    <span style={{ position: 'absolute', left: '0.8rem', bottom: '0.8rem', width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                      <Play size={14} fill="currentColor" style={{ marginLeft: 2 }} />
                    </span>
                    {item.category && (
                      <span style={{ position: 'absolute', right: '0.6rem', top: '0.6rem', fontSize: '0.6rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary-fg)', background: 'var(--primary)', borderRadius: 999, padding: '0.18rem 0.6rem' }}>
                        {item.category}
                      </span>
                    )}
                    {item.duration ? (
                      <span style={{ position: 'absolute', right: '0.6rem', bottom: '0.6rem', fontSize: '0.62rem', fontFamily: 'var(--font-mono), monospace', color: '#fff', background: 'rgba(0,0,0,0.6)', borderRadius: 999, padding: '0.12rem 0.5rem' }}>
                        {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--p-text-1)', lineHeight: 1.4, marginBottom: '0.25rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.title || `#${item.id}`}
                    </div>
                    {(item.caption) && (
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--p-text-3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.caption}</p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '0.6rem' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace' }}>
                        {item.channel || item.artist || item.source || ''}
                      </span>
                      {item.year && <span style={{ fontSize: '0.68rem', color: 'var(--primary)', fontFamily: 'var(--font-mono), monospace', fontWeight: 700 }}>{item.year}</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '2.25rem', flexWrap: 'wrap' }}>
            {(() => {
              const start = Math.max(1, Math.min(page - 4, totalPages - 9))
              const nums = Array.from({ length: Math.min(10, totalPages) }, (_, i) => start + i)
              const btn = (label: React.ReactNode, target: number, opts?: { active?: boolean; disabled?: boolean; key?: number | string }) => (
                <button
                  key={opts?.key}
                  disabled={opts?.disabled}
                  onClick={() => changePage(target)}
                  style={{
                    minWidth: 38, height: 38, borderRadius: 999, cursor: opts?.disabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem', fontFamily: 'var(--font-mono), monospace',
                    border: '1px solid var(--p-border-3)',
                    background: opts?.active ? 'var(--primary)' : 'var(--p-surface)',
                    color: opts?.active ? 'var(--primary-fg)' : opts?.disabled ? 'var(--p-text-4)' : 'var(--p-text-1)',
                    padding: '0 0.9rem',
                  }}
                >
                  {label}
                </button>
              )
              return (
                <>
                  {btn(<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><ChevronLeft size={14} /> Prev</span>, page - 1, { disabled: page <= 1, key: 'prev' })}
                  {nums.map(p => btn(p, p, { active: p === page, key: p }))}
                  {btn(<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>Next <ChevronRight size={14} /></span>, page + 1, { disabled: page >= totalPages, key: 'next' })}
                </>
              )
            })()}
          </div>
        )}
      </section>

      {/* Lightbox player */}
      {active && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setActive(null)}>
          <button onClick={() => setActive(null)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', color: 'var(--p-text-1)', borderRadius: 999, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
          {activeIndex > 0 && (
            <button onClick={e => { e.stopPropagation(); setActive(data!.items[activeIndex - 1]) }} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', color: 'var(--p-text-1)', borderRadius: 999, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={20} />
            </button>
          )}
          {activeIndex < (data?.items.length ?? 0) - 1 && (
            <button onClick={e => { e.stopPropagation(); setActive(data!.items[activeIndex + 1]) }} style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', color: 'var(--p-text-1)', borderRadius: 999, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={20} />
            </button>
          )}
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 860, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: '0.75rem' }}>
              <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, margin: 0, lineHeight: 1.4 }}>{active.title || `#${active.id}`}</h3>
            </div>
            {(() => {
              if (!active.src) return <div style={{ background: '#000', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#aaa', fontSize: '0.9rem' }}>No playable source for this item yet.</div>
              const yt = isYouTubeUrl(active.src)
              const embed = getYouTubeEmbedUrl(active.src)
              if (kind === 'videos') {
                if (yt && embed) {
                  return (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                      <iframe src={embed} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="autoplay" />
                    </div>
                  )
                }
                return (
                  <video controls autoPlay style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: '60vh' }}>
                    <source src={active.src} />
                  </video>
                )
              }
              if (yt && embed) {
                return (
                  <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
                    <iframe src={embed} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="autoplay" />
                  </div>
                )
              }
              return (
                <div style={{ background: '#000', borderRadius: 12, padding: '2.5rem' }}>
                  <audio controls autoPlay style={{ width: '100%' }}>
                    <source src={active.src} />
                  </audio>
                </div>
              )
            })()}
            <div style={{ marginTop: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {[
                ['Category', active.category], ['Year', active.year], ['Event', active.event],
                ['Location', active.location], ['Theme', active.theme],
                kind === 'videos' ? ['Channel', active.channel] : ['Artist', active.artist],
                ['Source', active.source],
              ].filter(([, v]) => v).map(([label, value]) => (
                <span key={String(label)} style={{ fontSize: '0.75rem', color: '#e9e9e9', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '0.28rem 0.8rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', fontSize: '0.58rem', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.6)', marginRight: '0.3rem' }}>{label}:</span> {value}
                </span>
              ))}
            </div>
            {active.caption && <p style={{ margin: '1rem 0 0', color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem', lineHeight: 1.7 }}>{active.caption}</p>}
          </div>
        </div>
      )}
    </div>
  )
}