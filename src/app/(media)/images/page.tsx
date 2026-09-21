'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { jsonFetch } from '@/lib/jsonFetch'
import { Search as SearchIcon, X, ChevronLeft, ChevronRight, ExternalLink, ArrowRight, Image as ImageIcon, UserRound } from 'lucide-react'
import { isYouTubeUrl } from '@/lib/media'

interface ImageRow {
  id: number
  url: string | null
  src: string | null
  localPath: string | null
  source: string | null
  query: string | null
  faceDetected: number | null
  faceCount: number | null
  faceMatch: number | null
  faceMatchScore: number | null
}

interface ListData {
  items: ImageRow[]
  total: number
  sources: string[]
}

const PER_PAGE = 24
const FALLBACK_SKELETON = Array.from({ length: 12 }, (_, i) => i)

export default function ImageListPage() {
  const [data, setData] = useState<ListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [active, setActive] = useState<ImageRow | null>(null)
  const [errored, setErrored] = useState<Set<number>>(new Set())

  const load = useCallback((query: string, src: string, p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), perPage: String(PER_PAGE), sort: 'id', dir: 'desc' })
    if (query) params.set('q', query)
    if (src) params.set('source', src)
    jsonFetch<ListData>(`/api/images?${params.toString()}`)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(q, source, page), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q, source, page, load])

  const changePage = (p: number) => {
    setPage(p)
    setActive(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const activeIndex = data?.items.findIndex(i => active && i.id === active.id) ?? -1
  const totalPages = Math.ceil((data?.total ?? 0) / PER_PAGE)
  const hasFilters = !!q || !!source

  const mediaSrc = (img: ImageRow) => (!errored.has(img.id) && img.src) ? img.src : img.url

  return (
    <div>
      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)', margin: '-2rem -1.5rem 0' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Photographic archive</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>The man <span className="p-serif">in photos</span></h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '40rem', margin: 0 }}>
            A photographic record of Rt. Hon. Alban Bagbin — moments captured across public life, collected and preserved in the digital library.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2rem, 4vw, 3rem) 0' }}>
        {/* Search + source */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <SearchIcon size={15} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--p-text-4)' }} />
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
              placeholder="Search photos by URL, source, query…"
              style={{ width: '100%', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.55rem 0.9rem 0.55rem 2.4rem', color: 'var(--p-text-1)', fontSize: '0.8rem', outline: 'none' }}
            />
          </div>
          <select
            value={source}
            onChange={e => { setSource(e.target.value); setPage(1) }}
            style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.55rem 0.9rem', color: 'var(--p-text-1)', fontSize: '0.8rem', outline: 'none', maxWidth: 220 }}
          >
            <option value="">All sources</option>
            {(data?.sources || []).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            {loading ? 'Loading…' : `${(data?.total ?? 0).toLocaleString()} photo${data?.total === 1 ? '' : 's'} in the archive`}
          </span>
          {hasFilters && (
            <button onClick={() => { setQ(''); setSource(''); setPage(1) }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
              Reset filters
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '1rem' }}>
            {FALLBACK_SKELETON.map(i => (
              <div key={i} style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ aspectRatio: '4/3', background: 'var(--p-surface-3)', opacity: 0.5 }} />
                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ height: 12, width: '60%', borderRadius: 6, background: 'var(--p-surface-3)', opacity: 0.7 }} />
                  <div style={{ height: 10, width: '40%', borderRadius: 6, background: 'var(--p-surface-3)', opacity: 0.5 }} />
                </div>
              </div>
            ))}
          </div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed var(--p-border)', borderRadius: 16 }}>
            <p style={{ color: 'var(--p-text-3)' }}>Nothing matches this filter yet — the photo archive is still being digitised.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '1rem' }}>
            {data?.items.map(img => (
              <button key={img.id} onClick={() => setActive(img)} title={`Photo #${img.id}`} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <div className="p-card-lift" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ aspectRatio: '4/3', background: 'var(--p-surface-3)', position: 'relative', overflow: 'hidden' }}>
                    {mediaSrc(img) ? (
                      <img
                        src={mediaSrc(img) || ''}
                        alt=""
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={() => setErrored(prev => new Set(prev).add(img.id))}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(140deg, color-mix(in srgb, var(--primary) 22%, var(--p-surface-3)) 0%, var(--p-surface-3) 100%)' }}>
                        <ImageIcon size={30} style={{ color: 'var(--p-text-4)' }} />
                      </div>
                    )}
                    {img.faceMatch ? (
                      <span style={{ position: 'absolute', left: '0.6rem', bottom: '0.6rem', fontSize: '0.6rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--success)', background: 'color-mix(in srgb, var(--success) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--success) 45%, transparent)', borderRadius: 999, padding: '0.18rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                        <UserRound size={10} /> Face match
                      </span>
                    ) : null}
                  </div>
                  <div style={{ padding: '0.75rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isYouTubeUrl(img.url || '') ? 'YouTube' : (img.source || 'Unknown')}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace', flexShrink: 0 }}>#{img.id}</span>
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

      {/* Lightbox */}
      {active && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setActive(null)}>
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
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: '0.75rem' }}>
              <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Photo #{active.id}{active.source ? ` — ${active.source}` : ''}</h3>
            </div>
            <div style={{ background: '#000', borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', maxHeight: '68vh' }}>
              {mediaSrc(active) ? (
                <img src={mediaSrc(active) || ''} alt="" style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain' }} />
              ) : (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#aaa', fontSize: '0.9rem' }}>No preview available for this photo.</div>
              )}
            </div>
            <div style={{ marginTop: '0.9rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
{([
                ['Source', active.source],
                ['Query', active.query],
                active.faceMatch ? ['Face match', active.faceMatchScore !== null && active.faceMatchScore > 0 ? `${(active.faceMatchScore * 100).toFixed(1)}%` : 'Yes'] : null,
                ['ID', `#${active.id}`],
              ] as ([string, string | null] | null)[]).filter((pair): pair is [string, string | null] => pair !== null && Boolean(pair[1])).map(([label, value]) => (
                <span key={String(label)} style={{ fontSize: '0.75rem', color: '#e9e9e9', border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)', borderRadius: 999, padding: '0.28rem 0.8rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', fontSize: '0.58rem', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.6)', marginRight: '0.3rem' }}>{label}:</span> {value}
                </span>
              ))}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.8rem', alignItems: 'center' }}>
              <Link href={`/images/${active.id}`} style={{ color: '#55beff', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', fontWeight: 600 }}>
                Full record <ArrowRight size={14} />
              </Link>
              {active.url && (
                <a href={active.url} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
                  Open source <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}