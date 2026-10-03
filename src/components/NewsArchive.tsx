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
import { jsonFetch } from '@/lib/jsonFetch'
import { MEDIA_COLLECTION_NAV, parseYearFromDate } from '@/lib/library'
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Globe,
  LayoutGrid,
  Newspaper,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  X,
} from 'lucide-react'

interface NewsItem {
  id: number
  title: string | null
  url: string | null
  source: string | null
  sourceName: string | null
  query: string | null
  date: string | null
  collectedAt: string | null
  snippet: string | null
  notes: string | null
  tags: string | null
}

interface FacetOption {
  value: string
  count: number
}

interface NewsResponse {
  items: NewsItem[]
  total: number
  page: number
  perPage: number
  sources: string[]
  facets: Record<string, FacetOption[]>
}

type ViewMode = 'grid' | 'chronological'
type DetailRow = { label: string; value: ReactNode }

const mono = { fontFamily: 'var(--font-mono), monospace' } as const
const detailLabel = {
  fontFamily: 'var(--font-mono), monospace',
  textTransform: 'uppercase',
  fontSize: '0.625rem',
  letterSpacing: '0.06em',
  color: 'var(--p-text-4)',
  fontWeight: 600,
} as const

const ROUTE = '/news'
const DEFAULT_PER_PAGE = 24
const PER_PAGE_OPTIONS = [12, 24, 48]
const SKELETON_COUNT = 12

const ORDER_OPTIONS = [
  { value: 'id:desc', label: 'Recently collected' },
  { value: 'id:asc', label: 'Oldest collected' },
  { value: 'collectedAt:desc', label: 'Newest collection date' },
  { value: 'collectedAt:asc', label: 'Oldest collection date' },
  { value: 'date:desc', label: 'Newest published' },
  { value: 'date:asc', label: 'Oldest published' },
  { value: 'title:asc', label: 'Headline A–Z' },
  { value: 'title:desc', label: 'Headline Z–A' },
] as const

const QUICK_FACETS: { key: string; label: string }[] = [
  { key: 'source', label: 'Source' },
  { key: 'year', label: 'Year' },
]

function isPresent(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

function hostname(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function sourceOf(item: NewsItem): string {
  return item.sourceName || item.source || hostname(item.url) || 'Unattributed'
}

function dateOf(item: NewsItem): string {
  return item.date || (item.collectedAt ? item.collectedAt.slice(0, 10) : '')
}

function yearOf(item: NewsItem): string | null {
  return parseYearFromDate(item.date, item.collectedAt)
}

function headline(item: NewsItem): string {
  return item.title || `Clipping #${item.id}`
}

function parseTags(tags: string | null): string[] {
  return String(tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DetailGroup({ title, rows }: { title: string; rows: DetailRow[] }) {
  const present = rows.filter((r) => isPresent(r.value))
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
        {present.map((r) => (
          <Fragment key={r.label}>
            <dt style={{ ...detailLabel, alignSelf: 'baseline', paddingTop: '0.1rem' }}>{r.label}</dt>
            <dd style={{ margin: 0, color: 'var(--p-text-1)', wordBreak: 'break-word', lineHeight: 1.5 }}>{r.value}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  )
}

function ClippingDetails({ item }: { item: NewsItem }) {
  const tags = parseTags(item.tags)
  const host = hostname(item.url)

  const about: DetailRow[] = [
    { label: 'Catalogue ID', value: `#${item.id}` },
    { label: 'Year', value: yearOf(item) },
    { label: 'Published', value: item.date },
    { label: 'Source', value: sourceOf(item) },
    { label: 'Crawler label', value: item.source },
    { label: 'Origin host', value: host },
  ]

  const provenance: DetailRow[] = [
    { label: 'Search query', value: item.query },
    { label: 'Collected', value: formatTimestamp(item.collectedAt) },
    {
      label: 'Original',
      value: item.url ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
          View on the web
        </a>
      ) : null,
    },
    {
      label: 'Link',
      value: item.url ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--p-text-2)', textDecoration: 'underline' }}>
          {item.url}
        </a>
      ) : null,
    },
  ]

  const technical: DetailRow[] = [
    { label: 'Record ID', value: `#${item.id}` },
    { label: 'Crawler', value: item.source },
    { label: 'Annotation', value: item.notes },
  ]

  return (
    <div>
      <DetailGroup title="About this clipping" rows={about} />
      <DetailGroup title="Provenance" rows={provenance} />

      {tags.length > 0 && (
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
            Tags
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--p-text-2)',
                  border: '1px solid var(--p-border-2)',
                  background: 'var(--p-surface-2)',
                  borderRadius: 999,
                  padding: '0.2rem 0.65rem',
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}

      {item.notes && item.notes !== item.snippet && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3
            style={{
              ...mono,
              fontSize: '0.6875rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--primary)',
              margin: '0 0 0.4rem',
              fontWeight: 700,
            }}
          >
            Notes
          </h3>
          <p
            style={{
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: 'var(--p-text-2)',
              margin: 0,
              background: 'var(--p-surface-2)',
              padding: '0.75rem',
              borderRadius: 8,
              border: '1px solid var(--p-border-2)',
            }}
          >
            {item.notes}
          </p>
        </div>
      )}

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

function ClippingCard({ item, onOpen }: { item: NewsItem; onOpen: (id: number) => void }) {
  const date = dateOf(item)
  const host = hostname(item.url)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item.id)
        }
      }}
      aria-label={`Open ${headline(item)}`}
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
      {/* Clipping header band — the news equivalent of the photo card's media pane */}
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
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'var(--p-surface)',
            border: '1px solid var(--p-border-3)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Newspaper size={14} />
        </span>
        <span
          style={{
            fontSize: '0.62rem',
            ...mono,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--p-text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sourceOf(item)}
        </span>
        {host && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '0.6rem',
              ...mono,
              color: 'var(--p-text-4)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '45%',
              flexShrink: 0,
            }}
          >
            {host}
          </span>
        )}
      </div>

      <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: '0.45rem',
          }}
        >
          <span style={{ ...mono, fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>
            {yearOf(item) || 'Undated'}
          </span>
          {date && (
            <span style={{ fontSize: '0.65rem', color: 'var(--p-text-4)', ...mono, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {date.slice(0, 10)}
            </span>
          )}
        </div>

        <h3
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--p-text-1)',
            lineHeight: 1.4,
            margin: '0 0 0.4rem',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {headline(item)}
        </h3>

        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            color: 'var(--p-text-3)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.snippet || 'No summary captured for this clipping.'}
        </p>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: '0.6rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <span style={{ ...mono, fontSize: '0.68rem', color: 'var(--p-text-4)' }}>#{item.id}</span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              aria-label="Open original article"
              title="Open original article"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 999,
                color: 'var(--p-text-4)',
                border: '1px solid var(--p-border)',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function LeadClipping({ item, onOpen }: { item: NewsItem; onOpen: (id: number) => void }) {
  const date = dateOf(item)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item.id)
        }
      }}
      aria-label={`Open ${headline(item)}`}
      className="p-card-lift news-lead-card"
      style={{
        gridColumn: '1 / -1',
        border: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
        borderRadius: 18,
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
      }}
    >
      <div style={{ padding: 'clamp(1.25rem, 3vw, 2rem)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <span
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            ...mono,
            fontSize: '0.625rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--primary)',
            border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
            background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
            padding: '0.3rem 0.65rem',
            borderRadius: 999,
            marginBottom: '0.85rem',
          }}
        >
          <Newspaper size={11} /> Latest · {sourceOf(item)}
        </span>
        <h3
          style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 'clamp(1.25rem, 2.6vw, 1.75rem)',
            letterSpacing: '-0.025em',
            lineHeight: 1.2,
            margin: 0,
            color: 'var(--p-text-1)',
          }}
        >
          {headline(item)}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--p-text-3)' }}>
          {date && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={13} /> {date.slice(0, 10)}
            </span>
          )}
          <span style={{ ...mono, fontSize: '0.7rem', color: 'var(--p-text-4)' }}>#{item.id}</span>
        </div>
      </div>
      <div
        className="news-lead-aside"
        style={{
          padding: 'clamp(1.25rem, 3vw, 2rem)',
          background: 'linear-gradient(140deg, color-mix(in srgb, var(--primary) 10%, transparent), transparent)',
          borderLeft: '1px solid var(--p-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--p-text-2)' }}>
          {item.snippet || `Clipping #${item.id} in the news archive.`}
        </p>
        <div style={{ marginTop: 'auto', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'var(--primary)',
                color: 'var(--primary-fg)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                padding: '0.45rem 1rem',
                borderRadius: 999,
              }}
            >
              Read the article <ExternalLink size={14} />
            </a>
          )}
          <Link
            href={`/news/${item.id}`}
            onClick={e => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--p-text-1)',
              border: '1px solid var(--p-border-3)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              padding: '0.45rem 1rem',
              borderRadius: 999,
            }}
          >
            Archive record <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function ClippingLightbox({
  item,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  item: NewsItem
  index: number
  total: number
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const title = headline(item)
  const host = hostname(item.url)
  const date = dateOf(item)

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
    const url = `${window.location.origin}/news/${item.id}`
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
        aria-label={title}
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
        {/* ── Left pane: the clipping itself, as a reading surface ── */}
        <div
          style={{
            position: 'relative',
            background: '#090a0f',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflowY: 'auto',
            padding: 'clamp(1.5rem, 4vw, 3rem)',
            borderRight: '1px solid var(--p-border)',
          }}
        >
          {index > 0 && onPrev && (
            <button onClick={onPrev} aria-label="Previous clipping" style={{ ...navButtonStyle, left: '1.25rem' }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
              <ChevronLeft size={22} />
            </button>
          )}
          {index < total - 1 && onNext && (
            <button onClick={onNext} aria-label="Next clipping" style={{ ...navButtonStyle, right: '1.25rem' }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
              <ChevronRight size={22} />
            </button>
          )}

          <div style={{ width: '100%', maxWidth: 700, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <span
              style={{
                ...mono,
                fontSize: '0.6875rem',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'color-mix(in srgb, var(--primary) 70%, white)',
              }}
            >
              {sourceOf(item)}
            </span>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-serif), Georgia, serif',
                fontSize: 'clamp(1.05rem, 2.2vw, 1.5rem)',
                lineHeight: 1.65,
                color: '#f2f2ef',
              }}
            >
              {item.snippet || 'No summary was captured for this clipping.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'var(--primary)',
                    color: 'var(--primary-fg)',
                    borderRadius: 999,
                    padding: '0.5rem 1.15rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Read the original article <ExternalLink size={14} />
                </a>
              )}
              {host && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', ...mono }}>
                  <Globe size={13} /> {host}
                </span>
              )}
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
              News Record
            </span>
            <button
              onClick={onClose}
              data-autofocus
              aria-label="Close clipping viewer"
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
              {title}
            </h2>

            <div style={{ fontSize: '0.75rem', color: 'var(--p-text-3)', marginBottom: '0.85rem' }}>
              {`Source: ${sourceOf(item)}`}
              {date ? ` · ${date.slice(0, 10)}` : ''}
              {` · ${index + 1} of ${total}`}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.25rem' }}>
              {yearOf(item) && (
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
                  {yearOf(item)}
                </span>
              )}
              {item.sourceName && (
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
                  {item.sourceName}
                </span>
              )}
              {host && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--p-text-3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: 'var(--p-surface-2)',
                    border: '1px solid var(--p-border-2)',
                    borderRadius: 999,
                    padding: '0.2rem 0.65rem',
                  }}
                >
                  <Globe size={12} /> {host}
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
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'var(--primary)',
                    color: 'var(--primary-fg)',
                    borderRadius: 999,
                    padding: '0.45rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Read article <ExternalLink size={14} />
                </a>
              )}

              <Link
                href={`/news/${item.id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'var(--p-surface-2)',
                  border: '1px solid var(--p-border-3)',
                  color: 'var(--p-text-1)',
                  borderRadius: 999,
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Archive record <ArrowRight size={14} />
              </Link>

              <button
                onClick={handleCopyLink}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'transparent',
                  border: '1px solid var(--p-border-2)',
                  color: 'var(--p-text-2)',
                  borderRadius: 999,
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Share2 size={14} />}
                {copied ? 'Link copied!' : 'Share link'}
              </button>
            </div>

            <ClippingDetails item={item} />
          </div>
        </div>
      </div>
    </div>
  )
}

function NewsLibraryContent() {
  const searchParams = useSearchParams()

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) || 1)
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) === 'chronological' ? 'chronological' : 'grid',
  )
  const [perPage, setPerPage] = useState(() => {
    const raw = parseInt(searchParams.get('perPage') || String(DEFAULT_PER_PAGE), 10)
    return PER_PAGE_OPTIONS.includes(raw) ? raw : DEFAULT_PER_PAGE
  })
  const [order, setOrder] = useState(() => {
    const raw = searchParams.get('order') || 'id:desc'
    return (ORDER_OPTIONS.find(o => o.value === raw)?.value ?? 'id:desc') as string
  })
  const [activeItemId, setActiveItemId] = useState<number | null>(
    searchParams.get('item') ? parseInt(searchParams.get('item')!, 10) || null : null,
  )
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const f of QUICK_FACETS) {
      const v = searchParams.get(f.key)
      if (v) map[f.key] = v
    }
    return map
  })

  const [data, setData] = useState<NewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [standaloneItem, setStandaloneItem] = useState<NewsItem | null>(null)
  const [exporting, setExporting] = useState(false)

  const syncUrl = useCallback(
    (newQ: string, newFilters: Record<string, string>, newPage: number, newView: ViewMode, newPerPage: number, newOrder: string, newItemId: number | null) => {
      if (typeof window === 'undefined') return
      const sp = new URLSearchParams()
      if (newQ.trim()) sp.set('q', newQ.trim())
      for (const [k, v] of Object.entries(newFilters)) if (v) sp.set(k, v)
      if (newPage > 1) sp.set('page', String(newPage))
      if (newView !== 'grid') sp.set('view', newView)
      if (newPerPage !== DEFAULT_PER_PAGE) sp.set('perPage', String(newPerPage))
      if (newOrder !== 'id:desc') sp.set('order', newOrder)
      if (newItemId !== null) sp.set('item', String(newItemId))
      const qs = sp.toString()
      window.history.replaceState(null, '', qs ? `${ROUTE}?${qs}` : ROUTE)
    },
    [],
  )

  const load = useCallback(
    (f: Record<string, string>, query: string, p: number, size: number, sortSpec: string) => {
      setLoading(true)
      const [sort = 'id', dir = 'desc'] = sortSpec.split(':')
      const params = new URLSearchParams({ page: String(p), perPage: String(size), sort, dir })
      for (const [k, v] of Object.entries(f)) if (v) params.set(k, v)
      if (query) params.set('q', query)
      jsonFetch<NewsResponse>(`/api/news?${params.toString()}`)
        .then(d => {
          if (d) setData(d)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    },
    [],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      load(filters, q, page, perPage, order)
      syncUrl(q, filters, page, viewMode, perPage, order, activeItemId)
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [filters, q, page, perPage, order, viewMode, activeItemId, load, syncUrl])

  // Deep-link loader for a clipping that is not on the current page of results
  useEffect(() => {
    if (!activeItemId || !data?.items) return
    if (data.items.some(i => i.id === activeItemId)) return
    jsonFetch<NewsItem>(`/api/news/${activeItemId}`)
      .then(res => {
        if (res) setStandaloneItem(res)
      })
      .catch(() => {})
  }, [activeItemId, data])

  const setFilter = (key: string, value: string) => {
    setPage(1)
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
    setPage(1)
  }

  const removeSingleFilter = (key: string) => {
    if (key === 'q') setQ('')
    else setFilter(key, '')
  }

  const changePage = (p: number) => {
    setPage(p)
    setActiveItemId(null)
    setStandaloneItem(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openItem = (id: number) => {
    setActiveItemId(id)
    syncUrl(q, filters, page, viewMode, perPage, order, id)
  }

  const closeItem = () => {
    setActiveItemId(null)
    setStandaloneItem(null)
    syncUrl(q, filters, page, viewMode, perPage, order, null)
  }

  const handleExport = () => {
    setExporting(true)
    const [sort = 'id', dir = 'desc'] = order.split(':')
    const params = new URLSearchParams({ page: '1', perPage: '100', sort, dir })
    if (q) params.set('q', q)
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v)
    jsonFetch<NewsResponse>(`/api/news?${params.toString()}`)
      .then(d => {
        const blob = new Blob([JSON.stringify(d?.items ?? [], null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `news_${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => {})
      .finally(() => setExporting(false))
  }

  const items = useMemo(() => data?.items ?? [], [data])
  const activeIndex = useMemo(
    () => (activeItemId === null ? -1 : items.findIndex(i => i.id === activeItemId)),
    [activeItemId, items],
  )
  const activeItem = useMemo(() => {
    if (activeIndex >= 0) return items[activeIndex]
    return standaloneItem
  }, [activeIndex, items, standaloneItem])

  const activeFilterEntries = useMemo(() => {
    const list: { key: string; label: string; value: string }[] = []
    if (q) list.push({ key: 'q', label: 'Search', value: `“${q}”` })
    for (const [k, v] of Object.entries(filters)) {
      if (!v) continue
      const f = QUICK_FACETS.find(x => x.key === k)
      list.push({ key: k, label: f?.label || k, value: v })
    }
    if (order !== 'id:desc') {
      list.push({ key: 'order', label: 'Order', value: ORDER_OPTIONS.find(o => o.value === order)?.label || order })
    }
    if (perPage !== DEFAULT_PER_PAGE) list.push({ key: 'perPage', label: 'Per page', value: String(perPage) })
    return list
  }, [q, filters, order, perPage])

  const activeFilterCount = activeFilterEntries.length

  const yearGroups = useMemo(() => {
    const map = new Map<string, NewsItem[]>()
    for (const item of items) {
      const key = yearOf(item) || 'Undated'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries()).map(([year, groupItems]) => ({ year, items: groupItems }))
  }, [items])

  const totalPages = Math.ceil((data?.total ?? 0) / perPage)

  // The lead story only makes sense on an unfiltered first page in gallery view
  const leadItem = viewMode === 'grid' && page === 1 && !q && Object.keys(filters).length === 0 ? items[0] : undefined
  const gridItems = leadItem ? items.slice(1) : items

  const facetOptions = (key: string) => (data?.facets?.[key] ?? []).filter(Boolean)

  return (
    <div>
      {/* ── Hero & media cross-navigation ── */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)', margin: '-2rem -1.5rem 0' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ ...mono, fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>
            Archive · News Library
          </span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>
            The news <span className="p-serif">in his story</span>
          </h1>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '42rem', margin: 0 }}>
            Press coverage of Rt. Hon. Alban Bagbin as it was reported — collected daily, archived by
            source and indexed for research.
          </p>

          <nav aria-label="Media collections" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.75rem' }}>
            {MEDIA_COLLECTION_NAV.map(l => {
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
      <section className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2rem, 4vw, 3.5rem) 0' }}>
        {/* Search & view controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ flex: '1 1 300px', position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--p-text-4)', pointerEvents: 'none' }} />
            <input
              value={q}
              onChange={e => {
                setQ(e.target.value)
                setPage(1)
              }}
              placeholder="Search headlines, sources, snippets…"
              aria-label="Search the news archive"
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
                onClick={() => {
                  setQ('')
                  setPage(1)
                }}
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

          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'var(--p-surface)',
              border: '1px solid var(--p-border-3)',
              color: 'var(--p-text-2)',
              borderRadius: 999,
              padding: '0.65rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: exporting ? 'wait' : 'pointer',
            }}
          >
            <Download size={14} /> {exporting ? 'Exporting…' : 'Export JSON'}
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
            <div>
              <label
                htmlFor="news-filter-order"
                style={{ display: 'block', ...mono, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--p-text-3)', marginBottom: '0.35rem' }}
              >
                Order by
              </label>
              <select
                id="news-filter-order"
                value={order}
                onChange={e => {
                  setOrder(e.target.value)
                  setPage(1)
                }}
                style={{ width: '100%', background: 'var(--p-surface-2)', border: '1px solid var(--p-border-3)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--p-text-1)', fontSize: '0.82rem', outline: 'none' }}
              >
                {ORDER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="news-filter-per-page"
                style={{ display: 'block', ...mono, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--p-text-3)', marginBottom: '0.35rem' }}
              >
                Clippings per page
              </label>
              <select
                id="news-filter-per-page"
                value={String(perPage)}
                onChange={e => {
                  setPerPage(parseInt(e.target.value, 10) || DEFAULT_PER_PAGE)
                  setPage(1)
                }}
                style={{ width: '100%', background: 'var(--p-surface-2)', border: '1px solid var(--p-border-3)', borderRadius: 8, padding: '0.5rem 0.75rem', color: 'var(--p-text-1)', fontSize: '0.82rem', outline: 'none' }}
              >
                {PER_PAGE_OPTIONS.map(n => (
                  <option key={n} value={String(n)}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
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
              {loading
                ? 'Searching the archive…'
                : `${(data?.total ?? 0).toLocaleString()} clipping${data?.total === 1 ? '' : 's'} found`}
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
                    if (e.key === 'order') setOrder('id:desc')
                    else if (e.key === 'perPage') setPerPage(DEFAULT_PER_PAGE)
                    else removeSingleFilter(e.key)
                    setPage(1)
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
              onClick={() => {
                clearAllFilters()
                setOrder('id:desc')
                setPerPage(DEFAULT_PER_PAGE)
              }}
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
        {loading && items.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div key={i} style={{ borderRadius: 14, border: '1px solid var(--p-border)', background: 'var(--p-surface)', overflow: 'hidden', height: 300, opacity: 0.7 }}>
                <div style={{ height: 52, background: 'var(--p-surface-2)' }} />
                <div style={{ padding: '0.85rem' }}>
                  <div style={{ width: '40%', height: 14, background: 'var(--p-surface-2)', borderRadius: 4, marginBottom: '0.6rem' }} />
                  <div style={{ width: '92%', height: 12, background: 'var(--p-surface-2)', borderRadius: 4, marginBottom: '0.4rem' }} />
                  <div style={{ width: '70%', height: 12, background: 'var(--p-surface-2)', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 1.5rem', border: '1px dashed var(--p-border)', borderRadius: 20 }}>
            <Search size={36} style={{ color: 'var(--p-text-4)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--p-text-1)', margin: '0 0 0.5rem' }}>No clippings match your search</h3>
            <p style={{ color: 'var(--p-text-3)', fontSize: '0.9rem', maxWidth: '28rem', margin: '0 auto 1.5rem' }}>
              We could not find any clippings matching the selected criteria. Try removing some filters or
              searching with different terms.
            </p>
            <button
              onClick={clearAllFilters}
              style={{ background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear all filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '1.25rem' }}>
            {leadItem && <LeadClipping item={leadItem} onOpen={openItem} />}
            {gridItems.map(item => (
              <ClippingCard key={item.id} item={item} onOpen={openItem} />
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
                    {group.items.length} clipping{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: '1rem' }}>
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
                      aria-label={`Open ${headline(item)}`}
                      className="p-card-lift"
                      style={{
                        border: '1px solid var(--p-border)',
                        background: 'var(--p-surface)',
                        borderRadius: 12,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div style={{ padding: '0.85rem 0.85rem 0' }}>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            ...mono,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
                            background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                            borderRadius: 999,
                            padding: '0.2rem 0.6rem',
                          }}
                        >
                          <Newspaper size={10} /> {sourceOf(item)}
                        </span>
                      </div>
                      <div style={{ padding: '0.75rem 0.85rem 0.85rem' }}>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: 'var(--p-text-1)',
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            marginBottom: '0.35rem',
                          }}
                        >
                          {headline(item)}
                        </div>
                        {dateOf(item) && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--p-text-3)', ...mono }}>{dateOf(item).slice(0, 10)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Numbered pagination */}
        {totalPages > 1 && (
          <nav aria-label="Pagination navigation" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '3rem', flexWrap: 'wrap' }}>
            {(() => {
              const start = Math.max(1, Math.min(page - 4, totalPages - 9))
              const nums = Array.from({ length: Math.min(10, totalPages) }, (_, i) => start + i)
              const pageBtn = (
                label: ReactNode,
                target: number,
                opts?: { active?: boolean; disabled?: boolean; key?: number | string },
              ) => (
                <button
                  key={opts?.key}
                  disabled={opts?.disabled}
                  onClick={() => changePage(target)}
                  style={{
                    minWidth: 38,
                    height: 38,
                    borderRadius: 999,
                    cursor: opts?.disabled ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    ...mono,
                    border: '1px solid var(--p-border-3)',
                    background: opts?.active ? 'var(--primary)' : 'var(--p-surface)',
                    color: opts?.active ? 'var(--primary-fg)' : opts?.disabled ? 'var(--p-text-4)' : 'var(--p-text-1)',
                    padding: '0 0.9rem',
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  }}
                >
                  {label}
                </button>
              )
              return (
                <>
                  {pageBtn(
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <ChevronLeft size={14} /> Prev
                    </span>,
                    page - 1,
                    { disabled: page <= 1, key: 'prev' },
                  )}
                  {nums.map(p => pageBtn(p, p, { active: p === page, key: p }))}
                  {pageBtn(
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      Next <ChevronRight size={14} />
                    </span>,
                    page + 1,
                    { disabled: page >= totalPages, key: 'next' },
                  )}
                </>
              )
            })()}
          </nav>
        )}
      </section>

      {activeItem && (
        <ClippingLightbox
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

export default function NewsArchive() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <span style={{ ...mono, fontSize: '0.85rem', color: 'var(--p-text-3)' }}>Loading News Record…</span>
        </div>
      }
    >
      <NewsLibraryContent />
    </Suspense>
  )
}
