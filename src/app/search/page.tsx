'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query) { setResults(null); return }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(query)}&page=${page}`)
      .then(r => r.json())
      .then(d => { setResults(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [query, page])

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Search</h1>

      <input
        placeholder="Search across all content types..."
        value={query}
        onChange={e => { setQuery(e.target.value); setPage(1) }}
        style={{ padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--card)', color: 'var(--foreground)', width: '100%', fontSize: '1rem', marginBottom: '1.5rem' }}
      />

      {loading && <div>Searching...</div>}

      {results && !loading && (
        <>
          <div style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
            Found {results.total} result{results.total !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </div>

          {results.images.total > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                <Link href={`/images?q=${encodeURIComponent(query)}`}>Images ({results.images.total})</Link>
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {results.images.items.map((img: any) => (
                  <Link key={img.id} href={`/images/${img.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {img.url?.split('/').pop() || `#${img.id}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{img.source}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {results.videos.total > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                <Link href={`/videos?q=${encodeURIComponent(query)}`}>Videos ({results.videos.total})</Link>
              </h2>
              {results.videos.items.map((v: any) => (
                <Link key={v.id} href={`/videos/${v.id}`} style={{ textDecoration: 'none', display: 'block', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 500 }}>{v.title || `#${v.id}`}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{v.source} &middot; {v.channel}</div>
                </Link>
              ))}
            </div>
          )}

          {results.news.total > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                <Link href={`/news?q=${encodeURIComponent(query)}`}>News ({results.news.total})</Link>
              </h2>
              {results.news.items.map((n: any) => (
                <Link key={n.id} href={`/news/${n.id}`} style={{ textDecoration: 'none', display: 'block', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 500 }}>{n.title || `#${n.id}`}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{n.sourceName} &middot; {n.date}</div>
                </Link>
              ))}
            </div>
          )}

          {results.audio.total > 0 && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                <Link href={`/audio?q=${encodeURIComponent(query)}`}>Audio ({results.audio.total})</Link>
              </h2>
              {results.audio.items.map((a: any) => (
                <Link key={a.id} href={`/audio/${a.id}`} style={{ textDecoration: 'none', display: 'block', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 500 }}>{a.title || `#${a.id}`}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{a.source} &middot; {a.artist}</div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
