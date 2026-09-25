import Link from 'next/link'
import { ArrowUpRight, FileText } from 'lucide-react'
import { KIND_ICON } from '@/lib/kindIcon'
import {
  KIND_CONFIG,
  archiveFacets,
  archiveRouteForKind,
  formatArchiveDate,
  isoDateAttr,
  type ArchiveKind,
} from '@/lib/library'
import type { LatestItem } from '@/lib/libraryQueries'

const clamp = (lines: number): React.CSSProperties => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
})

const META_TEXT: React.CSSProperties = {
  fontFamily: 'var(--font-mono), monospace',
  fontSize: '0.75rem',
  color: 'var(--p-text-3)',
}

function KindBadge({ item }: { item: LatestItem }) {
  const Icon = KIND_ICON[item.kind] ?? FileText
  const label = KIND_CONFIG[item.kind as ArchiveKind]?.label || item.kind
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      fontSize: '0.75rem', fontFamily: 'var(--font-mono), monospace',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      color: 'var(--primary)', whiteSpace: 'nowrap',
    }}>
      <Icon size={14} aria-hidden />
      {label}
    </span>
  )
}

function DocDate({ item }: { item: LatestItem }) {
  const label = formatArchiveDate(item.date, item.year)
  if (!label) return null
  return (
    <time
      dateTime={isoDateAttr(item.date)}
      style={{ ...META_TEXT, color: 'var(--p-text-3)', whiteSpace: 'nowrap' }}
    >
      {label}
    </time>
  )
}

function FacetLine({ item, limit }: { item: LatestItem; limit: number }) {
  const facets = archiveFacets(item, limit)
  if (facets.length === 0) return null
  return (
    <div style={{ ...META_TEXT, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem' }}>
      {facets.map((facet, i) => (
        <span key={facet} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
          {i > 0 && <span aria-hidden style={{ color: 'var(--p-text-4)' }}>·</span>}
          <span>{facet}</span>
        </span>
      ))}
    </div>
  )
}

function LeadCard({ item }: { item: LatestItem }) {
  const route = archiveRouteForKind(item.kind)
  return (
    <Link
      href={`/archives/${route}/${item.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <article
        className="p-card-lift"
        style={{
          display: 'grid', gap: '1.25rem 2rem', alignItems: 'start',
          gridTemplateColumns: 'minmax(0, 1fr)',
          border: '1px solid var(--p-border-2)',
          background: 'var(--p-surface-2)',
          borderRadius: 18, padding: 'clamp(1.5rem, 3vw, 2.1rem)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '0.9rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--primary-fg)', background: 'var(--primary)',
              padding: '0.2rem 0.6rem', borderRadius: 999,
            }}>
              Newest
            </span>
            <KindBadge item={item} />
          </div>

          <h3 style={{
            margin: 0, fontFamily: 'var(--font-display), sans-serif',
            fontSize: 'clamp(1.375rem, 2.6vw, 1.875rem)', fontWeight: 800,
            lineHeight: 1.2, letterSpacing: '-0.025em', color: 'var(--p-text-1)',
            ...clamp(3),
          }}>
            {item.title}
          </h3>

          {item.excerpt && (
            <p style={{
              ...META_TEXT, fontFamily: 'var(--font-inter), sans-serif',
              fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--p-text-2)',
              margin: '0.85rem 0 0', maxWidth: '62ch', ...clamp(3),
            }}>
              {item.excerpt}
            </p>
          )}

          <div style={{ marginTop: '1.1rem' }}>
            <FacetLine item={item} limit={3} />
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          borderTop: '1px solid var(--p-border-2)', paddingTop: '1rem',
        }}>
          <DocDate item={item} />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            fontSize: '0.875rem', fontWeight: 600, color: 'var(--p-text-1)',
          }}>
            Read in the archive
            <ArrowUpRight size={16} aria-hidden style={{ color: 'var(--primary)' }} />
          </span>
        </div>
      </article>
    </Link>
  )
}

function GridCard({ item }: { item: LatestItem }) {
  const route = archiveRouteForKind(item.kind)
  return (
    <Link
      href={`/archives/${route}/${item.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <article
        className="p-card-lift"
        style={{
          display: 'flex', flexDirection: 'column', height: '100%',
          border: '1px solid var(--p-border)', background: 'var(--p-surface)',
          borderRadius: 14, padding: '1.4rem',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '0.75rem', marginBottom: '0.75rem',
        }}>
          <KindBadge item={item} />
          <DocDate item={item} />
        </div>

        <h3 style={{
          margin: 0, fontWeight: 700, fontSize: '1.0625rem',
          fontFamily: 'var(--font-display), sans-serif', lineHeight: 1.35,
          color: 'var(--p-text-1)', ...clamp(2),
        }}>
          {item.title}
        </h3>

        {item.excerpt && (
          <p style={{
            ...META_TEXT, fontFamily: 'var(--font-inter), sans-serif',
            fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--p-text-3)',
            margin: '0.6rem 0 0', ...clamp(2),
          }}>
            {item.excerpt}
          </p>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '0.9rem' }}>
          <FacetLine item={item} limit={2} />
        </div>
      </article>
    </Link>
  )
}

function EmptyState() {
  return (
    <div style={{
      border: '1px dashed var(--p-border-2)', borderRadius: 14,
      padding: 'clamp(1.75rem, 4vw, 2.75rem)', textAlign: 'center',
    }}>
      <p style={{ margin: 0, color: 'var(--p-text-2)', fontSize: '1rem' }}>
        New archive items will appear here as they are digitised.
      </p>
      <Link
        href="/archives"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '1rem',
          color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '0.875rem',
          fontWeight: 600, borderBottom: '1px solid var(--primary)', paddingBottom: '0.25rem',
        }}
      >
        Browse what is already online
        <ArrowUpRight size={15} aria-hidden style={{ color: 'var(--primary)' }} />
      </Link>
    </div>
  )
}

export default function LatestToArchive({ items }: { items: LatestItem[] }) {
  const [lead, ...rest] = items

  return (
    <section
      className="p-section"
      data-motion-entry
      style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3.5rem, 7vw, 5.5rem) 1.5rem' }}
    >
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end',
        justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem',
      }}>
        <div>
          <span style={{
            fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem',
            letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)',
          }}>
            Recently added
          </span>
          <h2 style={{
            fontFamily: 'var(--font-display), sans-serif',
            fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em',
            margin: '0.75rem 0 0', color: 'var(--p-text-1)',
          }}>
            Latest to <span className="p-serif">the archive</span>
          </h2>
        </div>
        <Link
          href="/archives"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '0.875rem',
            fontWeight: 600, borderBottom: '1px solid var(--primary)',
            padding: '0.5rem 0.25rem', minHeight: 44, marginBottom: '-0.5rem',
          }}
        >
          View everything
          <ArrowUpRight size={15} aria-hidden style={{ color: 'var(--primary)' }} />
        </Link>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <LeadCard item={lead!} />

          {rest.length > 0 && (
            <div style={{
              display: 'grid', gap: '1rem', marginTop: '1rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
            }}>
              {rest.map(item => (
                <GridCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
