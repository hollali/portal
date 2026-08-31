'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { localToMediaUrl } from '@/lib/media'

export default function ImageListPage() {
  const [data, setData] = useState<any>({ items: [], total: 0, page: 1, sources: [] })
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [lightboxImg, setLightboxImg] = useState<any>(null)
  const [errored, setErrored] = useState<Set<number>>(new Set())

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), sort: 'id', dir: 'desc', perPage: '24' })
    if (query) params.set('q', query)
    if (source) params.set('source', source)
    fetch(`/api/images?${params}`).then(r => r.json()).then(setData)
  }, [page, query, source])

  const totalPages = Math.ceil(data.total / 24)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Images ({data.total.toLocaleString()})</h1>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Search images by URL, source, query..."
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1) }}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--card)', color: 'var(--foreground)', flex: 1, minWidth: '200px' }}
          className="full-sm"
        />
        <select value={source} onChange={e => { setSource(e.target.value); setPage(1) }} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--card)', color: 'var(--foreground)' }}>
          <option value="">All sources</option>
          {data.sources.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        {data.items.map((img: any) => {
          const mediaUrl = localToMediaUrl(img.localPath)
          const src = (!errored.has(img.id) && mediaUrl) ? mediaUrl : img.url
          return (
            <div key={img.id} className="card" style={{ cursor: 'pointer', padding: '0.75rem' }} onClick={() => setLightboxImg(img)}>
              <div style={{ width: '100%', height: '160px', overflow: 'hidden', borderRadius: '0.25rem', marginBottom: '0.5rem', background: 'var(--background)' }}>
                {src ? (
                  <img
                    src={src}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => setErrored(prev => new Set(prev).add(img.id))}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.75rem' }}>
                    No preview
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{img.source || 'Unknown'}</span>
                <span>#{img.id}</span>
              </div>
              {img.faceMatch ? <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Face match</div> : null}
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="pagination" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          {page > 1 && <a onClick={() => setPage(p => p - 1)} style={{ cursor: 'pointer' }}>Prev</a>}
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const p = i + 1
            return p === page
              ? <span key={p} className="current">{p}</span>
              : <a key={p} onClick={() => setPage(p)} style={{ cursor: 'pointer' }}>{p}</a>
          })}
          {page < totalPages && <a onClick={() => setPage(p => p + 1)} style={{ cursor: 'pointer' }}>Next</a>}
        </div>
      )}

      {lightboxImg && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          onClick={() => setLightboxImg(null)}
        >
          <div style={{ maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImg(null)}
              style={{ position: 'absolute', top: '-2rem', right: 0, background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
            >
              &times;
            </button>
            <img
              src={localToMediaUrl(lightboxImg.localPath) || lightboxImg.url}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '0.375rem' }}
            />
            <div style={{ color: 'white', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span>#{lightboxImg.id} — {lightboxImg.source}</span>
              <a href={`/images/${lightboxImg.id}`} style={{ color: '#55beff' }}>Details &rarr;</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
