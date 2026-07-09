'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AdminData {
  images: { items: any[]; total: number }
  videos: { items: any[]; total: number }
  news: { items: any[]; total: number }
  audio: { items: any[]; total: number }
  isAdmin: boolean
}

function getMediaUrl(item: { localPath?: string | null; url?: string | null }): string | null {
  if (item.localPath) {
    const rel = item.localPath.replace('/home/hollali/Projects/WebScrapper/osint_bagbin_enhanced', '')
    return `/api/media${rel}`
  }
  return item.url || null
}

function isYouTubeUrl(url: string): boolean {
  return /(youtube\.com|youtu\.be)/i.test(url)
}

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState<AdminData | null>(null)
  const [tab, setTab] = useState<'images' | 'videos' | 'news' | 'audio'>('images')
  const [pages, setPages] = useState<Record<string, number>>({ images: 1, videos: 1, news: 1, audio: 1 })
  const [showAdd, setShowAdd] = useState(false)
  const [message, setMessage] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (!d.isAdmin) { router.push('/login'); return }
      setIsAdmin(true)
    })
  }, [router])

  useEffect(() => {
    if (!isAdmin) return
    fetch(`/api/admin/${tab}?page=${pages[tab]}`).then(r => r.json()).then(d => {
      setData(prev => prev ? { ...prev, [tab]: d } : {
        images: { items: [], total: 0 }, videos: { items: [], total: 0 },
        news: { items: [], total: 0 }, audio: { items: [], total: 0 }, isAdmin: true, [tab]: d
      })
    })
  }, [tab, pages, isAdmin])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this item?')) return
    const formData = new FormData()
    formData.set('action', 'delete_image')
    formData.set('pks', String(id))
    formData.set('type', tab)
    const res = await fetch(`/api/admin/${tab}`, { method: 'POST', body: formData })
    if (res.ok) {
      setMessage('Item deleted')
      setPages(p => ({ ...p, [tab]: p[tab] }))
    } else {
      setMessage('Failed to delete')
    }
  }

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('action', 'add')
    formData.set('type', tab)
    const res = await fetch(`/api/admin/${tab}`, { method: 'POST', body: formData })
    if (res.ok) {
      setMessage('Item added')
      setShowAdd(false)
      setPages(p => ({ ...p, [tab]: p[tab] }))
    } else {
      setMessage('Failed to add')
    }
  }

  const refreshPage = (p: number) => setPages(prev => ({ ...prev, [tab]: p }))

  if (!isAdmin) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading...</div>

  const currentData = data?.[tab]
  const tabs = ['images', 'videos', 'news', 'audio'] as const
  const totalPages = currentData ? Math.ceil(currentData.total / 10) : 1

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Admin Panel</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
        Manage all collected media — view, preview, add, and delete records.
      </p>

      {message && (
        <div style={{
          padding: '0.75rem 1rem', background: 'var(--success)', color: 'white',
          borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{message}</span>
          <button onClick={() => setMessage('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexWrap: 'wrap'
      }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', whiteSpace: 'nowrap',
            background: tab === t ? 'var(--primary)' : 'var(--card)', color: tab === t ? 'white' : 'var(--foreground)',
            fontWeight: 600, fontSize: '0.875rem',
            border: tab === t ? 'none' : '1px solid var(--border)',
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)} ({currentData?.total || 0})
          </button>
        ))}
        <button onClick={() => setShowAdd(!showAdd)} style={{
          padding: '0.5rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border)',
          cursor: 'pointer', background: 'var(--card)', fontWeight: 600, fontSize: '0.875rem',
          color: 'var(--foreground)', whiteSpace: 'nowrap',
        }}>
          {showAdd ? 'Cancel' : '+ Add New'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Add New {tab.slice(0, -1)}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            {['source', 'query', 'url', ...(tab === 'videos' ? ['platform', 'title', 'channel', 'duration', 'views'] : []),
              ...(tab === 'news' ? ['title', 'sourceName', 'date', 'snippet'] : []),
              ...(tab === 'audio' ? ['title', 'artist', 'duration'] : []),
              ...(tab === 'images' ? [] : []),
            ].filter((v, i, a) => a.indexOf(v) === i).map(f => (
              <div key={f}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {f.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                </label>
                <input name={f} style={{
                  width: '100%', padding: '0.375rem 0.5rem', border: '1px solid var(--border)',
                  borderRadius: '0.375rem', background: 'var(--background)', color: 'var(--foreground)', fontSize: '0.875rem'
                }} />
              </div>
            ))}
          </div>
          <button type="submit" style={{
            padding: '0.5rem 1.5rem', background: 'var(--primary)', color: 'white',
            border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem'
          }}>
            Add Item
          </button>
        </form>
      )}

      {currentData && currentData.items.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted-foreground)' }}>
          No {tab} found.
        </div>
      )}

      {currentData && currentData.items.length > 0 && (
        <>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: tab === 'images' ? '700px' : '900px' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>ID</th>
                  <th style={{ width: '80px' }}>Preview</th>
                  <th>Details</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentData.items.map((item: any) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, verticalAlign: 'top' }}>{item.id}</td>

                    {/* Preview column */}
                    <td style={{ verticalAlign: 'top', paddingTop: '0.5rem' }}>
                      {tab === 'images' && (
                        <div style={{
                          width: '64px', height: '64px', borderRadius: '0.375rem', overflow: 'hidden',
                          background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <img
                            src={getMediaUrl(item) || ''}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        </div>
                      )}
                      {tab === 'videos' && (
                        <a href={getMediaUrl(item) || '#'} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '64px', height: '48px', borderRadius: '0.375rem',
                            background: 'var(--muted)', textDecoration: 'none', fontSize: '1.5rem'
                          }} title="Play video">
                          ▶
                        </a>
                      )}
                      {tab === 'audio' && (
                        <a href={getMediaUrl(item) || '#'} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '64px', height: '48px', borderRadius: '0.375rem',
                            background: 'var(--muted)', textDecoration: 'none', fontSize: '1.5rem'
                          }} title="Play audio">
                          ♫
                        </a>
                      )}
                      {tab === 'news' && (
                        <a href={getMediaUrl(item) || '#'} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '64px', height: '48px', borderRadius: '0.375rem',
                            background: 'var(--muted)', textDecoration: 'none', fontSize: '1rem', color: 'var(--foreground)'
                          }} title="Open article">
                          📄
                        </a>
                      )}
                    </td>

                    {/* Details column */}
                    <td style={{ verticalAlign: 'top', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                      {tab === 'images' && (
                        <>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Source: {item.source || '-'}</div>
                          <div style={{ color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.url ? (
                              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                                {item.url.slice(0, 60)}...
                              </a>
                            ) : '-'}
                          </div>
                          {item.query && <div style={{ color: 'var(--muted-foreground)', marginTop: '0.125rem' }}>Query: {item.query}</div>}
                        </>
                      )}
                      {tab === 'videos' && (
                        <>
                          <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>
                            {item.title ? (
                              <a href={`/videos/${item.id}`} style={{ color: 'var(--foreground)', textDecoration: 'none' }}>
                                {item.title.slice(0, 80)}
                              </a>
                            ) : 'Untitled'}
                          </div>
                          <div style={{ color: 'var(--muted-foreground)' }}>
                            {item.channel && <span>Channel: {item.channel}</span>}
                            {item.views !== null && item.views !== undefined && <span> · {item.views.toLocaleString()} views</span>}
                            {item.duration ? <span> · {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}m</span> : ''}
                          </div>
                          <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
                            Platform: {item.platform || '-'} · Source: {item.source || '-'}
                          </div>
                        </>
                      )}
                      {tab === 'news' && (
                        <>
                          <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>
                            {item.title ? (
                              <a href={`/news/${item.id}`} style={{ color: 'var(--foreground)', textDecoration: 'none' }}>
                                {item.title.slice(0, 80)}
                              </a>
                            ) : 'Untitled'}
                          </div>
                          {item.sourceName && <div style={{ color: 'var(--muted-foreground)' }}>Source: {item.sourceName}</div>}
                          {item.date && <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>{item.date}</div>}
                          {item.snippet && (
                            <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', maxHeight: '2.5em' }}>
                              {item.snippet.slice(0, 120)}...
                            </div>
                          )}
                        </>
                      )}
                      {tab === 'audio' && (
                        <>
                          <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>
                            {item.title ? (
                              <a href={`/audio/${item.id}`} style={{ color: 'var(--foreground)', textDecoration: 'none' }}>
                                {item.title.slice(0, 80)}
                              </a>
                            ) : 'Untitled'}
                          </div>
                          {item.artist && <div style={{ color: 'var(--muted-foreground)' }}>Artist: {item.artist}</div>}
                          {item.duration && <div style={{ color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>Duration: {item.duration}s</div>}
                        </>
                      )}
                    </td>

                    {/* Actions column */}
                    <td style={{ verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                        <Link href={`/${tab}/${item.id}`} style={{
                          display: 'inline-block', padding: '0.25rem 0.625rem',
                          background: 'var(--card)', border: '1px solid var(--border)',
                          borderRadius: '0.25rem', color: 'var(--foreground)',
                          textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600,
                        }}>
                          View
                        </Link>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
                            display: 'inline-block', padding: '0.25rem 0.625rem',
                            background: 'var(--card)', border: '1px solid var(--border)',
                            borderRadius: '0.25rem', color: 'var(--primary)',
                            textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600,
                          }}>
                            Source
                          </a>
                        )}
                        <button onClick={() => handleDelete(item.id)} style={{
                          background: 'var(--danger)', color: 'white', border: 'none',
                          borderRadius: '0.25rem', padding: '0.25rem 0.625rem',
                          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                        }}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              gap: '0.375rem', marginTop: '1rem', flexWrap: 'wrap'
            }}>
              <button onClick={() => refreshPage(Math.max(1, pages[tab] - 1))}
                disabled={pages[tab] <= 1}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: '0.8125rem' }}>
                ← Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                const start = Math.max(1, Math.min(pages[tab] - 4, totalPages - 9))
                const pageNum = start + i
                if (pageNum > totalPages) return null
                return (
                  <button key={pageNum} onClick={() => refreshPage(pageNum)}
                    style={{
                      padding: '0.375rem 0.75rem', borderRadius: '0.25rem', border: '1px solid var(--border)',
                      background: pageNum === pages[tab] ? 'var(--primary)' : 'var(--card)',
                      color: pageNum === pages[tab] ? 'white' : 'var(--foreground)',
                      cursor: 'pointer', fontSize: '0.8125rem', fontWeight: pageNum === pages[tab] ? 700 : 400,
                    }}>
                    {pageNum}
                  </button>
                )
              })}
              <button onClick={() => refreshPage(Math.min(totalPages, pages[tab] + 1))}
                disabled={pages[tab] >= totalPages}
                style={{ padding: '0.375rem 0.75rem', borderRadius: '0.25rem', border: '1px solid var(--border)', background: 'var(--card)', cursor: 'pointer', fontSize: '0.8125rem' }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
