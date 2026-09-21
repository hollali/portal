'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { isYouTubeUrl, getYouTubeEmbedUrl, getYouTubeThumbUrl } from '@/lib/media'
import { jsonFetch } from '@/lib/jsonFetch'
import { Clapperboard, ExternalLink, Calendar, Clock3, Eye, Tag, ArrowLeft } from 'lucide-react'

interface VideoDetail {
  id: number
  error?: string
  url: string | null
  src: string | null
  localPath: string | null
  title: string | null
  source: string | null
  channel: string | null
  platform: string | null
  duration: number | null
  views: number | null
  category: string | null
  caption: string | null
  date: string | null
  year: number | null
  event: string | null
  location: string | null
  theme: string | null
  tags: string | null
  notes: string | null
}

function formatDuration(v: number | null): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null
  const h = Math.floor(v / 3600)
  const m = Math.floor((v % 3600) / 60)
  const s = Math.round(v % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<VideoDetail | null>(null)
  const [related, setRelated] = useState<VideoDetail[]>([])
  const [remoteError, setRemoteError] = useState(false)

  useEffect(() => {
    jsonFetch<VideoDetail>(`/api/videos/${id}`).then(item => {
      setItem(item)
      if (item && !item.error && item.category && item.id !== undefined) {
        jsonFetch<{ items: VideoDetail[] }>(`/api/videos?category=${encodeURIComponent(item.category)}&perPage=8`).then(data => {
          if (data) setRelated((data.items || []).filter(r => r.id !== item.id).slice(0, 6))
        }).catch(() => {})
      }
    })
  }, [id])

  if (!item) {
    return <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--p-text-3)' }}>Loading video…</div>
  }
  if (item.error) {
    return <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--p-text-3)' }}>Video not found.</div>
  }

  const mediaUrl = item.src && item.src.startsWith('/api/media') ? item.src : null
  const ytEmbed = item.url && isYouTubeUrl(item.url) ? getYouTubeEmbedUrl(item.url) : null
  const duration = formatDuration(item.duration)

  const player = mediaUrl && !remoteError ? (
    <video controls style={{ width: '100%', maxHeight: '520px', display: 'block', background: '#000' }} onError={() => setRemoteError(true)}>
      <source src={mediaUrl} />
    </video>
  ) : ytEmbed ? (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
      <iframe
        src={ytEmbed}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        title={item.title || `Video ${item.id}`}
      />
    </div>
  ) : item.url && !remoteError ? (
    <video controls style={{ width: '100%', maxHeight: '520px', display: 'block', background: '#000' }} onError={() => setRemoteError(true)}>
      <source src={item.url} />
    </video>
  ) : (
    <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--p-text-3)' }}>
      <Clapperboard size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.6 }} />
      No video available for playback yet.
    </div>
  )

  const tags = [item.tags, item.notes].filter(Boolean).flatMap(t => String(t).split(',')).map(t => t.trim()).filter(Boolean)

  const facts: { label: string; value: string | null }[] = [
    { label: 'Category', value: item.category },
    { label: 'Year', value: item.year ? String(item.year) : null },
    { label: 'Date', value: item.date },
    { label: 'Event', value: item.event },
    { label: 'Location', value: item.location },
    { label: 'Theme', value: item.theme },
    { label: 'Channel', value: item.channel },
    { label: 'Platform', value: item.platform },
    { label: 'Source', value: item.source },
    { label: 'Views', value: item.views ? item.views.toLocaleString() : null },
    { label: 'Duration', value: duration },
  ].filter(f => f.value)

  return (
    <div>
      <Link href="/videos" style={{ fontSize: '0.85rem', color: 'var(--p-text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to video archive
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', marginBottom: '1.25rem' }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
          <Clapperboard size={20} />
        </span>
        <div>
          {item.category && (
            <span style={{ display: 'inline-block', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 8%, transparent)', padding: '0.25rem 0.6rem', borderRadius: 999, marginBottom: '0.5rem' }}>
              {item.category}
            </span>
          )}
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.6rem, 3.4vw, 2.4rem)', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0, color: 'var(--p-text-1)' }}>
            {item.title || `Video #${item.id}`}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.6rem', fontSize: '0.82rem', color: 'var(--p-text-3)' }}>
            {item.year ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Calendar size={13} /> {item.year}</span> : null}
            {duration ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Clock3 size={13} /> {duration}</span> : null}
            {item.views ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Eye size={13} /> {item.views.toLocaleString()} views</span> : null}
            {item.channel ? <span>{item.channel}</span> : null}
          </div>
        </div>
      </div>

      <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--p-border)', background: '#000', marginBottom: '1.5rem' }}>
        {player}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {facts.map(f => (
          <div key={f.label} style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 14, padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'var(--font-mono), monospace', color: 'var(--p-text-4)', marginBottom: '0.3rem' }}>{f.label}</div>
            <div style={{ fontSize: '0.92rem', color: 'var(--p-text-1)', wordBreak: 'break-word' }}>{f.value}</div>
          </div>
        ))}
      </div>

      {item.caption ? (
        <div style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderLeft: '3px solid var(--primary)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'var(--font-mono), monospace', color: 'var(--p-text-4)', marginBottom: '0.4rem' }}>Caption</div>
          <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.65, color: 'var(--p-text-2)' }}>{item.caption}</p>
        </div>
      ) : null}

      {tags.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Tag size={15} style={{ color: 'var(--p-text-4)', marginTop: '0.1rem' }} />
          {tags.map(t => (
            <span key={t} style={{ fontSize: '0.75rem', background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', color: 'var(--p-text-3)', borderRadius: 999, padding: '0.3rem 0.75rem' }}>{t}</span>
          ))}
        </div>
      ) : null}

      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.88rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, marginBottom: '2rem' }}>
          <ExternalLink size={14} /> Open source URL
        </a>
      )}

      {related.length > 0 && (
        <div style={{ borderTop: '1px solid var(--p-border)', paddingTop: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: '1.25rem', letterSpacing: '-0.02em', margin: '0 0 1rem', color: 'var(--p-text-1)' }}>
            More in {item.category}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {related.map(r => {
              const thumb = r.url && isYouTubeUrl(r.url) ? getYouTubeThumbUrl(r.url) : null
              return (
                <Link key={r.id} href={`/videos/${r.id}`} style={{ textDecoration: 'none', border: '1px solid var(--p-border)', borderRadius: 14, overflow: 'hidden', background: 'var(--p-surface)', display: 'block' }}>
                  <div style={{ aspectRatio: '16/9', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {thumb ? (
                      <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : null}
                    <span style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', background: 'color-mix(in srgb, #000 55%, transparent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ display: 'block', width: 0, height: 0, borderLeft: '9px solid #fff', borderTop: '6px solid transparent', borderBottom: '6px solid transparent', marginLeft: '3px' }} />
                    </span>
                  </div>
                  <div style={{ padding: '0.75rem 0.9rem' }}>
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.4, color: 'var(--p-text-1)', fontWeight: 600 }}>{r.title || `Video #${r.id}`}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--p-text-4)', marginTop: '0.25rem' }}>{r.year || ''}{r.duration ? ` · ${formatDuration(r.duration)}` : ''}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}