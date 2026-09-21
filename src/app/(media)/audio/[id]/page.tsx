'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getYouTubeEmbedUrl } from '@/lib/media'
import { jsonFetch } from '@/lib/jsonFetch'
import { AudioLines, ExternalLink, Calendar, Clock3, Tag, ArrowLeft } from 'lucide-react'

interface AudioDetail {
  id: number
  error?: string
  url: string | null
  src: string | null
  localPath: string | null
  title: string | null
  source: string | null
  artist: string | null
  duration: string | null
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

export default function AudioDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<AudioDetail | null>(null)
  const [related, setRelated] = useState<AudioDetail[]>([])
  const [remoteError, setRemoteError] = useState(false)

  useEffect(() => {
    jsonFetch<AudioDetail>(`/api/audio/${id}`).then(item => {
      setItem(item)
      if (item && !item.error && item.category && item.id !== undefined) {
        jsonFetch<{ items: AudioDetail[] }>(`/api/audio?category=${encodeURIComponent(item.category)}&perPage=8`).then(data => {
          if (data) setRelated((data.items || []).filter(r => r.id !== item.id).slice(0, 6))
        }).catch(() => {})
      }
    })
  }, [id])

  if (!item) {
    return <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--p-text-3)' }}>Loading audio…</div>
  }
  if (item.error) {
    return <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--p-text-3)' }}>Audio not found.</div>
  }

  const mediaUrl = item.src && item.src.startsWith('/api/media') ? item.src : null
  const ytEmbed = item.url && /youtu\.?be/i.test(item.url || '') ? getYouTubeEmbedUrl(item.url) : null

  const player = mediaUrl && !remoteError ? (
    <audio controls style={{ width: '100%' }} onError={() => setRemoteError(true)}>
      <source src={mediaUrl} />
    </audio>
  ) : ytEmbed ? (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
      <iframe
        src={ytEmbed}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        title={item.title || `Audio ${item.id}`}
      />
    </div>
  ) : item.url && !remoteError ? (
    <audio controls style={{ width: '100%' }} onError={() => setRemoteError(true)}>
      <source src={item.url} />
    </audio>
  ) : (
    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--p-text-3)' }}>
      <AudioLines size={32} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.6 }} />
      No audio available for playback yet.
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
    { label: 'Presenter / Artist', value: item.artist },
    { label: 'Source', value: item.source },
    { label: 'Duration', value: item.duration },
  ].filter(f => f.value)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
        <Link href="/audio" style={{ fontSize: '0.85rem', color: 'var(--p-text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={14} /> Back to audio archive
        </Link>
        {item.category && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '0.3rem 0.7rem', borderRadius: 999 }}>
            <AudioLines size={12} strokeWidth={2.25} /> {item.category}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', marginBottom: '1.25rem' }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
          <AudioLines size={20} />
        </span>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.6rem, 3.4vw, 2.4rem)', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0, color: 'var(--p-text-1)' }}>
            {item.title || `Audio #${item.id}`}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.6rem', fontSize: '0.82rem', color: 'var(--p-text-3)' }}>
            {item.year ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Calendar size={13} /> {item.year}</span> : null}
            {item.duration ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Clock3 size={13} /> {item.duration}</span> : null}
            {item.source ? <span>{item.source}</span> : null}
          </div>
        </div>
      </div>

      <div style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--p-border)', background: 'var(--p-surface)', marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: 'color-mix(in srgb, var(--primary) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <AudioLines size={20} />
          </span>
          <div style={{ flex: 1 }}>{player}</div>
        </div>
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
            {related.map(r => (
              <Link key={r.id} href={`/audio/${r.id}`} style={{ textDecoration: 'none', borderRadius: 14, overflow: 'hidden', background: 'var(--p-surface)', border: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.9rem' }}>
                <span style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                  <AudioLines size={16} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', lineHeight: 1.4, color: 'var(--p-text-1)', fontWeight: 600 }}>{r.title || `Audio #${r.id}`}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--p-text-4)', marginTop: '0.2rem' }}>{r.year || ''}{r.duration ? ` · ${r.duration}` : ''}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}