'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { localToMediaUrl, isYouTubeUrl, getYouTubeEmbedUrl } from '@/lib/media'

export default function VideoListPage() {
  const [data, setData] = useState<any>({ items: [], total: 0, page: 1, sources: [] })
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [playing, setPlaying] = useState<any>(null)

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), sort: 'id', dir: 'desc', perPage: '20' })
    if (query) params.set('q', query)
    if (source) params.set('source', source)
    fetch(`/api/videos?${params}`).then(r => r.json()).then(setData)
  }, [page, query, source])

  const totalPages = Math.ceil(data.total / 20)

  const getPlayUrl = (item: any) => {
    const local = localToMediaUrl(item.localPath)
    if (local) return { type: 'local', url: local }
    if (item.url && isYouTubeUrl(item.url)) return { type: 'youtube', url: getYouTubeEmbedUrl(item.url)! }
    if (item.url) return { type: 'remote', url: item.url }
    return null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Videos ({data.total.toLocaleString()})</h1>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Search videos by title, URL, source, channel..."
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

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Play</th>
              <th>ID</th>
              <th>Title</th>
              <th>Source</th>
              <th>Channel</th>
              <th>Duration</th>
              <th>Views</th>
              <th>Collected</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item: any) => {
              const player = getPlayUrl(item)
              const duration = item.duration
                ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}`
                : ''
              return (
                <tr key={item.id}>
                  <td>
                    {player ? (
                      <button
                        onClick={() => setPlaying(item)}
                        style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Play"
                      >
                        &#9654;
                      </button>
                    ) : null}
                  </td>
                  <td><Link href={`/videos/${item.id}`} style={{ fontWeight: 600 }}>{item.id}</Link></td>
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title || '-'}
                  </td>
                  <td>{item.source || '-'}</td>
                  <td>{item.channel || '-'}</td>
                  <td>{duration}</td>
                  <td>{item.views?.toLocaleString() || '-'}</td>
                  <td style={{ fontSize: '0.8rem' }}>{item.collectedAt?.slice(0, 10) || '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
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

      {playing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
          onClick={() => setPlaying(null)}
        >
          <div style={{ maxWidth: '800px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontWeight: 600, margin: 0 }}>{playing.title || `Video #${playing.id}`}</h3>
              <button onClick={() => setPlaying(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: '#000', borderRadius: '0.375rem' }}>
              {(() => {
                const player = getPlayUrl(playing)
                if (!player) return null
                if (player.type === 'youtube') {
                  return (
                    <iframe
                      src={player.url}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: '0.375rem' }}
                      allowFullScreen
                      allow="autoplay"
                    />
                  )
                }
                return (
                  <video controls autoPlay style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: '0.375rem' }}>
                    <source src={player.url} />
                  </video>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
