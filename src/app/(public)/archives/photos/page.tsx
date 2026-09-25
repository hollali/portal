'use client'

import { Fragment, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { PHOTO_FACET_FIELDS } from '@/lib/library'
import { jsonFetch } from '@/lib/jsonFetch'
import { X, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'

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
  sourceUrl: string | null
  query: string | null
  collectedAt: string | null
  dateTaken: string | null
  notes: string | null
  tags: string | null
  curated: boolean
  storedLocally: boolean
  imageHash: string | null
  faceDetected: number | null
  faceCount: number | null
  faceMatch: number | null
  faceMatchScore: number | null
  faceMatchDistance: number | null
  bestReferencePath: string | null
}

interface FacetOption {
  value: string
  count: number
}

interface PhotosData {
  items: PhotoItem[]
  total: number
  facets: Record<string, FacetOption[]>
  page?: number
  perPage?: number
}

type FilterMap = Record<string, string>

type DetailRow = { label: string; value: React.ReactNode }

/** Tags are stored comma-separated, matching the other media detail pages. */
function parseTags(tags: string | null): string[] {
  return String(tags || '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
}

const mono = { fontFamily: 'var(--font-mono), monospace' } as const
const detailLabel = {
  fontFamily: 'var(--font-mono), monospace',
  textTransform: 'uppercase',
  fontSize: '0.6rem',
  letterSpacing: '0.05em',
  color: 'var(--p-text-4)',
} as const

function isPresent(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

/** `collectedAt` is stored as a raw ISO timestamp; show a readable date instead. */
function formatTimestamp(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function DetailGroup({ title, rows }: { title: string; rows: DetailRow[] }) {
  const present = rows.filter(r => isPresent(r.value))
  if (present.length === 0) return null
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <h3 style={{ ...mono, fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)', margin: '0 0 0.5rem' }}>
        {title}
      </h3>
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.4rem 0.9rem', margin: 0, fontSize: '0.82rem' }}>
        {present.map(r => (
          <Fragment key={r.label}>
            <dt style={{ ...detailLabel, alignSelf: 'center' }}>{r.label}</dt>
            <dd style={{ margin: 0, color: 'var(--p-text-1)', wordBreak: 'break-word' }}>{r.value}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  )
}

/**
 * Every field the catalogue holds for a photograph, grouped so the archival
 * description reads first and the ingest diagnostics stay out of the way.
 */
function PhotoDetails({ photo }: { photo: PhotoItem }) {
  const tags = parseTags(photo.tags)
  const num = (v: number | null | undefined, digits?: number) =>
    isPresent(v) ? (digits !== undefined ? v!.toFixed(digits) : String(v)) : null

  const about: DetailRow[] = [
    { label: 'Catalogue ID', value: `#${photo.id}` },
    { label: 'Year', value: photo.year },
    { label: 'Date taken', value: photo.dateTaken },
    { label: 'Event', value: photo.event },
    { label: 'Location', value: photo.location },
    { label: 'Person', value: photo.person },
    { label: 'Institution', value: photo.institution },
    { label: 'Parliament', value: photo.parliament },
    { label: 'Theme', value: photo.theme },
    { label: 'Curated', value: photo.curated ? 'Yes' : 'No' },
  ]

  const provenance: DetailRow[] = [
    { label: 'Source', value: photo.source },
    {
      label: 'Original',
      value: photo.sourceUrl ? (
        <a
          href={photo.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--primary)', textDecoration: 'underline' }}
        >
          View on the web
        </a>
      ) : null,
    },
    { label: 'Collected', value: formatTimestamp(photo.collectedAt) },
    { label: 'Search query', value: photo.query },
    { label: 'Held in', value: photo.storedLocally ? 'Local media store' : 'Remote (original URL)' },
  ]

  const technical: DetailRow[] = [
    { label: 'Image hash', value: photo.imageHash },
    { label: 'Faces detected', value: num(photo.faceDetected) },
    { label: 'Face count', value: num(photo.faceCount) },
    { label: 'Face match', value: photo.faceMatch ? 'Matched' : 'No match' },
    { label: 'Match score', value: num(photo.faceMatchScore, 3) },
    { label: 'Match distance', value: num(photo.faceMatchDistance, 3) },
    { label: 'Reference image', value: photo.bestReferencePath },
  ]

  const describedCount = about.filter(r => isPresent(r.value)).length

  return (
    <div>
      <DetailGroup title="About this photograph" rows={about} />
      {describedCount <= 2 && (
        <p style={{ fontSize: '0.78rem', color: 'var(--p-text-3)', margin: '-0.6rem 0 1.1rem' }}>
          Only the catalogue ID and curation status are recorded so far — this photograph
          has not been fully described.
        </p>
      )}
      <DetailGroup title="Provenance" rows={provenance} />
      {tags.length > 0 && (
        <div style={{ marginBottom: '1.1rem' }}>
          <h3 style={{ ...mono, fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)', margin: '0 0 0.5rem' }}>
            Tags
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {tags.map(t => (
              <span key={t} style={{ fontSize: '0.7rem', color: 'var(--p-text-2)', border: '1px solid var(--p-border-2)', background: 'var(--p-surface-2)', borderRadius: 999, padding: '0.15rem 0.55rem' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {photo.notes && photo.notes !== photo.caption && (
        <div style={{ marginBottom: '1.1rem' }}>
          <h3 style={{ ...mono, fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)', margin: '0 0 0.4rem' }}>
            Notes
          </h3>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--p-text-2)', margin: 0 }}>{photo.notes}</p>
        </div>
      )}

      <details style={{ borderTop: '1px solid var(--p-border)', paddingTop: '0.75rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.75rem', ...mono, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-text-3)' }}>
          Technical details
        </summary>
        <div style={{ marginTop: '0.75rem' }}>
          <DetailGroup title="Ingest record" rows={technical} />
        </div>
      </details>
    </div>
  )
}

function photoTitle(photo: PhotoItem): string {
  return photo.caption || photo.event || `Photograph #${photo.id}`
}

/**
 * Full-screen photo viewer.
 *
 * The overlay scrolls (`overflow: auto` + `margin: auto` on the panel) so a tall
 * details block stays reachable on short viewports — `align-items: center` alone
 * would clip both ends of an overflowing flex child. Background scroll is locked,
 * focus is moved in and restored, Tab is trapped, and Escape/arrows are handled.
 */
export function PhotoLightbox({
  photo,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  photo: PhotoItem
  index: number
  total: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Keyed by photo id: a status recorded for a different photo simply does not
  // apply, which resets the image state without an effect or a remount.
  const [imgStatus, setImgStatus] = useState({ id: photo.id, failed: false, loaded: false })
  const imgFailed = imgStatus.failed && imgStatus.id === photo.id
  const imgLoaded = imgStatus.loaded && imgStatus.id === photo.id
  const setImgStatusFor = (patch: { failed?: boolean; loaded?: boolean }) =>
    setImgStatus({ id: photo.id, failed: false, loaded: false, ...patch })

  // Lock background scroll for as long as the viewer is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault()
        onPrev()
        return
      }
      if (e.key === 'ArrowRight' && index < total - 1) {
        e.preventDefault()
        onNext()
        return
      }
      if (e.key !== 'Tab') return
      const node = dialogRef.current
      if (!node) return
      const focusable = node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext, index, total])

  // Move focus into the dialog on open, and hand it back to the trigger on close.
  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    const trigger = document.activeElement as HTMLElement | null
    const target = node.querySelector<HTMLElement>('[data-autofocus]')
    if (target) target.focus()
    else node.focus()
    return () => trigger?.focus?.({ preventScroll: true })
  }, [])

  const title = photoTitle(photo)
  const roundBtn: React.CSSProperties = {
    background: 'var(--p-surface)',
    border: '1px solid var(--p-border-3)',
    color: 'var(--p-text-1)',
    borderRadius: 999,
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }

  return (
    <div
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex',
        overflow: 'auto',
        padding: 'clamp(0.75rem, 2.5vw, 2rem)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ maxWidth: 900, width: '100%', margin: 'auto', outline: 'none' }}
      >
        <button
          onClick={onClose}
          data-autofocus
          aria-label="Close photo viewer"
          style={{ ...roundBtn, position: 'fixed', top: '1.25rem', right: '1.25rem' }}
        >
          <X size={18} />
        </button>
        {index > 0 && (
          <button
            onClick={onPrev}
            aria-label="Previous photo"
            style={{ ...roundBtn, position: 'absolute', left: '0.5rem', top: '0.5rem', zIndex: 1 }}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {index < total - 1 && (
          <button
            onClick={onNext}
            aria-label="Next photo"
            style={{ ...roundBtn, position: 'absolute', right: '0.5rem', top: '0.5rem', zIndex: 1 }}
          >
            <ChevronRight size={20} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '18vh' }}>
          {photo.src && !imgFailed ? (
            <img
              src={photo.src}
              alt={photo.caption || `Photograph #${photo.id}`}
              onError={() => setImgStatusFor({ failed: true })}
              onLoad={() => setImgStatusFor({ loaded: true })}
              style={{
                maxWidth: '100%',
                maxHeight: '62vh',
                objectFit: 'contain',
                borderRadius: 12,
                display: 'block',
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '3rem 1rem', color: 'var(--p-text-3)' }}>
              <ImageOff size={28} />
              <span style={{ fontSize: '0.85rem' }}>Image unavailable</span>
              {photo.sourceUrl && (
                <a
                  href={photo.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8rem', color: 'var(--primary)' }}
                >
                  Try the original source
                </a>
              )}
            </div>
          )}
        </div>
        {!imgLoaded && !imgFailed && photo.src && (
          <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--p-text-4)', margin: '0.4rem 0 0' }}>
            Loading image…
          </p>
        )}

        <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 14 }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.35, color: 'var(--p-text-1)', marginBottom: '0.2rem' }}>
            {title}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--p-text-3)', marginBottom: '1.1rem' }}>
            {photo.source ? `Source: ${photo.source}` : 'Source not recorded'}
            {photo.year ? ` · ${photo.year}` : ''}
            {` · ${index + 1} of ${total}`}
          </div>
          <PhotoDetails photo={photo} />
        </div>
      </div>
    </div>
  )
}

export default function PhotosPage() {
  const [data, setData] = useState<PhotosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterMap>({})
  const [q, setQ] = useState('')
  const [active, setActive] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const PER_PAGE = 48

  const baseUrl = '/api/photos'

  const load = useCallback((f: FilterMap, query: string, p: number) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), perPage: String(PER_PAGE) })
    for (const [k, v] of Object.entries(f)) if (v) params.set(k, v)
    if (query) params.set('q', query)
    jsonFetch<PhotosData>(`${baseUrl}?${params.toString()}`)
      .then(d => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

  const activeItems = useMemo(() => data?.items ?? [], [data])
  const activeIndex = useMemo(() => (active === null ? -1 : activeItems.findIndex(p => p.id === active)), [active, activeItems])

  const activePhoto = activeIndex >= 0 ? activeItems[activeIndex] : null

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <section id="content" style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Archive · Photo Library</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>The <span className="p-serif">photo library</span></h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '40rem', margin: 0 }}>
            Photographs curated by year, event, location, person, institution, parliament and theme — filter across any combination.
          </p>
        </div>
      </section>

      <section className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem' }}>
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
              onChange={e => { setQ(e.target.value); setPage(1) }}
            style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.55rem 0.9rem', color: 'var(--p-text-1)', fontSize: '0.8rem', outline: 'none', minWidth: 150 }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            {loading ? 'Loading…' : `${(data?.total ?? 0).toLocaleString()} photograph${data?.total === 1 ? '' : 's'} in the curated library`}
          </span>
          {(Object.keys(filters).length > 0 || q) && (
            <button onClick={() => { setFilters({}); setQ(''); setPage(1) }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
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
                      {p.source && (
                        <span title={`Source: ${p.source}`} style={{ fontSize: '0.62rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', border: '1px solid var(--p-border-2)', borderRadius: 999, padding: '0.08rem 0.45rem' }}>
                          {p.source}
                        </span>
                      )}
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

        {(() => {
          const totalPages = Math.ceil((data?.total ?? 0) / PER_PAGE)
          if (totalPages <= 1) return null
          const start = Math.max(1, Math.min(page - 4, totalPages - 9))
          const nums = Array.from({ length: Math.min(10, totalPages) }, (_, i) => start + i)
          const pageBtn = (label: React.ReactNode, target: number, opts?: { active?: boolean; disabled?: boolean; key?: number | string }) => (
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
            >{label}</button>
          )
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '2.25rem', flexWrap: 'wrap' }}>
              {pageBtn(<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><ChevronLeft size={14} /> Prev</span>, page - 1, { disabled: page <= 1 })}
              {nums.map(p => pageBtn(p, p, { active: p === page, key: p }))}
              {pageBtn(<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>Next <ChevronRight size={14} /></span>, page + 1, { disabled: page >= totalPages })}
            </div>
          )
        })()}
      </section>

      {/* Lightbox */}
      {activePhoto && (
        <PhotoLightbox
          photo={activePhoto}
          index={activeIndex}
          total={activeItems.length}
          onClose={() => setActive(null)}
          onPrev={() => setActive(activeItems[activeIndex - 1].id)}
          onNext={() => setActive(activeItems[activeIndex + 1].id)}
        />
      )}

      <PublicFooter />
    </div>
  )
}