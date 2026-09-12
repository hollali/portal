'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { PHOTO_FACET_FIELDS } from '@/lib/library'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

interface PhotoItem {
  id: number
  src: string | null
  year: number | null
  event: string | null
  location: string | null
  person: string | null
  institution: string | null
  parliament: string | null
  theme: string | null
  caption: string | null
  source: string | null
}

interface FacetOption {
  value: string
  count: number
}

interface PhotosData {
  items: PhotoItem[]
  total: number
  facets: Record<string, FacetOption[]>
}

type FilterMap = Record<string, string>

export default function PhotosPage() {
  const [data, setData] = useState<PhotosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterMap>({})
  const [q, setQ] = useState('')
  const [active, setActive] = useState<number | null>(null)

  const baseUrl = '/api/photos'

  const load = useCallback((f: FilterMap, query: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) if (v) params.set(k, v)
    if (query) params.set('q', query)
    fetch(`${baseUrl}?${params.toString()}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(filters, q), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [filters, q, load])

  const setFilter = (key: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  }

  const activeItems = useMemo(() => data?.items ?? [], [data])
  const activeIndex = useMemo(() => (active === null ? -1 : activeItems.findIndex(p => p.id === active)), [active, activeItems])

  const activePhoto = activeIndex >= 0 ? activeItems[activeIndex] : null

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Archive · Photo Library</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>The photo library</h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '40rem', margin: 0 }}>
            Photographs curated by year, event, location, person, institution, parliament and theme — filter across any combination.
          </p>
        </div>
      </section>

      <section className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem' }}>
        {/* Facet filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem', marginBottom: '1.25rem' }}>
          {PHOTO_FACET_FIELDS.map(f => (
            <select
              key={f.key}
              value={filters[f.key] || ''}
              onChange={e => setFilter(f.key, e.target.value)}
              style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.55rem 0.9rem', color: 'var(--p-text-1)', fontSize: '0.8rem', outline: 'none' }}
            >
              <option value="">{f.label}: all</option>
              {(data?.facets[f.key] || []).map(o => (
                <option key={o.value} value={o.value}>{o.value} ({o.count})</option>
              ))}
            </select>
          ))}
          <input
            placeholder="Search captions…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.55rem 0.9rem', color: 'var(--p-text-1)', fontSize: '0.8rem', outline: 'none', minWidth: 150 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            {loading ? 'Loading…' : `${activeItems.length.toLocaleString()} photograph${activeItems.length === 1 ? '' : 's'} in the curated library`}
          </span>
          {(Object.keys(filters).length > 0 || q) && (
            <button onClick={() => { setFilters({}); setQ('') }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
              Reset filters
            </button>
          )}
        </div>

        {activeItems.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed var(--p-border)', borderRadius: 16 }}>
            <p style={{ color: 'var(--p-text-3)' }}>No photographs match this filter yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '0.85rem' }}>
            {activeItems.map(p => (
              <button key={p.id} onClick={() => setActive(p.id)} style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', textAlign: 'left' }}>
                <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ aspectRatio: '1', overflow: 'hidden', background: 'var(--p-img-bg)' }}>
                    {p.src && <img src={p.src} alt={p.caption || `Photo #${p.id}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ padding: '0.7rem 0.85rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--p-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.3rem' }}>
                      {p.caption || (p.event || `${p.year || 'Undated'} photograph`)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {p.year && <span style={{ fontSize: '0.62rem', color: 'var(--primary)', fontFamily: 'var(--font-mono), monospace', fontWeight: 700 }}>{p.year}</span>}
                      {[p.event, p.location, p.theme].filter(Boolean).slice(0, 2).map(t => (
                        <span key={t} style={{ fontSize: '0.62rem', color: 'var(--p-text-4)', border: '1px solid var(--p-border-2)', borderRadius: 999, padding: '0.08rem 0.45rem' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {activePhoto && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }} onClick={() => setActive(null)}>
          <button onClick={() => setActive(null)} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', color: 'var(--p-text-1)', borderRadius: 999, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={18} />
          </button>
          {activeIndex > 0 && (
            <button onClick={e => { e.stopPropagation(); setActive(activeItems[activeIndex - 1].id) }} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', color: 'var(--p-text-1)', borderRadius: 999, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={20} />
            </button>
          )}
          {activeIndex < activeItems.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setActive(activeItems[activeIndex + 1].id) }} style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', color: 'var(--p-text-1)', borderRadius: 999, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={20} />
            </button>
          )}
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%' }}>
            {activePhoto.src && (
              <img src={activePhoto.src} alt={activePhoto.caption || ''} style={{ maxWidth: '100%', maxHeight: '74vh', objectFit: 'contain', borderRadius: 12, margin: '0 auto', display: 'block' }} />
            )}
            <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 14 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--p-text-1)', marginBottom: '0.4rem' }}>
                {activePhoto.caption || (activePhoto.event || `Photograph #${activePhoto.id}`)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {[
                  ['Year', activePhoto.year], ['Event', activePhoto.event], ['Location', activePhoto.location],
                  ['Person', activePhoto.person], ['Institution', activePhoto.institution], ['Parliament', activePhoto.parliament], ['Theme', activePhoto.theme],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <span key={label} style={{ fontSize: '0.78rem', color: 'var(--p-text-2)', border: '1px solid var(--p-border)', background: 'var(--p-surface-2)', borderRadius: 999, padding: '0.3rem 0.8rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: '0.05em', color: 'var(--p-text-4)', marginRight: '0.3rem' }}>{label}:</span> {value}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  )
}