'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { localToMediaUrl, isYouTubeUrl, getYouTubeEmbedUrl } from '@/lib/media'

interface AudioRow {
  id: number
  url: string | null
  localPath: string | null
  source: string | null
  title: string | null
  artist: string | null
  duration: number | null
  collectedAt: string | null
}

interface ListData {
  items: AudioRow[]
  total: number
  sources: string[]
}

export default function AudioListPage() {
  const [data, setData] = useState<ListData>({ items: [], total: 0, sources: [] })
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(1)
  const [playing, setPlaying] = useState<AudioRow | null>(null)

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), sort: 'id', dir: 'desc', perPage: '20' })
    if (query) params.set('q', query)
    if (source) params.set('source', source)
    fetch(`/api/audio?${params}`).then(r => r.json()).then(setData)
  }, [page, query, source])

  const totalPages = Math.ceil(data.total / 20)

  const getPlayUrl = (item: AudioRow) => {
    const local = localToMediaUrl(item.localPath)
    if (local) return { type: 'local', url: local }
    if (item.url && isYouTubeUrl(item.url)) return { type: 'youtube', url: getYouTubeEmbedUrl(item.url)! }
    if (item.url) return { type: 'remote', url: item.url }
    return null
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Audio ({data.total.toLocaleString()})</h1>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          placeholder="Search audio by title, URL, source, artist..."
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
              <th>Artist</th>
              <th>Duration</th>
              <th>Collected</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item: AudioRow) => {
              const player = getPlayUrl(item)
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
                  <td><Link href={`/audio/${item.id}`} style={{ fontWeight: 600 }}>{item.id}</Link></td>
                  <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title || '-'}
                  </td>
                  <td>{item.source || '-'}</td>
                  <td>{item.artist || '-'}</td>
                  <td>{item.duration || '-'}</td>
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
          <div style={{ maxWidth: '600px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'white', fontSize: '1rem', fontWeight: 600, margin: 0 }}>{playing.title || `Audio #${playing.id}`}</h3>
              <button onClick={() => setPlaying(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <div style={{ background: '#000', borderRadius: '0.375rem', padding: '2rem' }}>
              {(() => {
                const player = getPlayUrl(playing)
                if (!player) return <p style={{ color: 'white', textAlign: 'center' }}>No audio available</p>
                if (player.type === 'youtube') {
                  return (
                    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                      <iframe
                        src={player.url}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: '0.375rem' }}
                        allowFullScreen
                        allow="autoplay"
                      />
                    </div>
                  )
                }
                return (
                  <audio controls autoPlay style={{ width: '100%' }}>
                    <source src={player.url} />
                  </audio>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
