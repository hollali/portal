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
import { isYouTubeUrl, getYouTubeEmbedUrl, getYouTubeThumbUrl } from '@/lib/media'
import { formatArchiveDate, MEDIA_COLLECTION_NAV } from '@/lib/library'
import {
  ArrowRight,
  AudioLines,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ExternalLink,
  LayoutGrid,
  MapPin,
  Play,
  RotateCcw,
  Search,
  Share2,
  SlidersHorizontal,
  Tag,
  X,
  ZoomIn,
} from 'lucide-react'

type Kind = 'videos' | 'audio'
type ViewMode = 'grid' | 'chronological'

interface ArchiveItem {
  id: number
  title: string | null
  src: string | null
  url: string | null
  source: string | null
  channel: string | null
  artist: string | null
  platform: string | null
  views: number | null
  duration: number | string | null
  category: string | null
  caption: string | null
  date: string | null
  year: number | null
  event: string | null
  location: string | null
  theme: string | null
  notes: string | null
  tags: string | null
}

interface FacetOption {
  value: string
  count: number
}

interface ListData {
  items: ArchiveItem[]
  total: number
  categories: FacetOption[]
  facets: Record<string, FacetOption[]>
  sources: string[]
}

const PER_PAGE = 48

const mono = { fontFamily: 'var(--font-mono), monospace' } as const
const detailLabel = {
  fontFamily: 'var(--font-mono), monospace',
  textTransform: 'uppercase',
  fontSize: '0.625rem',
  letterSpacing: '0.06em',
  color: 'var(--p-text-4)',
  fontWeight: 600,
} as const

type FilterMap = Record<string, string>
type DetailRow = { label: string; value: ReactNode }

const KIND_META: Record<
  Kind,
  {
    singular: string
    plural: string
    record: string
    detailTitle: string
    creditLabel: string
    searchPlaceholder: string
    emptyTitle: string
    emptyBody: string
  }
> = {
  videos: {
    singular: 'video',
    plural: 'videos',
    record: 'Video Record',
    detailTitle: 'About this recording',
    creditLabel: 'Channel',
    searchPlaceholder: 'Search titles, captions, events, channels, locations…',
    emptyTitle: 'No videos match your search',
    emptyBody:
      'We could not find any recordings matching the selected criteria. Try removing some filters or searching with different terms.',
  },
  audio: {
    singular: 'recording',
    plural: 'recordings',
    record: 'Audio Record',
    detailTitle: 'About this recording',
    creditLabel: 'Artist',
    searchPlaceholder: 'Search titles, captions, events, artists, locations…',
    emptyTitle: 'No recordings match your search',
    emptyBody:
      'We could not find any recordings matching the selected criteria. Try removing some filters or searching with different terms.',
  },
}

const QUICK_FACETS: { key: string; label: string }[] = [
  { key: 'category', label: 'Category' },
  { key: 'year', label: 'Year' },
]

const PANEL_FACETS: { key: string; label: string }[] = [
  { key: 'event', label: 'Event' },
  { key: 'location', label: 'Location' },
  { key: 'theme', label: 'Theme' },
  { key: 'source', label: 'Source' },
]

const ALL_FACETS: { key: string; label: string }[] = [...QUICK_FACETS, ...PANEL_FACETS]

function isPresent(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

function parseTags(tags: string | null): string[] {
  return String(tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function formatDuration(value: number | string | null): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    const total = Math.round(value)
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
  }
  return value.trim() || null
}

function itemTitle(item: ArchiveItem, singular: string): string {
  return item.title || item.event || `${singular === 'video' ? 'Video' : 'Recording'} #${item.id}`
}

function creditOf(item: ArchiveItem, kind: Kind): string | null {
  return kind === 'videos' ? item.channel || null : item.artist || null
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

function RecordDetails({ item, kind }: { item: ArchiveItem; kind: Kind }) {
  const meta = KIND_META[kind]
  const tags = parseTags(item.tags)

  const about: DetailRow[] = [
    { label: 'Catalogue ID', value: `#${item.id}` },
    { label: 'Year', value: item.year },
    { label: 'Date recorded', value: formatArchiveDate(item.date, item.year) || null },
    { label: 'Event', value: item.event },
    { label: 'Location', value: item.location },
    { label: 'Theme', value: item.theme },
    { label: 'Category', value: item.category },
  ]

  const provenance: DetailRow[] = [
    { label: 'Source', value: item.source },
    { label: meta.creditLabel, value: kind === 'videos' ? item.channel : item.artist },
    { label: 'Platform', value: item.platform },
    { label: 'Duration', value: formatDuration(item.duration) },
    {
      label: 'Views',
      value: isPresent(item.views) ? `${Number(item.views).toLocaleString()} views` : null,
    },
    {
      label: 'Original',
      value: item.url ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
          View on the web
        </a>
      ) : null,
    },
  ]

  const technical: DetailRow[] = [
    {
      label: 'Playable source',
      value: item.src ? (
        <a href={item.src} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
          Open media file
        </a>
      ) : null,
    },
    { label: 'Platform host', value: item.platform },
    { label: 'Media ID', value: `#${item.id}` },
  ]

  return (
    <div>
      <DetailGroup title={meta.detailTitle} rows={about} />
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

      {item.notes && item.notes !== item.caption && (
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

function MediaStage({ kind, src }: { kind: Kind; src: string | null }) {
  const embed = src ? getYouTubeEmbedUrl(src) : null
  const youtube = src ? isYouTubeUrl(src) : false

  if (!src) {
    return (
      <div
        style={{
          background: '#000',
          borderRadius: 12,
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--p-text-3)',
          fontSize: '0.9rem',
        }}
      >
        No playable source for this item yet.
      </div>
    )
  }

  if (youtube && embed) {
    return (
      <div
        style={{
          position: 'relative',
          paddingBottom: '56.25%',
          height: 0,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <iframe
          src={embed}
          title="Media player"
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
          allow="autoplay"
        />
      </div>
    )
  }

  if (kind === 'videos') {
    return (
      <video controls autoPlay style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: '70vh' }}>
        <source src={src} />
      </video>
    )
  }

  return (
    <div
      style={{
        background: 'linear-gradient(140deg, color-mix(in srgb, var(--primary) 30%, #000 40%), #000)',
        borderRadius: 12,
        padding: '2.5rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.25rem',
      }}
    >
      <AudioLines size={40} style={{ color: 'color-mix(in srgb, var(--primary) 70%, white)' }} />
      <audio controls autoPlay style={{ width: '100%' }}>
        <source src={src} />
      </audio>
    </div>
  )
}

function MediaThumb({ kind, item }: { kind: Kind; item: ArchiveItem }) {
  const youtubeThumb = kind === 'videos' && item.src && isYouTubeUrl(item.src) ? getYouTubeThumbUrl(item.src) : null

  return (
    <div style={{ position: 'relative', aspectRatio: '16/10', background: 'var(--p-img-bg)', overflow: 'hidden' }}>
      {youtubeThumb ? (
        <img
          src={youtubeThumb}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9, transition: 'transform 0.35s ease' }}
          className="media-card-img"
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(140deg, color-mix(in srgb, var(--primary) 26%, var(--p-img-bg)) 0%, var(--p-img-bg) 100%)',
          }}
        >
          {kind === 'videos' ? (
            <Clapperboard size={34} style={{ color: 'color-mix(in srgb, var(--primary) 70%, white)' }} />
          ) : (
            <AudioLines size={34} style={{ color: 'color-mix(in srgb, var(--primary) 70%, white)' }} />
          )}
        </div>
      )}

      {item.category && (
        <span
          style={{
            position: 'absolute',
            left: '0.6rem',
            top: '0.6rem',
            maxWidth: '55%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.6rem',
            ...mono,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--primary-fg)',
            background: 'var(--primary)',
            borderRadius: 999,
            padding: '0.18rem 0.6rem',
          }}
        >
          {item.category}
        </span>
      )}

      <span
        style={{
          position: 'absolute',
          right: '0.65rem',
          top: '0.65rem',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'rgba(15, 17, 23, 0.75)',
          backdropFilter: 'blur(4px)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.85,
        }}
      >
        <ZoomIn size={14} />
      </span>

      <span
        style={{
          position: 'absolute',
          left: '0.8rem',
          bottom: '0.8rem',
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.35)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >
        <Play size={14} fill="currentColor" style={{ marginLeft: 2 }} />
      </span>

      {formatDuration(item.duration) && (
        <span
          style={{
            position: 'absolute',
            right: '0.6rem',
            bottom: '0.6rem',
            fontSize: '0.62rem',
            ...mono,
            color: '#fff',
            background: 'rgba(0,0,0,0.6)',
            borderRadius: 999,
            padding: '0.12rem 0.5rem',
          }}
        >
          {formatDuration(item.duration)}
        </span>
      )}
    </div>
  )
}

function MediaCard({
  kind,
  item,
  onOpen,
}: {
  kind: Kind
  item: ArchiveItem
  onOpen: (id: number) => void
}) {
  const credit = creditOf(item, kind)

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
      aria-label={`Open ${itemTitle(item, KIND_META[kind].singular)}`}
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
      <MediaThumb kind={kind} item={item} />

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
            {item.year || 'Undated'}
          </span>
          {credit && (
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
              {credit}
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
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {itemTitle(item, KIND_META[kind].singular)}
        </h3>

        {item.caption && (
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: 'var(--p-text-3)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.caption}
          </p>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {item.location && (
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--p-text-3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <MapPin size={11} /> {item.location}
            </span>
          )}
          {item.theme && (
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--p-text-4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <Tag size={10} /> {item.theme}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function MediaLightbox({
  kind,
  item,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  kind: Kind
  item: ArchiveItem
  index: number
  total: number
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const meta = KIND_META[kind]
  const title = itemTitle(item, meta.singular)

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
    const url = `${window.location.origin}/${kind}?item=${item.id}`
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
      onClick={(e) => {
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
        {/* ── Left pane: dark playback stage ── */}
        <div
          style={{
            position: 'relative',
            background: '#090a0f',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: 'clamp(1rem, 3vw, 2.5rem)',
            borderRight: '1px solid var(--p-border)',
          }}
        >
          {index > 0 && onPrev && (
            <button
              onClick={onPrev}
              aria-label={`Previous ${meta.singular}`}
              style={{ ...navButtonStyle, left: '1.25rem' }}
              onMouseEnter={hoverIn}
              onMouseLeave={hoverOut}
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {index < total - 1 && onNext && (
            <button
              onClick={onNext}
              aria-label={`Next ${meta.singular}`}
              style={{ ...navButtonStyle, right: '1.25rem' }}
              onMouseEnter={hoverIn}
              onMouseLeave={hoverOut}
            >
              <ChevronRight size={22} />
            </button>
          )}

          <div style={{ width: '100%', maxWidth: 860, position: 'relative', zIndex: 1 }}>
            <MediaStage kind={kind} src={item.src} />
          </div>
        </div>

        {/* ── Right pane: archival context ── */}
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
              {meta.record}
            </span>
            <button
              onClick={onClose}
              data-autofocus
              aria-label={`Close ${meta.singular} viewer`}
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
              {item.source ? `Source: ${item.source}` : 'Source not recorded'}
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
              {item.category && (
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
                  {item.category}
                </span>
              )}
              {item.location && (
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
                  <MapPin size={12} /> {item.location}
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
              <Link
                href={`/${kind}/${item.id}`}
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
                <ArrowRight size={14} /> Full record
              </Link>

              <button
                onClick={handleCopyLink}
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
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Share2 size={14} />}
                {copied ? 'Link copied!' : 'Share link'}
              </button>

              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'transparent',
                    border: '1px solid var(--p-border-2)',
                    color: 'var(--p-text-2)',
                    borderRadius: 999,
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    textDecoration: 'none',
                  }}
                >
                  Source <ExternalLink size={13} />
                </a>
              )}
            </div>

            <RecordDetails item={item} kind={kind} />
          </div>
        </div>
      </div>
    </div>
  )
}

function MediaLibraryContent({ kind, eyebrow, heading, sub, categories, defaultCategory }: {
  kind: Kind
  eyebrow: string
  heading: ReactNode
  sub: string
  categories: readonly string[]
  defaultCategory?: string
}) {
  const searchParams = useSearchParams()
  const meta = KIND_META[kind]
  const api = kind === 'videos' ? '/api/videos' : '/api/audio'
  const route = `/${kind}`

  const [q, setQ] = useState(searchParams.get('q') || '')
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10) || 1)
  const [viewMode, setViewMode] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) === 'chronological' ? 'chronological' : 'grid',
  )
  const [activeItemId, setActiveItemId] = useState<number | null>(
    searchParams.get('item') ? parseInt(searchParams.get('item')!, 10) || null : null,
  )
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterMap>(() => {
    const map: FilterMap = {}
    for (const f of ALL_FACETS) {
      const v = searchParams.get(f.key) || (f.key === 'category' ? defaultCategory : null)
      if (v) map[f.key] = v
    }
    return map
  })

  const [data, setData] = useState<ListData | null>(null)
  const [loading, setLoading] = useState(true)
  const [standaloneItem, setStandaloneItem] = useState<ArchiveItem | null>(null)
  // A slow earlier request must never overwrite the results of a newer filter.
  const requestRef = useRef<AbortController | null>(null)

  const syncUrl = useCallback(
    (newQ: string, newFilters: FilterMap, newPage: number, newView: ViewMode, newItemId: number | null) => {
      if (typeof window === 'undefined') return
      const sp = new URLSearchParams()
      if (newQ.trim()) sp.set('q', newQ.trim())
      for (const [k, v] of Object.entries(newFilters)) if (v) sp.set(k, v)
      if (newPage > 1) sp.set('page', String(newPage))
      if (newView !== 'grid') sp.set('view', newView)
      if (newItemId !== null) sp.set('item', String(newItemId))
      const qs = sp.toString()
      window.history.replaceState(null, '', qs ? `${route}?${qs}` : route)
    },
    [route],
  )

  const load = useCallback(
    (f: FilterMap, query: string, p: number) => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      setLoading(true)
      const params = new URLSearchParams({ page: String(p), perPage: String(PER_PAGE) })
      for (const [k, v] of Object.entries(f)) if (v) params.set(k, v)
      if (query) params.set('q', query)
      jsonFetch<ListData>(`${api}?${params.toString()}`, { signal: controller.signal })
        .then(d => {
          if (!controller.signal.aborted && d) setData(d)
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    },
    [api],
  )

  useEffect(() => {
    const t = setTimeout(() => {
      load(filters, q, page)
      syncUrl(q, filters, page, viewMode, activeItemId)
    }, q ? 250 : 0)
    return () => {
      clearTimeout(t)
      requestRef.current?.abort()
    }
  }, [filters, q, page, viewMode, activeItemId, load, syncUrl])

  // Deep-link loader for an item that is not on the current page of results
  useEffect(() => {
    if (!activeItemId || !data?.items) return
    if (data.items.some((i) => i.id === activeItemId)) return
    jsonFetch<ArchiveItem>(`${api}/${activeItemId}`)
      .then(res => {
        if (res) setStandaloneItem(res)
      })
      .catch(() => {})
  }, [activeItemId, data, api])

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
    syncUrl(q, filters, page, viewMode, id)
  }

  const closeItem = () => {
    setActiveItemId(null)
    setStandaloneItem(null)
    syncUrl(q, filters, page, viewMode, null)
  }

  const items = useMemo(() => data?.items ?? [], [data])
  const activeIndex = useMemo(
    () => (activeItemId === null ? -1 : items.findIndex((i) => i.id === activeItemId)),
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
      const f = ALL_FACETS.find(x => x.key === k)
      list.push({ key: k, label: f?.label || k, value: v })
    }
    return list
  }, [q, filters])
  const activeFilterCount = activeFilterEntries.length

  const yearGroups = useMemo(() => {
    const map = new Map<string, ArchiveItem[]>()
    for (const item of items) {
      const key = item.year ? String(item.year) : 'Undated'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(item)
    }
    return Array.from(map.entries()).map(([year, groupItems]) => ({ year, items: groupItems }))
  }, [items])

  const totalPages = Math.ceil((data?.total ?? 0) / PER_PAGE)

  const categoryOptions = useMemo(() => {
    const fromApi = data?.categories ?? []
    if (fromApi.length) return fromApi
    return categories.map(c => ({ value: c, count: 0 }))
  }, [data, categories])

  const quickFacetOptions = (key: string) => {
    if (key === 'category') return categoryOptions
    return data?.facets?.[key] ?? []
  }

  const panelFacetOptions = (key: string) => {
    if (key === 'source') return (data?.sources ?? []).map(s => ({ value: s, count: 0 }))
    return data?.facets?.[key] ?? []
  }

  return (
    <div>
      {/* ── Hero & media cross-navigation ── */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)', margin: '-2rem -1.5rem 0' }}>
        
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <span style={{ ...mono, fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>
            {eyebrow}
          </span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0', color: 'var(--p-text-1)' }}>
            {heading}
          </h1>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '42rem', margin: 0 }}>{sub}</p>

          <nav aria-label="Media collections" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.75rem' }}>
            {MEDIA_COLLECTION_NAV.map(l => {
              const current = l.href === route
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
      <section
        className="p-section"
        data-motion-entry
        style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2rem, 4vw, 3.5rem) 0' }}
      >
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
              placeholder={meta.searchPlaceholder}
              aria-label={`Search ${meta.plural}`}
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
            const options = quickFacetOptions(f.key)
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
            {PANEL_FACETS.map(f => (
              <div key={f.key}>
                <label
                  htmlFor={`media-filter-${f.key}`}
                  style={{ display: 'block', ...mono, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--p-text-3)', marginBottom: '0.35rem' }}
                >
                  {f.label}
                </label>
                <select
                  id={`media-filter-${f.key}`}
                  value={filters[f.key] || ''}
                  onChange={e => setFilter(f.key, e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--p-surface-2)',
                    border: '1px solid var(--p-border-3)',
                    borderRadius: 8,
                    padding: '0.5rem 0.75rem',
                    color: 'var(--p-text-1)',
                    fontSize: '0.82rem',
                    outline: 'none',
                  }}
                >
                  <option value="">All {f.label.toLowerCase()}</option>
                  {panelFacetOptions(f.key).map(o => (
                    <option key={o.value} value={o.value}>
                      {o.value}
                      {o.count ? ` (${o.count})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
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
                ? `Searching ${meta.plural}…`
                : `${(data?.total ?? 0).toLocaleString()} ${data?.total === 1 ? meta.singular : meta.plural} found`}
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
                  onClick={() => removeSingleFilter(e.key)}
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
        {loading && items.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '1.25rem' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ borderRadius: 14, border: '1px solid var(--p-border)', background: 'var(--p-surface)', overflow: 'hidden', height: 300, opacity: 0.7 }}>
                <div style={{ aspectRatio: '16/10', background: 'var(--p-surface-2)' }} />
                <div style={{ padding: '0.85rem' }}>
                  <div style={{ width: '40%', height: 14, background: 'var(--p-surface-2)', borderRadius: 4, marginBottom: '0.6rem' }} />
                  <div style={{ width: '90%', height: 12, background: 'var(--p-surface-2)', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem 1.5rem', border: '1px dashed var(--p-border)', borderRadius: 20 }}>
            <Search size={36} style={{ color: 'var(--p-text-4)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--p-text-1)', margin: '0 0 0.5rem' }}>{meta.emptyTitle}</h3>
            <p style={{ color: 'var(--p-text-3)', fontSize: '0.9rem', maxWidth: '28rem', margin: '0 auto 1.5rem' }}>{meta.emptyBody}</p>
            <button
              onClick={clearAllFilters}
              style={{ background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', borderRadius: 999, padding: '0.6rem 1.4rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear all filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: '1.25rem' }}>
            {items.map(item => (
              <MediaCard key={item.id} kind={kind} item={item} onOpen={openItem} />
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
                    {group.items.length} {group.items.length === 1 ? meta.singular : meta.plural}
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
                      aria-label={`Open ${itemTitle(item, meta.singular)}`}
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
                      <MediaThumb kind={kind} item={item} />
                      <div style={{ padding: '0.75rem 0.85rem' }}>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            color: 'var(--p-text-1)',
                            lineHeight: 1.35,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            marginBottom: '0.35rem',
                          }}
                        >
                          {itemTitle(item, meta.singular)}
                        </div>
                        {item.event && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--p-text-3)', ...mono }}>{item.event}</div>
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
        <MediaLightbox
          kind={kind}
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

export interface MediaArchiveProps {
  kind: Kind
  eyebrow: string
  heading: ReactNode
  sub: string
  categories: readonly string[]
  defaultCategory?: string
}

export default function MediaArchive({ kind, eyebrow, heading, sub, categories, defaultCategory }: MediaArchiveProps) {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
          <span style={{ ...mono, fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            Loading {KIND_META[kind].record}…
          </span>
        </div>
      }
    >
      <MediaLibraryContent
        key={`${kind}:${defaultCategory || ''}`}
        kind={kind}
        eyebrow={eyebrow}
        heading={heading}
        sub={sub}
        categories={categories}
        defaultCategory={defaultCategory}
      />
    </Suspense>
  )
}
