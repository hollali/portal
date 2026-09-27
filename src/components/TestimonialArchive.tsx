'use client'

import {
  Fragment,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ARCHIVE_COLLECTION_NAV } from '@/lib/library'
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Quote,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  User,
  X,
  ZoomIn,
} from 'lucide-react'

export interface TestimonialRecord {
  id: number
  author: string
  role: string | null
  quote: string
  source: string | null
  year: number | null
  photoUrl: string | null
}

interface FacetOption {
  value: string
  count: number
}

type ViewMode = 'grid' | 'chronological'
type DetailRow = { label: string; value: ReactNode }

const ROUTE = '/archives/testimonials'

const mono = { fontFamily: 'var(--font-mono), monospace' } as const
const detailLabel = {
  fontFamily: 'var(--font-mono), monospace',
  textTransform: 'uppercase',
  fontSize: '0.625rem',
  letterSpacing: '0.06em',
  color: 'var(--p-text-4)',
  fontWeight: 600,
} as const

const QUICK_FACETS: { key: string; label: string }[] = [
  { key: 'year', label: 'Year' },
  { key: 'role', label: 'Role' },
]

const PANEL_FACETS: { key: string; label: string }[] = [
  { key: 'role', label: 'Role' },
  { key: 'source', label: 'Source' },
]

const ALL_FACETS: string[] = Array.from(
  new Set([...QUICK_FACETS, ...PANEL_FACETS].map(f => f.key)),
)

const FACET_LABELS: Record<string, string> = {
  ...Object.fromEntries([...QUICK_FACETS, ...PANEL_FACETS].map(f => [f.key, f.label])),
}

function isPresent(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

function yearKey(item: TestimonialRecord): string {
  return item.year ? String(item.year) : 'Undated'
}

function avatar(item: TestimonialRecord, size: number) {
  return item.photoUrl ? (
    <img
      src={item.photoUrl}
      alt={item.author}
      width={size}
      height={size}
      loading="lazy"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: '1px solid var(--p-border-3)',
        flexShrink: 0,
      }}
    />
  ) : (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--p-surface-2)',
        border: '1px solid var(--p-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--p-text-4)',
        flexShrink: 0,
      }}
    >
      <User size={Math.round(size * 0.42)} />
    </span>
  )
}

function DetailGroup({ title, rows }: { title: string; rows: DetailRow[] }) {
  const present = rows.filter(r => isPresent(r.value))
  if (present.length === 0) return null
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h3
        style={{
          ...mono,
          fontSize: '0.6875rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--primary)',
          margin: '0 0 0.5rem',
          fontWeight: 700,
        }}
      >
        {title}
      </h3>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '0.45rem 1rem',
          margin: 0,
          fontSize: '0.85rem',
        }}
      >
        {present.map(r => (
          <Fragment key={r.label}>
            <dt style={{ ...detailLabel, alignSelf: 'baseline', paddingTop: '0.1rem' }}>{r.label}</dt>
            <dd style={{ margin: 0, color: 'var(--p-text-1)', wordBreak: 'break-word', lineHeight: 1.5 }}>{r.value}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  )
}

function TestimonialDetails({ item }: { item: TestimonialRecord }) {
  const about: DetailRow[] = [
    { label: 'Catalogue ID', value: `#${item.id}` },
    { label: 'Attributed to', value: item.author },
    { label: 'Role', value: item.role },
    { label: 'Year', value: item.year },
  ]

  const provenance: DetailRow[] = [
    { label: 'Source', value: item.source },
    {
      label: 'Portrait',
      value: item.photoUrl ? (
        <a href={item.photoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
          View the original image
        </a>
      ) : null,
    },
    { label: 'Quotation length', value: `${item.quote.length} characters` },
  ]

  const technical: DetailRow[] = [
    { label: 'Record ID', value: `#${item.id}` },
    { label: 'Portrait held', value: item.photoUrl ? 'Yes' : 'No' },
  ]

  return (
    <div>
      <DetailGroup title="About this testimonial" rows={about} />
      <DetailGroup title="Provenance" rows={provenance} />

      <details style={{ borderTop: '1px solid var(--p-border)', paddingTop: '0.75rem', marginTop: '1.25rem' }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: '0.75rem',
            ...mono,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--p-text-3)',
          }}
        >
          Technical details
        </summary>
        <div style={{ marginTop: '0.75rem' }}>
          <DetailGroup title="Ingest record" rows={technical} />
        </div>
      </details>
    </div>
  )
}

function TestimonialCard({ item, onOpen }: { item: TestimonialRecord; onOpen: (id: number) => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item.id)
        }
      }}
      aria-label={`Read the testimonial from ${item.author}`}
      className="p-card-lift"
      style={{
        border: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
        position: 'relative',
      }}
    >
      {/* Attribution band — the testimonial equivalent of the photo card's media pane */}
      <div
        style={{
          position: 'relative',
          padding: '0.85rem 1rem',
          background: 'linear-gradient(140deg, color-mix(in srgb, var(--primary) 12%, var(--p-surface-2)) 0%, var(--p-surface-2) 100%)',
          borderBottom: '1px solid var(--p-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        {avatar(item, 30)}
        <span
          style={{
            fontSize: '0.65rem',
            ...mono,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--p-text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.author}
        </span>
        <span
          style={{
            position: 'absolute',
            right: '0.65rem',
            top: '0.65rem',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(15, 17, 23, 0.75)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.85,
          }}
        >
          <ZoomIn size={13} />
        </span>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: '0.55rem',
          }}
        >
          <span style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>
            {yearKey(item)}
          </span>
          {item.source && (
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--p-text-4)',
                ...mono,
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '60%',
              }}
            >
              {item.source}
            </span>
          )}
        </div>

        <Quote size={18} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
        <blockquote
          style={{
            margin: 0,
            fontSize: '0.875rem',
            lineHeight: 1.6,
            fontStyle: 'italic',
            color: 'var(--p-text-1)',
            display: '-webkit-box',
            WebkitLineClamp: 5,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          &ldquo;{item.quote}&rdquo;
        </blockquote>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          {avatar(item, 26)}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--p-text-1)' }}>{item.author}</div>
            {item.role && (
              <div
                style={{
                  fontSize: '0.68rem',
                  color: 'var(--p-text-3)',
                  lineHeight: 1.35,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.role}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TestimonialLightbox({
  item,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  item: TestimonialRecord
  index: number
  total: number
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

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
      if (e.key === 'ArrowLeft' && index > 0 && onPrev) {
        e.preventDefault()
        onPrev()
        return
      }
      if (e.key === 'ArrowRight' && index < total - 1 && onNext) {
        e.preventDefault()
        onNext()
        return
      }
      if (e.key !== 'Tab') return
      const node = dialogRef.current
      if (!node) return
      const focusable = node.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
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

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    const trigger = document.activeElement as HTMLElement | null
    const target = node.querySelector<HTMLElement>('[data-autofocus]')
    if (target) target.focus()
    else node.focus()
    return () => trigger?.focus?.({ preventScroll: true })
  }, [])

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return
    const url = `${window.location.origin}/archives/testimonials?item=${item.id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    })
  }

  const navButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(21, 23, 30, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s, color 0.2s',
  }
  const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'var(--primary)'
    e.currentTarget.style.color = 'var(--primary-fg)'
  }
  const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'rgba(21, 23, 30, 0.75)'
    e.currentTarget.style.color = '#fff'
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
        background: 'rgba(5, 7, 12, 0.88)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(0.5rem, 2vw, 1.5rem)',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Testimonial from ${item.author}`}
        tabIndex={-1}
        className="media-lightbox-modal"
        style={{
          maxWidth: 1320,
          width: '100%',
          maxHeight: '94vh',
          height: '100%',
          background: 'var(--p-surface)',
          border: '1px solid var(--p-border-3)',
          borderRadius: 20,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.1fr)',
          boxShadow: '0 30px 100px -20px rgba(0,0,0,0.8)',
          outline: 'none',
          position: 'relative',
        }}
      >
        {/* ── Left pane: the quotation, set as a reading surface ── */}
        <div
          style={{
            position: 'relative',
            background: '#090a0f',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflowY: 'auto',
            padding: 'clamp(1.5rem, 4vw, 3.5rem)',
            borderRight: '1px solid var(--p-border)',
          }}
        >
          {index > 0 && onPrev && (
            <button onClick={onPrev} aria-label="Previous testimonial" style={{ ...navButtonStyle, left: '1.25rem' }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
              <ChevronLeft size={22} />
            </button>
          )}
          {index < total - 1 && onNext && (
            <button onClick={onNext} aria-label="Next testimonial" style={{ ...navButtonStyle, right: '1.25rem' }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
              <ChevronRight size={22} />
            </button>
          )}

          <div style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Quote size={30} style={{ color: 'color-mix(in srgb, var(--primary) 70%, white)' }} />
            <blockquote
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize: 'clamp(1.1rem, 2.3vw, 1.6rem)',
                lineHeight: 1.6,
                fontStyle: 'italic',
                color: '#f2f2ef',
              }}
            >
              &ldquo;{item.quote}&rdquo;
            </blockquote>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
              {avatar(item, 40)}
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>{item.author}</div>
                {item.role && <div style={{ fontSize: '0.78rem', marginTop: '0.1rem' }}>{item.role}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right pane: archival record ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--p-surface)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--p-border)',
            }}
          >
            <span style={{ ...mono, fontSize: '0.6875rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)' }}>
              Testimonial Record
            </span>
            <button
              onClick={onClose}
              data-autofocus
              aria-label="Close testimonial viewer"
              style={{
                background: 'var(--p-surface-2)',
                border: '1px solid var(--p-border-3)',
                color: 'var(--p-text-1)',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ padding: '1.5rem', flex: 1 }}>
            <h2
              style={{
                fontFamily: 'var(--font-display), sans-serif',
                fontSize: '1.35rem',
                lineHeight: 1.3,
                fontWeight: 700,
                margin: '0 0 0.35rem',
                color: 'var(--p-text-1)',
              }}
            >
              {item.author}
            </h2>

            <div style={{ fontSize: '0.75rem', color: 'var(--p-text-3)', marginBottom: '0.85rem' }}>
              {item.role ? `Attributed to ${item.role}` : 'Attribution not recorded'}
              {item.year ? ` · ${item.year}` : ''}
              {` · ${index + 1} of ${total}`}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
              {item.year && (
                <span
                  style={{
                    ...mono,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                    color: 'var(--primary)',
                    border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                    borderRadius: 999,
                    padding: '0.2rem 0.65rem',
                  }}
                >
                  {item.year}
                </span>
              )}
              {item.role && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--p-text-2)',
                    background: 'var(--p-surface-2)',
                    border: '1px solid var(--p-border-2)',
                    borderRadius: 999,
                    padding: '0.2rem 0.65rem',
                  }}
                >
                  {item.role}
                </span>
              )}
              {item.source && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--p-text-3)',
                    background: 'var(--p-surface-2)',
                    border: '1px solid var(--p-border-2)',
                    borderRadius: 999,
                    padding: '0.2rem 0.65rem',
                  }}
                >
                  {item.source}
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '1.75rem',
                paddingBottom: '1.25rem',
                borderBottom: '1px solid var(--p-border)',
              }}
            >
              <button
                onClick={handleCopyLink}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'var(--primary)',
                  color: 'var(--primary-fg)',
                  border: 'none',
                  borderRadius: 999,
                  padding: '0.45rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={14} style={{ color: 'var(--primary-fg)' }} /> : <Share2 size={14} />}
                {copied ? 'Link copied!' : 'Share link'}
              </button>
            </div>

            <TestimonialDetails item={item} />
          </div>
        </div>
      </div>
    </div>
  )
}

function TestimonialLibraryContent({ records }: { records: TestimonialRecord[] }) {
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) === 'chronological' ? 'chronological' : 'grid',
  )
  const [activeItemId, setActiveItemId] = useState<number | null>(
    searchParams.get('item') ? parseInt(searchParams.get('item')!, 10) || null : null,
  )
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const key of ALL_FACETS) {
      const v = searchParams.get(key)
      if (v) map[key] = v
    }
    return map
  })

  const facetOptions = useCallback(
    (key: string): FacetOption[] => {
      const counts = new Map<string, number>()
      for (const r of records) {
        const raw = (r as unknown as Record<string, unknown>)[key]
        const value = raw === null || raw === undefined || raw === '' ? null : String(raw)
        if (!value) continue
        counts.set(value, (counts.get(value) || 0) + 1)
      }
      return Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => (key === 'year' ? b.value.localeCompare(a.value) : b.count - a.count || a.value.localeCompare(b.value)))
    },
    [records],
  )

  const matches = useCallback(
    (r: TestimonialRecord, filtersMap: Record<string, string>, query: string) => {
      for (const [k, v] of Object.entries(filtersMap)) {
        if (!v) continue
        const raw = (r as unknown as Record<string, unknown>)[k]
        const value = raw === null || raw === undefined ? '' : String(raw)
        if (value !== v) return false
      }
      const needle = query.trim().toLowerCase()
      if (!needle) return true
      return [r.author, r.role, r.quote, r.source, r.year ? String(r.year) : '']
        .filter(Boolean)
        .some(field => String(field).toLowerCase().includes(needle))
    },
    [],
  )

  const syncUrl = useCallback(
    (newQ: string, newFilters: Record<string, string>, newView: ViewMode, newItemId: number | null) => {
      if (typeof window === 'undefined') return
      const sp = new URLSearchParams()
      if (newQ.trim()) sp.set('q', newQ.trim())
      for (const [k, v] of Object.entries(newFilters)) if (v) sp.set(k, v)
      if (newView !== 'grid') sp.set('view', newView)
      if (newItemId !== null) sp.set('item', String(newItemId))
      const qs = sp.toString()
      window.history.replaceState(null, '', qs ? `${ROUTE}?${qs}` : ROUTE)
    },
    [],
  )

  useEffect(() => {
    syncUrl(q, filters, viewMode, activeItemId)
  }, [q, filters, viewMode, activeItemId, syncUrl])

  const setFilter = (key: string, value: string) => {
    setFilters(prev => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  }

  const clearAllFilters = () => {
    setQ('')
    setFilters({})
  }

  const items = useMemo(() => records.filter(r => matches(r, filters, q)), [records, filters, q, matches])

  const activeIndex = useMemo(
    () => (activeItemId === null ? -1 : items.findIndex(i => i.id === activeItemId)),
    [activeItemId, items],
  )
  const activeItem = useMemo(
    () => (activeIndex >= 0 ? items[activeIndex] : records.find(r => r.id === activeItemId) ?? null),
    [activeIndex, items, records, activeItemId],
  )

  const activeFilterEntries = useMemo(() => {
    const list: { key: string; label: string; value: string }[] = []
    if (q) list.push({ key: 'q', label: 'Search', value: `“${q}”` })
    for (const [k, v] of Object.entries(filters)) {
      if (!v) continue
      list.push({ key: k, label: FACET_LABELS[k] || k, value: v })
    }
    return list
  }, [q, filters])
  const activeFilterCount = activeFilterEntries.length

  const yearGroups = useMemo(() => {
    const map = new Map<string, TestimonialRecord[]>()
    for (const item of items) {
      const key = yearKey(item)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries()).map(([year, groupItems]) => ({ year, items: groupItems }))
  }, [items])

  const openItem = (id: number) => {
    setActiveItemId(id)
    syncUrl(q, filters, viewMode, id)
  }

  const closeItem = () => {
    setActiveItemId(null)
    syncUrl(q, filters, viewMode, null)
  }

  return (
    <div>
      {/* ── Hero & archive cross-navigation ── */}
      <section id="content" style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ ...mono, fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>
            Archive · Testimonials
          </span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>
            What <span className="p-serif">others have said</span>
          </h1>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '42rem', margin: 0 }}>
            Tributes and assessments from prominent figures and institutions in Ghana and the world.
          </p>

          <nav aria-label="Archive collections" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.75rem' }}>
            {ARCHIVE_COLLECTION_NAV.map(l => {
              const current = l.href === ROUTE
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={current ? 'page' : undefined}
                  style={{
                    fontSize: '0.75rem',
                    ...mono,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: current ? 'var(--primary-fg)' : 'var(--p-text-3)',
                    textDecoration: 'none',
                    background: current ? 'var(--primary)' : 'var(--p-surface)',
                    border: `1px solid ${current ? 'var(--primary)' : 'var(--p-border)'}`,
                    borderRadius: 999,
                    padding: '0.35rem 0.85rem',
                    fontWeight: current ? 700 : undefined,
                  }}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </section>

      {/* ── Main exploration section ── */}
      <section className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2rem, 4vw, 3.5rem) 1.5rem' }}>
        {/* Search & view controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: '1 1 300px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--p-text-4)', pointerEvents: 'none' }} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search attributions, roles, quotations…"
              aria-label="Search testimonials"
              style={{
                width: '100%',
                background: 'var(--p-surface)',
                border: '1px solid var(--p-border-3)',
                borderRadius: 999,
                padding: '0.65rem 2.5rem 0.65rem 2.6rem',
                color: 'var(--p-text-1)',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
            {q && (
              <button
                onClick={() => setQ('')}
                aria-label="Clear search text"
                style={{ position: 'absolute', right: '0.85rem', background: 'none', border: 'none', color: 'var(--p-text-4)', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(prev => !prev)}
            aria-expanded={showFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: activeFilterCount > 0 ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'var(--p-surface)',
              border: `1px solid ${activeFilterCount > 0 ? 'var(--primary)' : 'var(--p-border-3)'}`,
              color: activeFilterCount > 0 ? 'var(--primary)' : 'var(--p-text-1)',
              borderRadius: 999,
              padding: '0.65rem 1.15rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={15} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span style={{ ...mono, fontSize: '0.7rem', background: 'var(--primary)', color: 'var(--primary-fg)', borderRadius: 999, padding: '0.1rem 0.45rem', marginLeft: '0.2rem' }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          <div style={{ display: 'inline-flex', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.2rem' }}>
            {(
              [
                { value: 'grid' as ViewMode, label: 'Gallery', Icon: LayoutGrid },
                { value: 'chronological' as ViewMode, label: 'By Year', Icon: Calendar },
              ]
            ).map(({ value, label, Icon }) => {
              const active = viewMode === value
              return (
                <button
                  key={value}
                  onClick={() => setViewMode(value)}
                  aria-pressed={active}
                  title={value === 'grid' ? 'Gallery Grid View' : 'Chronological Archive View'}
                  aria-label={value === 'grid' ? 'Switch to Gallery Grid view' : 'Switch to Chronological Archive view'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    border: 'none',
                    background: active ? 'var(--primary)' : 'transparent',
                    color: active ? 'var(--primary-fg)' : 'var(--p-text-3)',
                    borderRadius: 999,
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
                  }}
                >
                  <Icon size={14} /> {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Quick facet pill strips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
          {QUICK_FACETS.map(f => {
            const options = facetOptions(f.key)
            if (options.length === 0) return null
            return (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
                <span style={{ ...mono, fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--p-text-4)', minWidth: '4.5rem' }}>
                  {f.label}
                </span>
                <button
                  onClick={() => setFilter(f.key, '')}
                  style={{
                    fontSize: '0.72rem',
                    ...mono,
                    textTransform: 'uppercase',
                    border: `1px solid ${!filters[f.key] ? 'var(--primary)' : 'var(--p-border)'}`,
                    background: !filters[f.key] ? 'var(--primary)' : 'var(--p-surface)',
                    color: !filters[f.key] ? 'var(--primary-fg)' : 'var(--p-text-3)',
                    borderRadius: 999,
                    padding: '0.25rem 0.65rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  All
                </button>
                {options.map(o => {
                  const active = filters[f.key] === o.value
                  return (
                    <button
                      key={o.value}
                      onClick={() => setFilter(f.key, active ? '' : o.value)}
                      style={{
                        fontSize: '0.72rem',
                        ...mono,
                        border: `1px solid ${active ? 'var(--primary)' : 'var(--p-border)'}`,
                        background: active ? 'var(--primary)' : 'var(--p-surface)',
                        color: active ? 'var(--primary-fg)' : 'var(--p-text-2)',
                        borderRadius: 999,
                        padding: '0.25rem 0.65rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {o.value}
                      {o.count ? ` (${o.count})` : ''}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Expandable secondary filters */}
        {showFilters && (
          <div
            style={{
              background: 'var(--p-surface)',
              border: '1px solid var(--p-border-3)',
              borderRadius: 16,
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {PANEL_FACETS.map(f => {
              const options = facetOptions(f.key)
              return (
                <div key={f.key}>
                  <label
                    htmlFor={`testimonial-filter-${f.key}`}
                    style={{ display: 'block', ...mono, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--p-text-3)', marginBottom: '0.35rem' }}
                  >
                    {f.label}
                  </label>
                  <select
                    id={`testimonial-filter-${f.key}`}
                    value={filters[f.key] || ''}
                    onChange={e => setFilter(f.key, e.target.value)}
                    style={{ width: '100%', background: 'var(--p-surface-2)', border: '1px solid var(--p-border-3)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--p-text-1)', fontSize: '0.82rem', outline: 'none' }}
                  >
                    <option value="">All {f.label.toLowerCase()}</option>
                    {options.map(o => (
                      <option key={o.value} value={o.value}>
                        {o.value} ({o.count})
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}

        {/* Active filters & summary */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--p-text-3)', marginRight: '0.35rem' }}>
              {items.length} testimonial{items.length === 1 ? '' : 's'} found
            </span>

            {activeFilterEntries.map(e => (
              <span
                key={e.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.72rem',
                  background: 'var(--p-surface)',
                  border: '1px solid var(--p-border-3)',
                  color: 'var(--p-text-1)',
                  borderRadius: 999,
                  padding: '0.2rem 0.6rem',
                }}
              >
                <span style={{ color: 'var(--p-text-4)' }}>{e.label}:</span>
                <strong style={{ color: 'var(--primary)' }}>{e.value}</strong>
                <button
                  onClick={() => {
                    if (e.key === 'q') setQ('')
                    else setFilter(e.key, '')
                  }}
                  aria-label={`Remove filter for ${e.label}`}
                  style={{ background: 'none', border: 'none', color: 'var(--p-text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0.2rem 0.5rem',
              }}
            >
              <RotateCcw size={13} /> Reset filters
            </button>
          )}
        </div>

        {/* Content */}
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 1.5rem', border: '1px dashed var(--p-border)', borderRadius: 20 }}>
            <Search size={36} style={{ color: 'var(--p-text-4)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--p-text-1)', margin: '0 0 0.5rem' }}>No testimonials match your search</h3>
            <p style={{ color: 'var(--p-text-3)', fontSize: '0.9rem', maxWidth: '28rem', margin: '0 auto 1.5rem' }}>
              {records.length === 0
                ? 'Testimonials are still being compiled. Check back soon.'
                : 'We could not find any testimonials matching the selected criteria. Try removing some filters or searching with different terms.'}
            </p>
            {records.length > 0 && (
              <button
                onClick={clearAllFilters}
                style={{ background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1.25rem' }}>
            {items.map(item => (
              <TestimonialCard key={item.id} item={item} onOpen={openItem} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            {yearGroups.map(group => (
              <section key={group.year} aria-label={`Year ${group.year}`}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', marginBottom: '1.25rem' }}>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-serif), Georgia, serif',
                      fontStyle: 'italic',
                      fontWeight: 500,
                      fontSize: '2rem',
                      lineHeight: 1,
                      letterSpacing: '-0.01em',
                      color: 'var(--p-text-1)',
                    }}
                  >
                    {group.year}
                  </h3>
                  <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--p-border)' }} />
                  <span style={{ ...mono, fontSize: '0.75rem', letterSpacing: '0.08em', color: 'var(--p-text-4)' }}>
                    {group.items.length} testimonial{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
                  {group.items.map(item => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openItem(item.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openItem(item.id)
                        }
                      }}
                      aria-label={`Read the testimonial from ${item.author}`}
                      className="p-card-lift"
                      style={{
                        border: '1px solid var(--p-border)',
                        background: 'var(--p-surface)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ padding: '0.85rem 0.9rem 0' }}>
                        <span style={{ ...mono, fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
                          {item.role || 'Testimonial'}
                        </span>
                      </div>
                      <div style={{ padding: '0.6rem 0.9rem 0.9rem' }}>
                        <blockquote
                          style={{
                            margin: 0,
                            fontSize: '0.82rem',
                            lineHeight: 1.6,
                            fontStyle: 'italic',
                            color: 'var(--p-text-1)',
                            display: '-webkit-box',
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            marginBottom: '0.5rem',
                          }}
                        >
                          &ldquo;{item.quote}&rdquo;
                        </blockquote>
                        <div style={{ fontSize: '0.72rem', color: 'var(--p-text-3)', ...mono }}>{item.author}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {activeItem && (
        <TestimonialLightbox
          item={activeItem}
          index={activeIndex >= 0 ? activeIndex : 0}
          total={items.length > 0 ? items.length : 1}
          onClose={closeItem}
          onPrev={activeIndex > 0 ? () => openItem(items[activeIndex - 1].id) : undefined}
          onNext={activeIndex < items.length - 1 ? () => openItem(items[activeIndex + 1].id) : undefined}
        />
      )}
    </div>
  )
}

export default function TestimonialArchive({ records }: { records: TestimonialRecord[] }) {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <span style={{ ...mono, fontSize: '0.85rem', color: 'var(--p-text-3)' }}>Loading Testimonial Record…</span>
        </div>
      }
    >
      <TestimonialLibraryContent records={records} />
    </Suspense>
  )
}
