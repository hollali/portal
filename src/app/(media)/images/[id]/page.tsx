'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { jsonFetch } from '@/lib/jsonFetch'
import { ArrowLeft, Image as ImageIcon, Download, ExternalLink, Calendar, Globe, UserRound, Search, ArrowRight, FileText, Hash } from 'lucide-react'

interface ImageDetail {
  id: number
  error?: string
  url: string | null
  src: string | null
  localPath: string | null
  source: string | null
  query: string | null
  collectedAt: string | null
  faceDetected: number | null
  faceCount: number | null
  faceMatch: number | null
  faceMatchScore: number | null
}

interface RelatedRow {
  id: number
  url: string | null
  src: string | null
  source: string | null
  faceMatch: number | null
}

function hostname(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export default function ImageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<ImageDetail | null>(null)
  const [errored, setErrored] = useState(false)
  const [related, setRelated] = useState<RelatedRow[]>([])

  useEffect(() => {
    jsonFetch<ImageDetail>(`/api/images/${id}`).then(img => {
      setItem(img)
      if (img && !img.error && img.id !== undefined && img.source) {
        const params = new URLSearchParams({ source: img.source, perPage: '12', sort: 'id', dir: 'desc' })
        jsonFetch<{ items: RelatedRow[] }>(`/api/images?${params.toString()}`).then(data => {
          if (data) setRelated((data.items || []).filter(r => r.id !== img.id).slice(0, 8))
        }).catch(() => {})
      }
    })
  }, [id])

  if (!item) {
    return <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--p-text-3)' }}>Loading photo…</div>
  }
  if (item.error) {
    return <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--p-text-3)' }}>Photo not found.</div>
  }

  const src = (!errored && item.src) ? item.src : item.url
  const localUrl = item.src && item.src.startsWith('/api/media') ? item.src : null
  const host = hostname(item.url)
  const source = item.source || host || 'Unknown'
  const isFaceMatch = !!item.faceMatch
  const score = item.faceMatchScore ? `${(item.faceMatchScore * 100).toFixed(1)}%` : null

  const facts: { label: string; value: string | null }[] = [
    { label: 'Source', value: source },
    { label: 'Origin host', value: host },
    { label: 'Collected', value: item.collectedAt },
    { label: 'Search query', value: item.query },
    { label: 'Faces detected', value: item.faceCount !== null && item.faceCount > 0 ? String(item.faceCount) : (item.faceDetected ? String(item.faceDetected) : null) },
    { label: 'Face match score', value: score },
    { label: 'Record ID', value: `#${item.id}` },
  ].filter(f => f.value)

  return (
    <div>
      <Link href="/images" style={{ fontSize: '0.85rem', color: 'var(--p-text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.25rem' }}>
        <ArrowLeft size={16} /> Back to photo archive
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', marginBottom: '1.5rem' }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
          <ImageIcon size={20} />
        </span>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 8%, transparent)', padding: '0.25rem 0.6rem', borderRadius: 999 }}>
              <FileText size={11} /> Photo record
            </span>
            {item.collectedAt && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--p-text-3)' }}><Calendar size={13} /> {item.collectedAt}</span>}
            {isFaceMatch && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 50%, transparent)', background: 'color-mix(in srgb, var(--success) 10%, transparent)', padding: '0.2rem 0.65rem', borderRadius: 999, fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <UserRound size={11} /> Face match{score ? ` · ${score}` : ''}
              </span>
            )}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.6rem, 3.6vw, 2.6rem)', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0, color: 'var(--p-text-1)' }}>
            Photo #{item.id}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Globe size={13} /> {source}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Hash size={12} /> {item.id}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '1.5rem', alignItems: 'start', marginBottom: '1.5rem' }} className="stack-sm">
        <div style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 12, overflow: 'hidden' }}>
          {src ? (
            <img src={src} alt={`Photo #${item.id} from ${source}`} onError={() => setErrored(true)} style={{ width: '100%', maxHeight: '62vh', objectFit: 'contain', display: 'block', background: 'var(--p-surface-2)' }} />
          ) : (
            <div style={{ width: '100%', height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p-text-4)', background: 'var(--p-surface-2)' }}>
              <ImageIcon size={34} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {item.url && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {localUrl && (
                <a href={localUrl} download style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', padding: '0.7rem 1.4rem', borderRadius: 999 }}>
                  <Download size={15} /> Download photo
                </a>
              )}
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', background: 'var(--p-surface)', color: 'var(--p-text-1)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', padding: '0.7rem 1.4rem', borderRadius: 999, border: '1px solid var(--p-border-3)' }}>
                <ExternalLink size={15} /> Open source URL
              </a>
            </div>
          )}

          <div style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderLeft: '3px solid var(--primary)', borderRadius: 12, padding: '1.1rem 1.25rem' }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'var(--font-mono), monospace', color: 'var(--p-text-4)', marginBottom: '0.5rem' }}>Archive record</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              {facts.map(f => (
                <div key={f.label}>
                  <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono), monospace', color: 'var(--p-text-4)', marginBottom: '0.2rem' }}>{f.label}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--p-text-1)', wordBreak: 'break-word' }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', color: 'var(--p-text-3)', textDecoration: 'none', wordBreak: 'break-all' }}>
              <Search size={13} style={{ flexShrink: 0 }} /> {item.url} <ExternalLink size={12} style={{ flexShrink: 0 }} />
            </a>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <div style={{ borderTop: '1px solid var(--p-border)', paddingTop: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: '1.25rem', letterSpacing: '-0.02em', margin: '0 0 1rem', color: 'var(--p-text-1)' }}>
            More from {source}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 180px), 1fr))', gap: '1rem' }}>
            {related.map(r => (
              <Link key={r.id} href={`/images/${r.id}`} className="p-card-lift" style={{ textDecoration: 'none', borderRadius: 12, background: 'var(--p-surface)', border: '1px solid var(--p-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ aspectRatio: '4/3', background: 'var(--p-surface-3)', overflow: 'hidden' }}>
                  {r.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p-text-4)' }}><ImageIcon size={22} /></div>
                  )}
                </div>
                <div style={{ padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace' }}>#{r.id}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 600 }}>View <ArrowRight size={13} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}