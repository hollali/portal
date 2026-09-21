'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { jsonFetch } from '@/lib/jsonFetch'
import { ArrowLeft, Newspaper, ExternalLink, Calendar, ArrowRight, Globe, Tag } from 'lucide-react'

interface NewsDetail {
  id: number
  error?: string
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

function hostname(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<NewsDetail | null>(null)
  const [related, setRelated] = useState<NewsDetail[]>([])

  useEffect(() => {
    jsonFetch<NewsDetail>(`/api/news/${id}`).then(item => {
      setItem(item)
      if (item && !item.error && item.id !== undefined) {
        const src = item.sourceName || item.source
        const params = new URLSearchParams()
        if (src) params.set('source', src)
        params.set('perPage', '7')
        jsonFetch<{ items: NewsDetail[] }>(`/api/news?${params.toString()}`).then(data => {
          if (data) setRelated((data.items || []).filter(r => r.id !== item.id).slice(0, 6))
        }).catch(() => {})
      }
    })
  }, [id])

  if (!item) {
    return <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--p-text-3)' }}>Loading record…</div>
  }
  if (item.error) {
    return <div style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--p-text-3)' }}>Clipping not found.</div>
  }

  const host = hostname(item.url)
  const date = item.date || (item.collectedAt ? item.collectedAt.slice(0, 10) : '')
  const source = item.sourceName || item.source || host || 'News'

  const facts: { label: string; value: string | null }[] = [
    { label: 'Source', value: source },
    { label: 'Published', value: item.date },
    { label: 'Collected', value: item.collectedAt },
    { label: 'Origin host', value: host },
    { label: 'Search query', value: item.query },
    { label: 'Record ID', value: `#${item.id}` },
  ].filter(f => f.value)

  const tags = [item.tags, item.notes].filter(Boolean).flatMap(t => String(t).split(',')).map(t => t.trim()).filter(Boolean)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Link href="/news" style={{ fontSize: '0.85rem', color: 'var(--p-text-3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <ArrowLeft size={14} /> Back to news archive
        </Link>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '0.3rem 0.7rem', borderRadius: 999 }}>
          <Newspaper size={12} strokeWidth={2.25} /> News record
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.9rem', marginBottom: '1.25rem' }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
          <Newspaper size={20} />
        </span>
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            {date && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--p-text-3)' }}><Calendar size={13} /> {date}</span>}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.6rem, 3.6vw, 2.6rem)', letterSpacing: '-0.03em', lineHeight: 1.15, margin: 0, color: 'var(--p-text-1)', maxWidth: '44rem' }}>
            {item.title || `News #${item.id}`}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}><Globe size={13} /> {source}</span>
            <span style={{ color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace' }}>#{item.id}</span>
          </div>
        </div>
      </div>

      {item.url && (
        <div style={{ marginBottom: '2rem' }}>
          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem', padding: '0.7rem 1.4rem', borderRadius: 999 }}>
            Read the original article <ExternalLink size={15} />
          </a>
        </div>
      )}

      <div style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderLeft: '3px solid var(--primary)', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem', maxWidth: '48rem' }}>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'var(--font-mono), monospace', color: 'var(--p-text-4)', marginBottom: '0.5rem' }}>Clipping summary</div>
        <p style={{ margin: 0, fontSize: '1rem', lineHeight: 1.7, color: 'var(--p-text-2)' }}>
          {item.snippet || 'No summary captured for this clipping.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem', maxWidth: '48rem' }}>
        {facts.map(f => (
          <div key={f.label} style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 14, padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.09em', fontFamily: 'var(--font-mono), monospace', color: 'var(--p-text-4)', marginBottom: '0.3rem' }}>{f.label}</div>
            <div style={{ fontSize: '0.92rem', color: 'var(--p-text-1)', wordBreak: 'break-word' }}>{f.value}</div>
          </div>
        ))}
      </div>

      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--p-text-3)', textDecoration: 'none', wordBreak: 'break-all', marginBottom: '1.5rem', maxWidth: '48rem' }}>
          {item.url} <ExternalLink size={13} style={{ flexShrink: 0 }} />
        </a>
      )}

      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
          <Tag size={15} style={{ color: 'var(--p-text-4)', marginTop: '0.1rem' }} />
          {tags.map(t => (
            <span key={t} style={{ fontSize: '0.75rem', background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', color: 'var(--p-text-3)', borderRadius: 999, padding: '0.3rem 0.75rem' }}>{t}</span>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <div style={{ borderTop: '1px solid var(--p-border)', paddingTop: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: '1.25rem', letterSpacing: '-0.02em', margin: '0 0 1rem', color: 'var(--p-text-1)' }}>
            More from {source}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
            {related.map(r => (
              <Link key={r.id} href={`/news/${r.id}`} style={{ textDecoration: 'none', borderRadius: 14, background: 'var(--p-surface)', border: '1px solid var(--p-border)', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.45, color: 'var(--p-text-1)' }}>{r.title || `News #${r.id}`}</div>
                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--p-text-4)' }}>
                  <span>{r.date || (r.collectedAt ? r.collectedAt.slice(0, 10) : '')}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 600 }}>Read <ArrowRight size={13} /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}