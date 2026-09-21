'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { jsonFetch } from '@/lib/jsonFetch'
import { Newspaper, ArrowRight, ChevronLeft, ChevronRight, Download, Calendar, ExternalLink, FileOutput } from 'lucide-react'

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
}

interface NewsResponse {
  items: NewsItem[]
  total: number
  page: number
  perPage: number
  sources: string[]
}

const PER_PAGE = 18

const FALLBACK_SKELETON = Array.from({ length: 6 }, (_, i) => i)

function isYouTubeDomain(url: string | null): boolean {
  if (!url) return false
  try {
    return /youtu(\.be|be\.com)/i.test(new URL(url).hostname)
  } catch {
    return false
  }
}

export default function NewsArchive() {
  const [data, setData] = useState<NewsResponse>({ items: [], total: 0, page: 1, perPage: PER_PAGE, sources: [] })
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exportFormat, setExportFormat] = useState('')

  useEffect(() => {
    let ignore = false
    const params = new URLSearchParams({ page: String(page), perPage: String(PER_PAGE) })
    if (query) params.set('q', query)
    if (source) params.set('source', source)
    jsonFetch<NewsResponse>(`/api/news?${params}`).then(d => {
      if (!ignore && d) setData(d)
      if (!ignore) setLoading(false)
    })
    return () => { ignore = true }
  }, [page, query, source])

  useEffect(() => {
    if (!exportFormat) return
    let ignore = false
    const params = new URLSearchParams({ page: '1', perPage: '100' })
    if (query) params.set('q', query)
    if (source) params.set('source', source)
    jsonFetch<{ items?: NewsItem[] }>(`/api/news?${params}`).then(d => {
      if (ignore) return
      const blob = new Blob([JSON.stringify(d?.items ?? [], null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `news_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportFormat('')
    })
    return () => { ignore = true }
  }, [exportFormat, query, source])

  const changePage = useCallback((p: number) => {
    setPage(Math.max(1, p))
    setLoading(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const totalPages = Math.ceil(data.total / PER_PAGE)
  const items = data.items
  const featured = !query && !source && page === 1 ? items[0] : null
  const grid = featured ? items.slice(1) : items

  const meta = (item: NewsItem) => {
    const date = item.date || (item.collectedAt ? item.collectedAt.slice(0, 10) : '')
    const host = isYouTubeDomain(item.url) ? 'YouTube' : (item.url ? new URL(item.url).hostname.replace(/^www\./, '') : '')
    const src = item.sourceName || item.source || host
    return { date, src }
  }

  const pagination = totalPages > 1 && (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '2.25rem', flexWrap: 'wrap' }}>
      {(() => {
        const start = Math.max(1, Math.min(page - 4, totalPages - 9))
        const nums = Array.from({ length: Math.min(10, totalPages) }, (_, i) => start + i)
        const btn = (label: React.ReactNode, target: number, opts?: { active?: boolean; disabled?: boolean; key?: number | string }) => (
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
          >
            {label}
          </button>
        )
        return (
          <>
            {btn(<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><ChevronLeft size={14} /> Prev</span>, page - 1, { disabled: page <= 1, key: 'prev' })}
            {nums.map(p => btn(p, p, { active: p === page, key: p }))}
            {btn(<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>Next <ChevronRight size={14} /></span>, page + 1, { disabled: page >= totalPages, key: 'next' })}
          </>
        )
      })()}
    </div>
  )

  const skeletonCard = (key: number, w: number) => (
    <div key={key} style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 16, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ height: 14, width: '38%', borderRadius: 6, background: 'var(--p-surface-3)', opacity: 0.7 }} />
      <div style={{ height: w, borderRadius: 6, background: 'var(--p-surface-3)', opacity: 0.7 }} />
      <div style={{ height: w, width: '82%', borderRadius: 6, background: 'var(--p-surface-3)', opacity: 0.7 }} />
    </div>
  )

  return (
    <div>
      <div className="news-hero" style={{ position: 'relative', borderBottom: '1px solid var(--p-border)', margin: '0 -1.5rem', padding: 'clamp(2.25rem, 5vw, 3.5rem) 1.5rem' }}>
        <div style={{ position: 'relative', maxWidth: 900 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '0.375rem 0.75rem', borderRadius: 999 }}>
            <Newspaper size={12} /> News Archive · Clippings
          </span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.9rem 0 0.6rem', color: 'var(--p-text-1)' }}>
            The news in his story
          </h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', margin: 0, maxWidth: '40rem' }}>
            Press coverage of Rt. Hon. Alban Bagbin as it was reported — collected daily and archived by source, ready to read or export.
          </p>
        </div>
      </div>

      <div className="news-toolbar" style={{ display: 'flex', gap: '0.75rem', margin: '1.5rem 0', flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); setLoading(true) }}
          placeholder="Search headlines, sources, snippets…"
          style={{ flex: 1, minWidth: 220, background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.65rem 1.1rem', color: 'var(--p-text-1)', fontSize: '0.9rem', outline: 'none' }}
        />
        <select
          value={source}
          onChange={e => { setSource(e.target.value); setPage(1); setLoading(true) }}
          style={{ background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.65rem 1rem', color: 'var(--p-text-1)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
        >
          <option value="">All sources</option>
          {data.sources.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => setExportFormat('json')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--p-surface)', border: '1px solid var(--p-border-3)', borderRadius: 999, padding: '0.65rem 1rem', color: 'var(--p-text-2)', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          <Download size={14} /> Export JSON
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem', fontSize: '0.8rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace' }}>
        <span>{data.total.toLocaleString()} clippings</span>
        {query && <span>· matching “{query}”</span>}
        {source && <span>· {source}</span>}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1rem' }}>
          {FALLBACK_SKELETON.map(i => skeletonCard(i, i % 2 ? 14 : 20))}
        </div>
      ) : (
        <>
          {featured && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '1.25rem', marginBottom: '1.25rem', alignItems: 'stretch' }} className="stack-sm">
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--p-border)', background: 'linear-gradient(120deg, color-mix(in srgb, var(--primary) 16%, transparent), color-mix(in srgb, var(--primary) 4%, transparent))', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                {(() => { const { date, src } = meta(featured); return (
                  <>
                    <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.625rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 8%, transparent)', padding: '0.3rem 0.65rem', borderRadius: 999, marginBottom: '0.75rem' }}>
                      <Newspaper size={11} /> Latest · {src || 'News'}
                    </span>
                    <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', letterSpacing: '-0.025em', lineHeight: 1.2, margin: 0, color: 'var(--p-text-1)' }}>
                      {featured.title || `News #${featured.id}`}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--p-text-3)' }}>
                      {date && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Calendar size={13} /> {date}</span>}
                    </div>
                  </>
                ) })()}
              </div>
              <div style={{ borderRadius: 16, border: '1px solid var(--p-border)', background: 'var(--p-surface)', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.65, color: 'var(--p-text-2)' }}>
                  {featured.snippet || `Clipping #${featured.id} in the news archive.`}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {featured.url && (
                    <a href={featured.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem', padding: '0.6rem 1.1rem', borderRadius: 999 }}>
                      Read the article <ExternalLink size={14} />
                    </a>
                  )}
                  <Link href={`/news/${featured.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--p-text-1)', border: '1px solid var(--p-border-3)', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem', padding: '0.6rem 1.1rem', borderRadius: 999 }}>
                    Archive record <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {grid.length === 0 && !loading ? (
            <div style={{ padding: '4rem 1rem', textAlign: 'center', border: '1px dashed var(--p-border)', borderRadius: 16, color: 'var(--p-text-3)', fontSize: '0.95rem' }}>
              No clippings match your search.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1rem' }}>
              {grid.map(item => {
                const { date, src } = meta(item)
                return (
                  <article key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'var(--p-surface)', border: '1px solid var(--p-border)', borderRadius: 16, padding: '1.25rem', transition: 'border-color 0.25s, transform 0.25s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 45%, transparent)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--p-border)'; e.currentTarget.style.transform = 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.625rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)' }}>{src || 'News'}</span>
                      {date && <span style={{ fontSize: '0.72rem', color: 'var(--p-text-4)', whiteSpace: 'nowrap' }}>{date}</span>}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.02rem', lineHeight: 1.4, letterSpacing: '-0.012em', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)' }}>
                      <Link href={`/news/${item.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title || `News #${item.id}`}</Link>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--p-text-3)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {item.snippet || `Clipping #${item.id}.`}
                    </p>
                    <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingTop: '0.25rem' }}>
                      <Link href={`/news/${item.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--p-text-3)', textDecoration: 'none', fontWeight: 600 }}>
                        Record <ArrowRight size={13} />
                      </Link>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Open original article" title="Open original article" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 999, color: 'var(--p-text-4)', border: '1px solid var(--p-border)', textDecoration: 'none', transition: 'color 0.2s, border-color 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--p-text-4)'; e.currentTarget.style.borderColor = 'var(--p-border)' }}
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          {pagination}
        </>
      )}
    </div>
  )
}